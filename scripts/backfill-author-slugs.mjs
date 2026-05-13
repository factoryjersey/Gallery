// One-off: populate authors.slug from authors.name. Safe to rerun — only
// touches rows where slug is null. Disambiguates collisions by appending a
// numeric suffix.
import pg from "pg";

function slugify(input) {
  return (input || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Make this script self-healing — if `pnpm db:push` hasn't been run yet
// the column won't exist. Adding it directly here is safe and idempotent.
await db.query(`ALTER TABLE authors ADD COLUMN IF NOT EXISTS slug text`);
// Unique constraint on the slug. IF NOT EXISTS-via-DO so it's idempotent
// even though Postgres doesn't accept "ADD CONSTRAINT IF NOT EXISTS".
await db.query(`
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'authors_slug_unique'
    ) THEN
      ALTER TABLE authors ADD CONSTRAINT authors_slug_unique UNIQUE (slug);
    END IF;
  END $$;
`);
console.log("Schema ready (slug column + unique constraint).\n");

const { rows: existing } = await db.query(
  `SELECT id, name, slug FROM authors ORDER BY created_at ASC`,
);
const taken = new Set(existing.map((r) => r.slug).filter(Boolean));

let updated = 0, skipped = 0;
for (const a of existing) {
  if (a.slug) { skipped++; continue; }
  let base = slugify(a.name);
  if (!base) base = "contributor";
  let slug = base;
  let n = 2;
  while (taken.has(slug)) {
    slug = `${base}-${n++}`;
  }
  taken.add(slug);
  await db.query(`UPDATE authors SET slug = $1 WHERE id = $2`, [slug, a.id]);
  console.log(`  ${a.name.padEnd(40)} → ${slug}`);
  updated++;
}

console.log(`\nUpdated ${updated} authors, skipped ${skipped} that already had a slug.`);
await db.end();
