// Diagnostic — figure out why the featured-image backfill isn't matching.
// Reports the funnel: total articles → no featured image → contains <img →
// has a usable URL — and prints a sample of the content from articles that
// have no featured image, so we can see the actual markup format.
import pg from "pg";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function count(sql, params = []) {
  const { rows } = await db.query(sql, params);
  return Number(rows[0].n);
}

const total = await count(`SELECT count(*)::int AS n FROM articles`);
const noFeatured = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE featured_image IS NULL OR featured_image = ''
`);
const withImgTag = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%<img%'
`);
const withFigure = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%<figure%'
`);
const withWpCaption = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%[caption%'
`);
const withGutenbergImage = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%wp:image%'
`);
const withMarkdownImage = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ~ '!\[.*\]\(.+\)'
`);
const withHttpImageUrl = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ~* 'https?://[^\\s"''<>]+\\.(jpe?g|png|gif|webp|avif)'
`);
const withElementorLightbox = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%data-elementor-open-lightbox%'
`);
const withR2Url = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%r2.dev/%'
`);
const withWpUploads = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND content ILIKE '%/wp-content/uploads/%'
`);
const withWpDataThumbnail = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND wp_data IS NOT NULL
     AND (
       wp_data::text ILIKE '%thumbnail%'
       OR wp_data::text ILIKE '%featured%'
       OR wp_data::text ILIKE '%image%'
     )
`);
const withAnyWpData = await count(`
  SELECT count(*)::int AS n FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND wp_data IS NOT NULL
`);

console.log("\n=== Featured-image backfill diagnostics ===\n");
console.log(`Total articles                                : ${total}`);
console.log(`  └─ with no featured_image                   : ${noFeatured}`);
console.log(`     ├─ content contains <img                 : ${withImgTag}`);
console.log(`     ├─ content contains <figure              : ${withFigure}`);
console.log(`     ├─ content contains [caption shortcode   : ${withWpCaption}`);
console.log(`     ├─ content contains wp:image (Gutenberg) : ${withGutenbergImage}`);
console.log(`     ├─ content has Markdown image syntax     : ${withMarkdownImage}`);
console.log(`     ├─ content has any http img URL          : ${withHttpImageUrl}`);
console.log(`     ├─ content uses Elementor lightbox       : ${withElementorLightbox}`);
console.log(`     ├─ content references r2.dev URLs        : ${withR2Url}`);
console.log(`     ├─ content references /wp-content/uploads: ${withWpUploads}`);
console.log(`     ├─ has wp_data JSON                      : ${withAnyWpData}`);
console.log(`     └─ wp_data mentions thumbnail/image/feat : ${withWpDataThumbnail}`);

// Helper: find every interesting "image-ish" marker in a content string
// and report a short snippet around each, so we see the real format.
function findImageHits(content) {
  if (!content) return [];
  const patterns = [
    { name: "<img>",        re: /<img\b[^>]*>/i },
    { name: "<figure>",     re: /<figure\b[^>]*>/i },
    { name: "[caption ...]", re: /\[caption[^\]]*\]/i },
    { name: "wp:image",     re: /<!--\s*wp:image[^>]*-->/i },
    { name: "http img URL", re: /https?:\/\/[^\s"'<>]+\.(jpe?g|png|gif|webp|avif)/i },
    { name: "Markdown ![]()", re: /!\[[^\]]*\]\([^)]+\)/ },
  ];
  const hits = [];
  for (const { name, re } of patterns) {
    const m = content.match(re);
    if (!m) continue;
    const i = content.indexOf(m[0]);
    const start = Math.max(0, i - 60);
    const end = Math.min(content.length, i + m[0].length + 60);
    hits.push({ name, at: i, snippet: content.slice(start, end).replace(/\s+/g, " ") });
  }
  return hits;
}

async function sampleSection(label, where, params = []) {
  console.log(`\n=== ${label} ===`);
  const { rows } = await db.query(`
    SELECT slug, title, content
      FROM articles
     WHERE ${where}
     ORDER BY published_at ASC NULLS LAST
     LIMIT 5
  `, params);
  if (rows.length === 0) { console.log("  (none)"); return; }
  for (const r of rows) {
    const hits = findImageHits(r.content || "");
    console.log(`\n--- ${r.title}  [/article/${r.slug}]   len=${(r.content||"").length}`);
    if (hits.length === 0) {
      console.log("  no image-ish markers found anywhere");
    } else {
      for (const h of hits) {
        console.log(`  [${h.name} @${h.at}]  …${h.snippet}…`);
      }
    }
  }
}

await sampleSection(
  "5 OLDEST articles with no featured image",
  "featured_image IS NULL OR featured_image = ''",
);

await sampleSection(
  "5 OLDEST articles with no featured image AND any http image URL in body",
  `(featured_image IS NULL OR featured_image = '')
   AND content ~* 'https?://[^\\s"''<>]+\\.(jpe?g|png|gif|webp|avif)'`,
);

// Show what's inside wp_data.postMeta for image-related keys — that's
// where WordPress stashed the original featured images.
console.log(`\n=== 8 sample wp_data.postMeta image-related keys ===`);
const { rows: wpRows } = await db.query(`
  SELECT slug, title, wp_data
    FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND wp_data IS NOT NULL
   ORDER BY published_at ASC NULLS LAST
   LIMIT 8
`);
for (const r of wpRows) {
  console.log(`\n--- ${r.title}  [/article/${r.slug}]`);
  const wp = r.wp_data;
  const postMeta = (wp && typeof wp === "object") ? wp.postMeta : null;
  if (!postMeta || typeof postMeta !== "object") {
    console.log(`  no postMeta object`);
    continue;
  }
  // Dump every key whose name looks image-ish, plus its value
  const imageKeys = Object.keys(postMeta).filter((k) =>
    /image|thumb|featured|attach|media|photo|picture/i.test(k));
  if (imageKeys.length === 0) {
    console.log(`  no image-shaped keys; postMeta has: ${Object.keys(postMeta).slice(0,8).join(", ")}`);
    continue;
  }
  for (const k of imageKeys) {
    const v = postMeta[k];
    const display = typeof v === "string"
      ? (v.length > 200 ? v.slice(0, 200) + "…" : v)
      : JSON.stringify(v).slice(0, 200);
    console.log(`    ${k} = ${display}`);
  }
}

await db.end();
