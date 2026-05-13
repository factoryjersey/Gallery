// Walks every article's content, finds every image URL referenced (in
// <img src>, <a href> Elementor lightbox wrappers, or <figure> blocks),
// HEAD-checks each, and:
//
//   1. If the URL has a working R2 variant (strip "-WIDTHxHEIGHT", add or
//      drop "/wp-content/" prefix), REWRITE the URL inline.
//   2. Otherwise, STRIP the element that hosts it (the <img>, plus its
//      <a data-elementor-open-lightbox> wrapper, plus its <figure>
//      wrapper if the figure ends up empty).
//
// Safe to rerun — only touches dead URLs. Run with --dry-run first.
//
// Flags:
//   --dry-run                 preview only, no writes
//   --concurrency=N           parallel HEAD requests (default 16)
//   --limit=N                 only process N articles (handy for spot-check)
//
// Usage:
//   railway run node scripts/sanitise-dead-body-images.mjs --dry-run
//   railway run node scripts/sanitise-dead-body-images.mjs
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");
const CONCURRENCY = Number(
  (process.argv.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1] || 16,
);
const LIMIT = Number(
  (process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0,
);

const R2_BASE = "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev";

// Generate plausible R2 alternatives for a dead URL: same path with
// "-WIDTHxHEIGHT" stripped, with and without the /wp-content/ prefix.
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

const IMG_URL_RE = /https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|gif|webp|avif)/gi;
const TAG_IMG_RE = /<img\b[^>]*>/gi;
const TAG_LIGHTBOX_RE = /<a\b[^>]*data-elementor-open-lightbox[^>]*>[\s\S]*?<\/a>/gi;
const TAG_FIGURE_RE = /<figure\b[^>]*>[\s\S]*?<\/figure>/gi;

function extractSrc(tag) {
  const m = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : null;
}
function extractHref(tag) {
  const m = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
  return m ? m[1] : null;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let q = `SELECT id, slug, title, content FROM articles
         WHERE content ILIKE '%<img%' OR content ILIKE '%data-elementor-open-lightbox%'
         ORDER BY published_at ASC NULLS LAST`;
if (LIMIT) q += ` LIMIT ${LIMIT}`;
const { rows } = await db.query(q);
console.log(`Loaded ${rows.length} articles with potential body images.\n`);

// Phase 1 — collect every unique URL we need to verify.
const allUrls = new Set();
for (const r of rows) {
  for (const m of (r.content || "").matchAll(IMG_URL_RE)) allUrls.add(m[0]);
}
console.log(`Found ${allUrls.size} unique image URLs across all bodies.`);

console.log(`\nHEAD-checking primary URLs (concurrency ${CONCURRENCY})…`);
const primaryStatus = await runWithConcurrency([...allUrls], headCheck, CONCURRENCY);
const alive = (u) => {
  const s = primaryStatus.get(u);
  return typeof s === "number" && s >= 200 && s < 300;
};

// Phase 2 — for every dead URL, find a working R2 variant if possible.
const dead = [...allUrls].filter((u) => !alive(u));
console.log(`\n${dead.length} URLs are dead. Searching for R2 variants…`);

const variantUrls = new Set();
const variantMap = new Map(); // dead → [candidate variants]
for (const d of dead) {
  const vs = generateR2Variants(d).filter((v) => v !== d);
  variantMap.set(d, vs);
  for (const v of vs) variantUrls.add(v);
}

const variantStatus = await runWithConcurrency([...variantUrls], headCheck, CONCURRENCY);
const variantAlive = (u) => {
  const s = variantStatus.get(u);
  return typeof s === "number" && s >= 200 && s < 300;
};

// Build the final resolution map: dead URL → either a working replacement,
// or null (strip the element).
const resolution = new Map();
let canRewrite = 0, mustStrip = 0;
for (const d of dead) {
  const replacement = (variantMap.get(d) || []).find(variantAlive) || null;
  resolution.set(d, replacement);
  if (replacement) canRewrite++; else mustStrip++;
}

console.log(`\n=== Resolution ===`);
console.log(`  Dead URLs                       : ${dead.length}`);
console.log(`  ${DRY_RUN ? "Would rewrite" : "Will rewrite"} to working variant : ${canRewrite}`);
console.log(`  ${DRY_RUN ? "Would strip" : "Will strip"} (no live variant)   : ${mustStrip}`);

// Phase 3 — rewrite each article's content. Track what changed for samples.
let touched = 0, rewriteOps = 0, stripImgOps = 0, stripLightboxOps = 0, stripFigureOps = 0;
const sampleChanges = [];

function sanitiseContent(content, slug) {
  if (!content) return { next: content, changes: [] };
  const changes = [];
  let next = content;

  // Pass A — rewrite img src for dead URLs that have a working variant.
  next = next.replace(TAG_IMG_RE, (tag) => {
    const src = extractSrc(tag);
    if (!src || alive(src)) return tag;
    const repl = resolution.get(src);
    if (repl) {
      rewriteOps++;
      changes.push({ kind: "rewrite-img-src", from: src, to: repl });
      return tag.replace(src, repl);
    }
    stripImgOps++;
    changes.push({ kind: "strip-img", src });
    return "";  // drop the whole <img>
  });

  // Pass B — for Elementor lightbox <a href="DEAD" data-elementor-open-lightbox>…</a>,
  // rewrite the href if a variant works, otherwise unwrap (keep inner content).
  next = next.replace(TAG_LIGHTBOX_RE, (block) => {
    const href = extractHref(block);
    if (!href || alive(href)) return block;
    const repl = resolution.get(href);
    if (repl) {
      rewriteOps++;
      changes.push({ kind: "rewrite-lightbox-href", from: href, to: repl });
      return block.replace(href, repl);
    }
    stripLightboxOps++;
    changes.push({ kind: "strip-lightbox", href });
    return "";  // drop the whole anchor block
  });

  // Pass C — clean up <figure> wrappers that are now empty (or have only
  // whitespace / a stray <figcaption>) after their inner <img> was stripped.
  next = next.replace(TAG_FIGURE_RE, (block) => {
    const inner = block.replace(/<figcaption\b[\s\S]*?<\/figcaption>/gi, "")
                       .replace(/<\/?figure[^>]*>/gi, "")
                       .trim();
    if (inner === "") { stripFigureOps++; changes.push({ kind: "strip-empty-figure" }); return ""; }
    return block;
  });

  // Tidy: collapse runs of whitespace introduced by removals.
  next = next.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");

  return { next, changes };
}

for (const r of rows) {
  const { next, changes } = sanitiseContent(r.content, r.slug);
  if (changes.length === 0 || next === r.content) continue;
  touched++;
  if (sampleChanges.length < 6) sampleChanges.push({ slug: r.slug, title: r.title, changes });
  if (!DRY_RUN) {
    await db.query(
      `UPDATE articles SET content = $1, updated_at = NOW() WHERE id = $2`,
      [next, r.id],
    );
  }
}

console.log(`\n=== Article changes ===`);
console.log(`  Articles ${DRY_RUN ? "that would change" : "updated"}     : ${touched}`);
console.log(`  Total <img src> rewrites          : ${rewriteOps}`);
console.log(`  Total <img> stripped              : ${stripImgOps}`);
console.log(`  Total lightbox <a> stripped       : ${stripLightboxOps}`);
console.log(`  Total empty <figure> cleaned up   : ${stripFigureOps}`);

if (sampleChanges.length) {
  console.log(`\n=== Sample article diffs ===`);
  for (const s of sampleChanges) {
    console.log(`\n  ${s.title}  [/article/${s.slug}]`);
    for (const c of s.changes.slice(0, 6)) {
      if (c.kind === "rewrite-img-src" || c.kind === "rewrite-lightbox-href") {
        console.log(`    ${c.kind}`);
        console.log(`      from: ${c.from}`);
        console.log(`      to  : ${c.to}`);
      } else if (c.kind === "strip-img" || c.kind === "strip-lightbox") {
        console.log(`    ${c.kind}: ${c.src || c.href}`);
      } else {
        console.log(`    ${c.kind}`);
      }
    }
    if (s.changes.length > 6) console.log(`    …and ${s.changes.length - 6} more changes`);
  }
}

await db.end();
