// One-off: for articles that have no featured_image but DO have at least
// one <img> in their body, use the first body image as the featured image.
//
// Safe to rerun — only touches rows where featured_image is null/empty.
// Run with --dry-run first to preview without writing.
//
// Usage:
//   node --env-file=.env.local scripts/backfill-featured-from-body.mjs [--dry-run]
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

// Find the first usable <img src="..."> in an article body. Skips data:
// URIs, SVGs, tiny tracking pixels (heuristic: anything explicitly sized
// to ≤32px in width/height attributes), and on-page anchors.
function extractFirstImage(html) {
  if (!html) return null;
  const tagRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1].trim();
    if (!src) continue;
    if (src.startsWith("data:")) continue;       // inline base64
    if (/\.svg(\?|$)/i.test(src)) continue;       // svg icons
    if (src.startsWith("#")) continue;            // on-page anchor (rare)
    // Reject obvious tracking pixels / dingbats by their width/height
    // attributes when both are tiny.
    const w = Number((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [])[1] || 0);
    const h = Number((tag.match(/\bheight\s*=\s*["']?(\d+)/i) || [])[1] || 0);
    if (w > 0 && h > 0 && w <= 32 && h <= 32) continue;
    return src;
  }
  return null;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(`
  SELECT id, slug, title, content, featured_image
    FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%<img%'
   ORDER BY published_at DESC NULLS LAST
`);

let updated = 0, noUsableImage = 0;
console.log(`Inspecting ${rows.length} candidate articles…\n`);

for (const r of rows) {
  const src = extractFirstImage(r.content);
  if (!src) { noUsableImage++; continue; }
  console.log(`  ${r.title.slice(0, 60).padEnd(60)}  ← ${src.slice(0, 80)}`);
  if (!DRY_RUN) {
    await db.query(
      `UPDATE articles SET featured_image = $1, updated_at = NOW() WHERE id = $2`,
      [src, r.id],
    );
  }
  updated++;
}

console.log(
  `\n${DRY_RUN ? "[DRY RUN] Would update" : "Updated"} ${updated} articles.` +
  `\nSkipped ${noUsableImage} with no usable body image (svg/data-uri/tiny only).`,
);
await db.end();
