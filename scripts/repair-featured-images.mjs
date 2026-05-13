// Repair featured_image by walking the article body for live image URLs.
//
// Handles both "no featured image" AND "featured image is set but the file
// is 404" cases. The article body itself usually contains working R2
// URLs, even when the wp_data points to old paths.
//
// Strategy per article:
//   1. Extract candidate URLs:
//        - current featured_image (if any)
//        - every r2.dev (or other http) image URL in content
//   2. HEAD each (dedup across articles so we only ping a given URL once)
//   3. If current featured_image is alive — leave it alone
//   4. Otherwise — use the first body URL that's alive
//   5. If nothing alive — leave the row untouched
//
// Flags:
//   --dry-run                   preview only, no writes
//   --concurrency=N             parallel HEAD requests (default 16)
//   --only-missing              skip articles that already have a working
//                               featured_image (default behaviour)
//   --also-replace-dead         replace featured_image when the current
//                               value is set but returns non-2xx (default)
//   --keep-existing-if-set      don't replace even when current is 404
//   --extensions=jpg,png,...    image extensions to consider in body
//                               (default jpg,jpeg,png,gif,webp,avif)
//
// Usage:
//   railway run node scripts/repair-featured-images.mjs --dry-run
//   railway run node scripts/repair-featured-images.mjs
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");
const KEEP_EXISTING_IF_SET = process.argv.includes("--keep-existing-if-set");
const CONCURRENCY = Number(
  (process.argv.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1] || 16,
);
const EXT_ARG = (process.argv.find((a) => a.startsWith("--extensions=")) || "").split("=")[1];
const EXTS = (EXT_ARG ? EXT_ARG.split(",") : ["jpe?g", "png", "gif", "webp", "avif"])
  .map((e) => e.trim()).filter(Boolean);
const IMG_URL_RE = new RegExp(`https?://[^\\s"'<>]+\\.(${EXTS.join("|")})`, "gi");

const R2_BASE = "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev";

// Given a known-dead WP-era URL (or any URL we want to rescue), generate a
// short list of plausible R2 alternatives. WordPress used to write sized
// thumbnail variants like `file-300x200.jpg`; the migration kept the base
// file `file.jpg` but not the sized variant. We try:
//   1. Domain-swap, drop /v3/ prefix         — preserves /YYYY/MM/file-300x200.jpg
//   2. Same but with /wp-content/ prefix      — current R2 layout for new posts
//   3. Both of the above with the -WIDTHxHEIGHT suffix stripped (the base file)
function generateR2Variants(deadUrl) {
  if (!deadUrl || typeof deadUrl !== "string") return [];
  let path = deadUrl
    .replace(/^https?:\/\/[^/]+\//i, "")  // drop host
    .replace(/^\/+/, "")                   // drop leading slash
    .replace(/^v3\//i, "")                 // drop /v3/
    .replace(/^wp-content\/uploads\//i, "wp-content/"); // collapse /uploads/

  // If the path doesn't start with wp-content/, treat it as YYYY/MM/file
  const noPrefix = path.replace(/^wp-content\//i, "");

  // Stripped-size variants ("foo-300x200.jpg" → "foo.jpg")
  const stripSize = (p) => p.replace(/-\d+x\d+(\.[a-z]+)$/i, "$1");

  const variants = new Set([
    `${R2_BASE}/${noPrefix}`,
    `${R2_BASE}/${stripSize(noPrefix)}`,
    `${R2_BASE}/wp-content/${noPrefix}`,
    `${R2_BASE}/wp-content/${stripSize(noPrefix)}`,
  ]);
  // Sanity — must end in an image extension
  return [...variants].filter((u) => /\.(jpe?g|png|gif|webp|avif)$/i.test(u));
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// We process every article — including ones with a set featured_image, so
// we can detect and replace dead ones.
const { rows } = await db.query(`
  SELECT id, slug, title, featured_image, content
    FROM articles
   ORDER BY published_at ASC NULLS LAST
`);

console.log(`Loaded ${rows.length} articles.\n`);

// Pass 1 — extract candidate URL list per article. Sources, in priority:
//   1. current featured_image (if any) — kept if alive
//   2. body image URLs
//   3. R2 variants derived from the dead featured_image (strip size suffix,
//      try with and without /wp-content/ prefix). Rescues old WP imports
//      where the thumbnail variant 404s but the base file is in R2.
const perArticle = rows.map((r) => {
  const bodyUrls = [];
  const seen = new Set();
  for (const m of (r.content || "").matchAll(IMG_URL_RE)) {
    const u = m[0];
    if (!seen.has(u)) { seen.add(u); bodyUrls.push(u); }
  }
  const current = (r.featured_image || "").trim() || null;
  const derivedVariants = current ? generateR2Variants(current) : [];
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    current,
    bodyUrls,
    derivedVariants,
  };
});

// Dedup the global set of URLs we need to HEAD.
const allUrls = new Set();
for (const a of perArticle) {
  if (a.current) allUrls.add(a.current);
  for (const u of a.bodyUrls) allUrls.add(u);
  for (const u of a.derivedVariants) allUrls.add(u);
}
console.log(`HEAD-checking ${allUrls.size} unique URLs (concurrency ${CONCURRENCY})…`);

async function headCheck(url) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow" });
    }
    return res.status;
  } catch {
    return 0;
  }
}

async function runWithConcurrency(items, worker, n) {
  const results = new Map();
  let idx = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      const url = items[i];
      results.set(url, await worker(url));
      if ((i + 1) % 200 === 0) process.stderr.write(`  …checked ${i + 1}/${items.length}\n`);
    }
  }));
  return results;
}

const urlList = [...allUrls];
const statusByUrl = await runWithConcurrency(urlList, headCheck, CONCURRENCY);
const alive = (u) => {
  const s = statusByUrl.get(u);
  return typeof s === "number" && s >= 200 && s < 300;
};

// Pass 2 — decide what to do for each article.
let leftAlone = 0;          // already has a working featured_image
let setFromMissing = 0;     // no featured_image, found a working body URL
let replacedDead = 0;       // featured_image was set but dead, replaced
let stillImageless = 0;     // nothing alive — gave up
let keptDeadByFlag = 0;     // dead but --keep-existing-if-set

const samples = { setFromMissing: [], replacedDead: [], stillImageless: [] };

let rescuedFromVariant = 0;
samples.rescuedFromVariant = [];

for (const a of perArticle) {
  // Already has a live featured_image? Nothing to do.
  if (a.current && alive(a.current)) { leftAlone++; continue; }

  // Try body URLs first, then derived R2 variants of the dead URL.
  const fromBody = a.bodyUrls.find(alive) || null;
  const fromVariant = !fromBody ? (a.derivedVariants.find(alive) || null) : null;
  const picked = fromBody || fromVariant;
  const pickedSource = fromBody ? "body" : (fromVariant ? "variant" : null);

  if (!picked) {
    if (samples.stillImageless.length < 6 && (!a.current || !alive(a.current))) {
      samples.stillImageless.push(a);
    }
    stillImageless++;
    continue;
  }

  if (!a.current) {
    if (samples.setFromMissing.length < 6) samples.setFromMissing.push({ ...a, picked });
    setFromMissing++;
  } else if (KEEP_EXISTING_IF_SET) {
    keptDeadByFlag++;
    continue;
  } else if (pickedSource === "variant") {
    if (samples.rescuedFromVariant.length < 6) samples.rescuedFromVariant.push({ ...a, picked });
    rescuedFromVariant++;
  } else {
    if (samples.replacedDead.length < 6) samples.replacedDead.push({ ...a, picked });
    replacedDead++;
  }

  if (!DRY_RUN) {
    await db.query(
      `UPDATE articles SET featured_image = $1, updated_at = NOW() WHERE id = $2`,
      [picked, a.id],
    );
  }
}

console.log(`\n=== Result ===`);
console.log(`  Already-working featured_image  : ${leftAlone}`);
console.log(`  ${DRY_RUN ? "Would set" : "Set"} from body (was missing)   : ${setFromMissing}`);
console.log(`  ${DRY_RUN ? "Would replace" : "Replaced"} dead via body URL    : ${replacedDead}`);
console.log(`  ${DRY_RUN ? "Would rescue" : "Rescued"} dead via R2 variant   : ${rescuedFromVariant}`);
console.log(`  Still image-less (nothing alive): ${stillImageless}`);
if (KEEP_EXISTING_IF_SET) {
  console.log(`  Kept dead due to flag           : ${keptDeadByFlag}`);
}

function logSample(label, list) {
  if (!list.length) return;
  console.log(`\n=== ${label} ===`);
  for (const a of list) {
    console.log(`  ${a.title.slice(0, 60)}  [/article/${a.slug}]`);
    if (a.current)   console.log(`    was : ${a.current}`);
    if (a.picked)    console.log(`    now : ${a.picked}`);
  }
}
logSample(`Sample: set from body (was missing)`, samples.setFromMissing);
logSample(`Sample: replaced dead via body URL`, samples.replacedDead);
logSample(`Sample: rescued dead via R2 variant`, samples.rescuedFromVariant);
logSample(`Sample: still image-less (no live URLs anywhere)`, samples.stillImageless.slice(0, 6));

await db.end();
