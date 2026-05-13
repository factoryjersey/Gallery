// Force-repair a single article. Verbose — prints every decision so we can
// see exactly why an article does or doesn't get updated. Does NOT dry-run
// by default; pass --dry-run to skip the write.
//
// Usage:  railway run node scripts/force-repair-one.mjs <slug>
//         railway run node scripts/force-repair-one.mjs <slug> --dry-run
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");
const slug = process.argv[2];
if (!slug || slug.startsWith("--")) {
  console.error("Usage: node scripts/force-repair-one.mjs <slug> [--dry-run]");
  process.exit(1);
}

const R2_BASE = "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev";
const IMG_URL_RE = /https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|gif|webp|avif)/gi;

async function headCheck(url) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow" });
    }
    return res.status;
  } catch (e) {
    return 0;
  }
}

function generateR2Variants(deadUrl) {
  if (!deadUrl || typeof deadUrl !== "string") return [];
  let path = deadUrl
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/^\/+/, "")
    .replace(/^v3\//i, "")
    .replace(/^wp-content\/uploads\//i, "wp-content/");
  const noPrefix = path.replace(/^wp-content\//i, "");
  const stripSize = (p) => p.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1");
  const candidates = new Set([
    `${R2_BASE}/${noPrefix}`,
    `${R2_BASE}/${stripSize(noPrefix)}`,
    `${R2_BASE}/wp-content/${noPrefix}`,
    `${R2_BASE}/wp-content/${stripSize(noPrefix)}`,
  ]);
  return [...candidates].filter((u) => /\.(jpe?g|png|gif|webp|avif)$/i.test(u));
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(
  `SELECT id, slug, title, featured_image, content
     FROM articles WHERE slug = $1 LIMIT 1`,
  [slug],
);
if (!rows.length) { console.error(`No article with slug "${slug}"`); process.exit(1); }
const a = rows[0];

console.log(`Article: ${a.title}`);
console.log(`  id=${a.id}`);
console.log(`  current featured_image: ${a.featured_image || "(null/empty)"}\n`);

// Step 1 — HEAD-check the current featured_image
let currentStatus = null;
if (a.featured_image) {
  console.log(`Step 1: HEAD-check current featured_image`);
  currentStatus = await headCheck(a.featured_image);
  console.log(`  status: ${currentStatus}\n`);
  if (currentStatus >= 200 && currentStatus < 300) {
    console.log(`✗ Current featured_image is ALIVE — nothing to do.`);
    process.exit(0);
  }
}

// Step 2 — collect body URLs
const bodyUrls = [];
const seen = new Set();
for (const m of (a.content || "").matchAll(IMG_URL_RE)) {
  if (!seen.has(m[0])) { seen.add(m[0]); bodyUrls.push(m[0]); }
}
console.log(`Step 2: Found ${bodyUrls.length} unique image URLs in body`);
for (const u of bodyUrls) console.log(`  - ${u}`);
console.log();

// Step 3 — HEAD each body URL, pick first 200
console.log(`Step 3: HEAD-check body URLs`);
let pickedFromBody = null;
for (const u of bodyUrls) {
  const s = await headCheck(u);
  console.log(`  [${s}] ${u}`);
  if (!pickedFromBody && s >= 200 && s < 300) pickedFromBody = u;
}
console.log();

let picked = pickedFromBody;
let pickedSource = pickedFromBody ? "body" : null;

// Step 4 — if no body URL worked, try R2 variants of the dead featured_image
if (!picked && a.featured_image) {
  const variants = generateR2Variants(a.featured_image);
  console.log(`Step 4: Try ${variants.length} R2 variants of the dead featured_image`);
  for (const u of variants) {
    if (u === a.featured_image) continue;
    const s = await headCheck(u);
    console.log(`  [${s}] ${u}`);
    if (!picked && s >= 200 && s < 300) {
      picked = u;
      pickedSource = "variant";
    }
  }
  console.log();
}

if (!picked) {
  console.log(`✗ No working URL found — leaving featured_image unchanged.`);
  process.exit(0);
}

console.log(`✓ Resolved replacement from ${pickedSource}: ${picked}\n`);

if (DRY_RUN) {
  console.log(`[DRY RUN] Would UPDATE articles SET featured_image = ${picked} WHERE id = ${a.id}`);
} else {
  const result = await db.query(
    `UPDATE articles SET featured_image = $1, updated_at = NOW() WHERE id = $2 RETURNING featured_image`,
    [picked, a.id],
  );
  console.log(`UPDATE ran. rowCount=${result.rowCount}, returned featured_image=${result.rows[0]?.featured_image}`);

  // Read it back to confirm the write stuck
  const { rows: check } = await db.query(`SELECT featured_image FROM articles WHERE id = $1`, [a.id]);
  console.log(`Read-back: featured_image=${check[0]?.featured_image}`);
}

await db.end();
