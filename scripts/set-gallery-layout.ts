#!/usr/bin/env tsx
/**
 * One-shot: set (or clear) the gallery_layout on a single article by slug.
 * Useful for trying the new 'full-width-masonry' layout on a specific
 * events feature without clicking through the admin UI.
 *
 * Usage:
 *   railway run npx tsx scripts/set-gallery-layout.ts <slug> <layout>
 *   railway run npx tsx scripts/set-gallery-layout.ts <slug> auto
 *
 * Layout values:
 *   full-width-masonry  — text at top, full-bleed masonry below
 *   auto                — null (default heuristic, i.e. revert)
 *
 * Prints the before/after values so you can see what changed and roll
 * back if needed.
 */

import pg from "pg";

function localFriendlyDatabaseUrl(raw: string): string {
  const isSupabase = /supabase\.(com|co)/i.test(raw);
  let parsed: URL | null = null;
  try { parsed = new URL(raw); } catch { return raw; }
  if (isSupabase && parsed.port === "5432") {
    parsed.port = "6543";
    return parsed.toString();
  }
  return raw;
}

const [, , slug, layoutArg] = process.argv;
if (!slug || !layoutArg) {
  console.error("Usage: set-gallery-layout.ts <slug> <layout|auto>");
  process.exit(1);
}
const newValue = layoutArg === "auto" ? null : layoutArg;
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: localFriendlyDatabaseUrl(process.env.DATABASE_URL),
  idleTimeoutMillis: 10_000,
  max: 2,
});

const before = await pool.query<{
  id: string;
  title: string;
  gallery_layout: string | null;
  category_slug: string | null;
  gallery_images_count: number;
}>(
  `SELECT a.id, a.title, a.gallery_layout, c.slug AS category_slug,
          COALESCE(jsonb_array_length(COALESCE(a.gallery_images, '[]'::jsonb)), 0)::int
            AS gallery_images_count
     FROM articles a
     LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.slug = $1
    LIMIT 1`,
  [slug],
);
if (before.rows.length === 0) {
  console.error(`No article with slug: ${slug}`);
  await pool.end();
  process.exit(1);
}
const row = before.rows[0];
console.log(
  `Article: "${row.title}" (${row.category_slug ?? "no category"}), ${row.gallery_images_count} gallery image(s)`,
);
console.log(`  Current gallery_layout: ${row.gallery_layout ?? "(null — default)"}`);
console.log(`  New gallery_layout:     ${newValue ?? "(null — default)"}`);

if (row.gallery_layout === newValue) {
  console.log("Already set to that value — no change made.");
  await pool.end();
  process.exit(0);
}

await pool.query(
  `UPDATE articles SET gallery_layout = $1, updated_at = NOW() WHERE id = $2`,
  [newValue, row.id],
);
console.log(`✓ Updated. View it: https://gallery.je/article/${slug}`);
await pool.end();
