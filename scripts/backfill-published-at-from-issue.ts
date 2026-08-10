#!/usr/bin/env tsx
/**
 * One-shot backfill: for every published article that has an
 * issue_number but a NULL published_at, set published_at from the
 * issue's print-edition date.
 *
 * Fixes a class of bug where articles created via the admin UI's PDF
 * ingest flow (and the batch script's earliest versions) landed with
 * status='published' + publishedAt=null. Combined with the pre-fix
 * homepage sort defaulting to NULLS FIRST on DESC, those articles
 * bubbled to the top of the front-page hero as if they were the
 * newest — even though they were re-issued from a 10-year-old print
 * edition.
 *
 * Idempotent: only touches rows where publishedAt IS NULL. Rows that
 * already have a date (whether right or wrong) are left alone — the
 * editor can retimestamp those from the admin if needed.
 *
 * Usage:
 *   railway run npx tsx scripts/backfill-published-at-from-issue.ts --dry-run
 *   railway run npx tsx scripts/backfill-published-at-from-issue.ts
 */

import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

// Same local-friendly port swap as pdf-batch-ingest: Supabase's
// session pooler on 5432 is IPv6-only from most external networks;
// transaction pooler on 6543 accepts IPv4.
function localFriendlyDatabaseUrl(raw: string): string {
  const isSupabase = /supabase\.(com|co)/i.test(raw);
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  if (isSupabase && parsed.port === "5432") {
    parsed.port = "6543";
    console.log(`(local: swapped Supabase pooler port 5432 → 6543)`);
    return parsed.toString();
  }
  return raw;
}

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}

const db = new pg.Client({ connectionString: localFriendlyDatabaseUrl(process.env.DATABASE_URL) });
await db.connect();

// Preview: how many rows would be touched, and which issues drive it?
const previewRes = await db.query<{
  n: number;
  issue_number: number;
  issue_date: string;
}>(`
  SELECT COUNT(*)::int AS n, a.issue_number, i.published_at::date::text AS issue_date
  FROM articles a
  JOIN issues i ON i.number = a.issue_number
  WHERE a.status = 'published'
    AND a.published_at IS NULL
    AND i.published_at IS NOT NULL
  GROUP BY a.issue_number, i.published_at
  ORDER BY a.issue_number
`);

const total = previewRes.rows.reduce((sum, r) => sum + r.n, 0);
console.log(`\nBackfill preview — ${total} article(s) across ${previewRes.rows.length} issue(s):`);
for (const row of previewRes.rows) {
  console.log(`  Issue #${String(row.issue_number).padStart(3)} (${row.issue_date}): ${row.n} article(s)`);
}
console.log("");

if (total === 0) {
  console.log("Nothing to backfill — every published article already has a date. Exiting.");
  await db.end();
  process.exit(0);
}

if (DRY_RUN) {
  console.log("Dry run — no changes made. Re-run without --dry-run to apply.");
  await db.end();
  process.exit(0);
}

// Apply. updated_at bumps so the audit trail shows this migration ran.
const applyRes = await db.query(`
  UPDATE articles a
  SET published_at = i.published_at,
      updated_at = NOW()
  FROM issues i
  WHERE a.issue_number = i.number
    AND a.status = 'published'
    AND a.published_at IS NULL
    AND i.published_at IS NOT NULL
`);

console.log(`✓ Updated ${applyRes.rowCount} article(s).`);
await db.end();
