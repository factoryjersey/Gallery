// Backfill featured_image for articles imported from WordPress where the
// original image URL is stashed in wp_data.postMeta but never landed on
// the row's featured_image column.
//
// Picks the URL from wp_data.postMeta.image (or Image, then _video_thumbnail
// as fallback), rewrites the dead old hosts to the current R2 bucket, then
// HEAD-checks each derived URL. Only URLs that return 200 are written.
//
// Safe to rerun — only touches rows where featured_image is null/empty.
// Flags:
//   --dry-run         preview only; still HEAD-checks so you see hit rate
//   --no-verify       skip HEAD checks (faster, riskier)
//   --concurrency=N   parallel HEAD requests (default 12)
//
// Usage:
//   railway run node scripts/backfill-featured-from-wpdata.mjs --dry-run
//   railway run node scripts/backfill-featured-from-wpdata.mjs
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");
const NO_VERIFY = process.argv.includes("--no-verify");
const CONCURRENCY = Number(
  (process.argv.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1] || 12,
);
const R2_BASE = "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev";

// Normalise whatever WordPress stored — full URL on a dead old domain,
// relative path with or without /uploads/, leading /v3/ — into the
// current R2 path. Returns null if the value isn't shaped like a WP
// image path.
function transformToR2(raw) {
  if (typeof raw !== "string") return null;
  let url = raw.trim();
  if (!url) return null;
  // Strip protocol + host (we don't trust any old hosts).
  url = url.replace(/^https?:\/\/[^/]+\//i, "");
  // Strip any leading slashes.
  url = url.replace(/^\/+/, "");
  // Strip the legacy /v3/ install prefix.
  url = url.replace(/^v3\//i, "");
  // The migration dropped /uploads/ from the path, so collapse
  // wp-content/uploads/ → wp-content/.
  url = url.replace(/^wp-content\/uploads\//i, "wp-content/");
  // Some entries store just the date path without wp-content/ — prepend
  // it so the URL ends up under the same R2 prefix as everything else.
  if (!/^wp-content\//i.test(url)) {
    if (/^\d{4}\/\d{2}\//.test(url)) {
      url = "wp-content/" + url;
    } else {
      return null;  // doesn't look like a WP upload — bail
    }
  }
  // Sanity: must end with an image extension.
  if (!/\.(jpe?g|png|gif|webp|avif|tiff?)$/i.test(url)) return null;
  return `${R2_BASE}/${url}`;
}

function pickRawUrl(postMeta) {
  if (!postMeta || typeof postMeta !== "object") return null;
  // Priority order — image keys WordPress imports populate, in order of
  // how authoritative they are.
  for (const key of ["image", "Image", "_video_thumbnail", "thumbnail", "featured_image"]) {
    const v = postMeta[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return null;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(`
  SELECT id, slug, title, wp_data
    FROM articles
   WHERE (featured_image IS NULL OR featured_image = '')
     AND wp_data IS NOT NULL
   ORDER BY published_at ASC NULLS LAST
`);

console.log(`Inspecting ${rows.length} candidate articles…\n`);

// Robust accessor — pg occasionally hands back `json` columns as a string
// rather than a parsed object (depending on type-parser registration). If
// we got a string, JSON.parse it.
function readWp(raw) {
  if (raw == null) return null;
  if (typeof raw === "object") return raw;
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return null;
}

// One-shot debug: dump the shape of the first row's wp_data so we can see
// exactly what we're working with.
if (rows.length) {
  const first = rows[0];
  const raw = first.wp_data;
  console.log(`[debug] sample wp_data — typeof=${typeof raw} ` +
    `${typeof raw === "string" ? `len=${raw.length}` : `keys=${raw && typeof raw === "object" ? Object.keys(raw).join(",") : "n/a"}`}`);
  const parsed = readWp(raw);
  if (parsed && typeof parsed === "object") {
    console.log(`[debug] parsed top-level keys: ${Object.keys(parsed).join(", ")}`);
    if (parsed.postMeta && typeof parsed.postMeta === "object") {
      console.log(`[debug] postMeta keys: ${Object.keys(parsed.postMeta).slice(0, 12).join(", ")}`);
    }
  }
  console.log();
}

// Pass 1 — derive candidate URLs in memory. No DB writes, no HTTP yet.
const candidates = [];
let noPostMeta = 0, noImageKey = 0, unrecognised = 0;
const examples = { unrecognised: [] };

for (const r of rows) {
  const wp = readWp(r.wp_data);
  const postMeta = (wp && typeof wp === "object") ? wp.postMeta : null;
  if (!postMeta || typeof postMeta !== "object") { noPostMeta++; continue; }
  const raw = pickRawUrl(postMeta);
  if (!raw) { noImageKey++; continue; }
  const newUrl = transformToR2(raw);
  if (!newUrl) {
    unrecognised++;
    if (examples.unrecognised.length < 5) {
      examples.unrecognised.push({ title: r.title, raw });
    }
    continue;
  }
  candidates.push({ id: r.id, title: r.title, raw, newUrl });
}

console.log(`Derived ${candidates.length} candidate URLs`);
console.log(`  No postMeta object              : ${noPostMeta}`);
console.log(`  postMeta but no image key       : ${noImageKey}`);
console.log(`  Image key but unrecognised path : ${unrecognised}\n`);

// Pass 2 — HEAD each candidate to confirm the R2 file actually exists.
// Falls back to GET (range bytes=0-0) for hosts that don't allow HEAD.
async function headCheck(url) {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 403) {
      // Some object stores reject HEAD — try a 1-byte GET instead.
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" }, redirect: "follow" });
    }
    return res.status;
  } catch {
    return 0; // network / DNS / etc.
  }
}

async function runWithConcurrency(items, worker, n) {
  const results = new Array(items.length);
  let idx = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
      if ((i + 1) % 100 === 0) process.stderr.write(`  …checked ${i + 1}/${items.length}\n`);
    }
  }));
  return results;
}

let alive = 0, dead = 0, missing = 0;
const aliveCandidates = [];           // candidates whose URLs returned 2xx
const aliveExamples = [], deadExamples = [];

if (NO_VERIFY) {
  console.log(`Skipping HEAD verification (--no-verify).\n`);
  for (const c of candidates) {
    aliveCandidates.push(c);
    if (aliveExamples.length < 8) aliveExamples.push(c);
    alive++;
  }
} else {
  console.log(`HEAD-checking ${candidates.length} URLs (concurrency ${CONCURRENCY})…`);
  const statuses = await runWithConcurrency(candidates, (c) => headCheck(c.newUrl), CONCURRENCY);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const status = statuses[i];
    if (status >= 200 && status < 300) {
      alive++;
      aliveCandidates.push(c);
      if (aliveExamples.length < 8) aliveExamples.push(c);
    } else if (status === 404 || status === 403) {
      missing++;
      if (deadExamples.length < 8) deadExamples.push({ ...c, status });
    } else {
      dead++;
      if (deadExamples.length < 8) deadExamples.push({ ...c, status });
    }
  }
}

// Pass 3 — write only the survivors. Uses the cached aliveCandidates list
// so we don't re-run HTTP for the actual update.
let updated = 0;
if (!DRY_RUN) {
  for (const c of aliveCandidates) {
    await db.query(
      `UPDATE articles SET featured_image = $1, updated_at = NOW() WHERE id = $2`,
      [c.newUrl, c.id],
    );
    updated++;
  }
}

console.log(`\n=== Result ===`);
console.log(`  Candidates derived              : ${candidates.length}`);
console.log(`  Alive (HEAD 2xx)                : ${alive}`);
console.log(`  Missing (404 / 403)             : ${missing}`);
console.log(`  Other failure (DNS, 5xx, etc.)  : ${dead}`);
if (!DRY_RUN) console.log(`  Rows updated                    : ${updated}`);
else          console.log(`  [DRY RUN] Would update          : ${alive}`);

console.log(`\n=== Sample of ALIVE URLs (would be applied) ===`);
for (const e of aliveExamples) {
  console.log(`  ${e.title.slice(0, 50).padEnd(50)}`);
  console.log(`    new : ${e.newUrl}`);
}

if (deadExamples.length) {
  console.log(`\n=== Sample of DEAD URLs (skipped) ===`);
  for (const e of deadExamples) {
    console.log(`  [${e.status || "ERR"}] ${e.title.slice(0, 45).padEnd(45)}  ${e.newUrl.slice(0, 90)}`);
  }
}

if (examples.unrecognised.length) {
  console.log(`\n=== Unrecognised paths (skipped before HEAD check) ===`);
  for (const e of examples.unrecognised) {
    console.log(`  ${e.title.slice(0, 50).padEnd(50)}  raw=${e.raw}`);
  }
}

await db.end();
