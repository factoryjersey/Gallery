// Quick check: what do real featured_image values look like? Sampling
// across the age range so we can see if old vs new articles use a
// different host / path pattern.
import pg from "pg";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const sample = await db.query(`
  SELECT slug, title, featured_image,
         to_char(published_at, 'YYYY-MM') AS month
    FROM articles
   WHERE featured_image IS NOT NULL AND featured_image <> ''
   ORDER BY published_at ASC NULLS LAST
   LIMIT 5
`);
console.log("=== Oldest 5 articles WITH a featured_image ===");
for (const r of sample.rows) {
  console.log(`  [${r.month}] ${r.featured_image.slice(0, 110)}`);
}

const recent = await db.query(`
  SELECT slug, title, featured_image,
         to_char(published_at, 'YYYY-MM') AS month
    FROM articles
   WHERE featured_image IS NOT NULL AND featured_image <> ''
   ORDER BY published_at DESC NULLS LAST
   LIMIT 5
`);
console.log("\n=== Newest 5 articles WITH a featured_image ===");
for (const r of recent.rows) {
  console.log(`  [${r.month}] ${r.featured_image.slice(0, 110)}`);
}

// Distinct prefixes — first 40 chars — to spot pattern variants
const prefixes = await db.query(`
  SELECT substring(featured_image from 1 for 40) AS prefix, count(*)::int AS n
    FROM articles
   WHERE featured_image IS NOT NULL AND featured_image <> ''
   GROUP BY prefix
   ORDER BY n DESC
   LIMIT 10
`);
console.log("\n=== Most common featured_image URL prefixes ===");
for (const r of prefixes.rows) {
  console.log(`  ${String(r.n).padStart(5)}  ${r.prefix}`);
}

await db.end();
