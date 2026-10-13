#!/usr/bin/env tsx
/**
 * One-shot migration: add the nullable `gallery_layout` column to the
 * articles table. Idempotent (ADD COLUMN IF NOT EXISTS) so re-running
 * is safe.
 *
 * Written as a standalone script because `pnpm db:push` (drizzle-kit)
 * silently fails against Supabase's transaction pooler on 6543 — its
 * schema introspection uses session-level Postgres features the pooler
 * rejects. This script does a single ALTER TABLE, no introspection, no
 * session state — works fine through the pooler.
 *
 * Usage:
 *   railway run npx tsx scripts/add-gallery-layout-column.ts
 */

import pg from "pg";

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

const pool = new pg.Pool({
  connectionString: localFriendlyDatabaseUrl(process.env.DATABASE_URL),
  idleTimeoutMillis: 10_000,
  max: 2,
});

// Check first so we can report "already present" vs "added" clearly.
const before = await pool.query<{ exists: boolean }>(`
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'articles'
       AND column_name  = 'gallery_layout'
  ) AS exists
`);

if (before.rows[0].exists) {
  console.log("✓ Column articles.gallery_layout already exists — no change needed.");
  await pool.end();
  process.exit(0);
}

await pool.query(`ALTER TABLE articles ADD COLUMN gallery_layout text`);
console.log("✓ Added nullable column articles.gallery_layout (text).");
await pool.end();
