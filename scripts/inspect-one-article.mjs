// Focused diagnostic: dump everything we know about one article, plus
// HEAD-check both possible R2 paths for whatever featured-image candidate
// we'd derive.
//
// Usage:  railway run node scripts/inspect-one-article.mjs <slug>
import pg from "pg";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/inspect-one-article.mjs <slug>");
  process.exit(1);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(
  `SELECT slug, title, featured_image, content, wp_data
     FROM articles WHERE slug = $1 LIMIT 1`,
  [slug],
);
if (rows.length === 0) { console.error(`No article with slug ${slug}`); process.exit(1); }
const a = rows[0];

console.log(`=== ${a.title}  [/article/${a.slug}] ===\n`);
console.log(`featured_image: ${a.featured_image || "(null/empty)"}\n`);

// All http(s) URLs in body, sorted by where they appear
const urls = [];
const re = /https?:\/\/[^\s"'<>]+/g;
let m;
while ((m = re.exec(a.content || "")) !== null) {
  urls.push({ at: m.index, url: m[0] });
}
console.log(`Found ${urls.length} URLs in content. First 12:`);
for (const u of urls.slice(0, 12)) {
  console.log(`  @${u.at}  ${u.url.slice(0, 120)}`);
}

// wp_data.postMeta image-shaped keys
const wp = a.wp_data;
const postMeta = (wp && typeof wp === "object") ? wp.postMeta : null;
console.log(`\nwp_data.postMeta:`);
if (!postMeta) {
  console.log(`  (no postMeta)`);
} else {
  const imageKeys = Object.keys(postMeta).filter((k) =>
    /image|thumb|featured|attach|media|photo|picture/i.test(k));
  for (const k of imageKeys) {
    console.log(`  ${k} = ${typeof postMeta[k] === "string" ? postMeta[k] : JSON.stringify(postMeta[k])}`);
  }
}

// HEAD-check both possible R2 paths for any image-shaped URL
const R2 = "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev";
const candidates = new Set();
for (const u of urls) {
  if (/\.(jpe?g|png|gif|webp|avif)$/i.test(u.url)) candidates.add(u.url);
}
if (postMeta) {
  for (const k of ["image", "Image", "_video_thumbnail"]) {
    const v = postMeta[k];
    if (typeof v !== "string" || !v) continue;
    // Strip protocol+host and /v3/ prefix
    let path = v.replace(/^https?:\/\/[^/]+\//i, "").replace(/^\/+/, "").replace(/^v3\//i, "");
    candidates.add(`${R2}/${path}`);                                          // as-is
    candidates.add(`${R2}/${path.replace(/^wp-content\/uploads\//i, "wp-content/")}`); // collapsed
    candidates.add(`${R2}/${path.replace(/^wp-content\/(uploads\/)?/i, "")}`);         // no wp-content prefix
  }
}

console.log(`\n=== HEAD-checking ${candidates.size} candidate URLs ===`);
for (const u of candidates) {
  try {
    let res = await fetch(u, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(u, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow" });
    }
    console.log(`  [${res.status}]  ${u}`);
  } catch (e) {
    console.log(`  [ERR]  ${u}  (${e.message})`);
  }
}

await db.end();
