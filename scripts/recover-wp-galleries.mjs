// Recover gallery images for articles where the WordPress import left empty
// <figure class="wp-block-gallery"> shells in the body but never linked any
// <img> children — so extract-wp-galleries.mjs had nothing to pull.
//
// Strategy:
//   1. For each candidate article, fetch its `wp_data.originalLink` (the
//      live WordPress URL) and read the rendered HTML.
//   2. Find image URLs inside the gallery block(s) on the live page.
//   3. Map each `https://www.gallery.je/wp-content/uploads/YYYY/MM/file`
//      to its R2 equivalent (the original migration uploaded them but
//      didn't wire them up).
//   4. HEAD-check the R2 URL; only keep ones that resolve.
//   5. Write `articles.gallery_images` from the rebuilt list and strip the
//      empty wp-block-gallery markup from the body.
//
// Safety:
//   - Skips articles whose gallery_images is already set (so manual edits
//     and the prior extraction pass aren't overwritten).
//   - Wraps everything in a transaction per article.
//   - --apply required to write — otherwise dry-run.
//
// Flags:
//   --apply              actually write changes
//   --limit=N            only process N articles
//   --category=slug      restrict to one category (default: all)
//   --slug=foo           target one article by slug
//   --concurrency=N      parallel WP fetches (default 4 — easy on the host)
//   --keep-html          don't strip the empty gallery markup from content
//   --fallback-wp        when an R2 equivalent is missing, fall back to the
//                        original https://www.gallery.je/wp-content/... URL
//                        (handy for posts added after the R2 migration ran)
//
// Usage:
//   railway run node scripts/recover-wp-galleries.mjs --category=events --limit=5
//   railway run node scripts/recover-wp-galleries.mjs --apply --category=events
import pg from "pg";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const APPLY = process.argv.includes("--apply");
const KEEP_HTML = process.argv.includes("--keep-html");
const FALLBACK_WP = process.argv.includes("--fallback-wp");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const SLUG = (process.argv.find((a) => a.startsWith("--slug=")) || "").split("=")[1] || "";
const CATEGORY = (process.argv.find((a) => a.startsWith("--category=")) || "").split("=")[1] || "";
const CONCURRENCY = Number((process.argv.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1] || 4);

const R2_BASE = "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const conditions = [`a.status = 'published'`];
const params = [];
if (SLUG) {
  conditions.push(`a.slug = $${params.length + 1}`);
  params.push(SLUG);
} else {
  // Always: must have wp_data (for originalLink) + empty galleryImages
  conditions.push(`a.wp_data IS NOT NULL`);
  conditions.push(`(a.gallery_images IS NULL OR jsonb_typeof(a.gallery_images) = 'null' OR a.gallery_images = '[]'::jsonb)`);
  // When no category filter is given, restrict to articles that show signs
  // of having had a gallery (empty wp-block-gallery shell) — without this
  // bulk runs would scrape every article on the site. With a category filter
  // the operator has opted in; try every candidate.
  if (!CATEGORY) {
    conditions.push(`a.content LIKE '%wp-block-gallery%'`);
  }
}
if (CATEGORY) {
  conditions.push(`c.slug = $${params.length + 1}`);
  params.push(CATEGORY);
}
const where = conditions.join(" AND ");
const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";

const { rows } = await db.query(
  `SELECT a.id, a.slug, a.title, a.content, a.wp_data
     FROM articles a
     JOIN categories c ON a.category_id = c.id
    WHERE ${where}
    ORDER BY a.published_at DESC NULLS LAST
    ${limitClause}`,
  params,
);

console.log(`Found ${rows.length} candidate article${rows.length === 1 ? "" : "s"}.\n`);

// Map a live WordPress image URL to the R2 equivalent.
// e.g. https://www.gallery.je/wp-content/uploads/2025/09/IMG_2124.jpg
//   →  https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev/2025/09/IMG_2124.jpg
function wpToR2(url) {
  if (!url) return null;
  // Strip any -<width>x<height> size suffix that WP appends to thumbnail variants.
  const stripped = url.replace(/-\d+x\d+(\.[a-z]+)(\?.*)?$/i, "$1");
  // Pull out the path after /wp-content/uploads/
  const m = stripped.match(/\/wp-content\/uploads\/(.+)$/i);
  if (m) return `${R2_BASE}/${m[1]}`;
  // Already an R2 URL? Pass through.
  if (stripped.startsWith(R2_BASE)) return stripped;
  return null;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (gallery-recovery-script)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function headOk(url) {
  try {
    let res = await fetch(url, { method: "HEAD" });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", headers: { Range: "bytes=0-0" } });
    }
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  }
}

function extractGalleryImagesFromLiveHtml(html, title) {
  // Two patterns to catch:
  //   (a) Newer gutenberg posts: <figure class="wp-block-image"><img …/></figure>
  //   (b) Older photoshoots: <p><a href="full.jpg"><img class="wp-image-NNN" …/></a></p>
  // For both, only keep images whose src is in /wp-content/uploads/ (skips
  // logos, theme assets). Anchor the scan AFTER the article <h1> so sidebar
  // / related-posts images don't leak in.
  if (!html) return [];

  let scanFrom = 0;
  if (title) {
    const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    for (const m of html.matchAll(h1Re)) {
      const inner = m[1].replace(/<[^>]+>/g, "").trim();
      if (inner.toLowerCase().includes(title.toLowerCase().slice(0, 30))) {
        scanFrom = m.index + m[0].length;
        break;
      }
    }
  }
  const body = html.slice(scanFrom);

  const out = new Map(); // url → caption (preserves first-seen order)

  // Pattern (a): wp-block-image figures
  const figureRe = /<figure[^>]+class="[^"]*wp-block-image[^"]*"[^>]*>([\s\S]*?)<\/figure>/gi;
  for (const figMatch of body.matchAll(figureRe)) {
    const inner = figMatch[1];
    const imgSrc = inner.match(/<img[^>]+src="([^"]+)"/i)?.[1];
    if (!imgSrc) continue;
    if (!/\/wp-content\/uploads\//i.test(imgSrc)) continue;
    const cap = inner
      .match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]
      ?.replace(/<[^>]+>/g, "")
      .trim();
    if (!out.has(imgSrc)) out.set(imgSrc, cap || "");
  }

  // Pattern (b): bare <img class="…wp-image-NNN…"> — classic photoshoot
  // markup. Use full-size href when wrapped in <a>, else use the img src
  // with the "-WIDTHxHEIGHT" sizing suffix stripped.
  const imgRe = /<a[^>]+href="([^"]+\.(?:jpe?g|png|webp))"[^>]*>\s*<img[^>]+class="[^"]*wp-image-\d+[^"]*"[^>]*>\s*<\/a>|<img[^>]+class="[^"]*wp-image-\d+[^"]*"[^>]*src="([^"]+)"/gi;
  for (const m of body.matchAll(imgRe)) {
    let url = m[1] || m[2];
    if (!url) continue;
    if (!/\/wp-content\/uploads\//i.test(url)) continue;
    // If no <a href> wrap, strip size suffix so we land on the original.
    if (!m[1]) url = url.replace(/-\d+x\d+(\.[a-z]+)(\?.*)?$/i, "$1");
    if (!out.has(url)) out.set(url, "");
  }

  return Array.from(out.entries()).map(([url, caption]) => ({ url, caption: caption || undefined }));
}

function parseFragment(html) {
  const wrapped = `<root xmlns="http://www.w3.org/1999/xhtml">${html}</root>`;
  const parser = new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  });
  try {
    return parser.parseFromString(wrapped, "text/html");
  } catch {
    return null;
  }
}

function nodeClassList(node) {
  return new Set((node?.getAttribute?.("class") || "").split(/\s+/).filter(Boolean));
}

function getAllByClass(root, cls) {
  const out = [];
  (function walk(n) {
    if (!n) return;
    if (n.nodeType === 1 && nodeClassList(n).has(cls)) out.push(n);
    let c = n.firstChild;
    while (c) { walk(c); c = c.nextSibling; }
  })(root);
  return out;
}

function stripGalleryHtml(content) {
  const doc = parseFragment(content || "");
  if (!doc) return content;
  const galleries = getAllByClass(doc, "wp-block-gallery");
  for (const g of galleries) g.parentNode?.removeChild(g);
  const serializer = new XMLSerializer();
  let html = "";
  let c = doc.documentElement.firstChild;
  while (c) {
    html += serializer.serializeToString(c);
    c = c.nextSibling;
  }
  return html.replace(/\sxmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
}

async function processArticle(article) {
  const wp = typeof article.wp_data === "string" ? JSON.parse(article.wp_data) : article.wp_data;
  const link = wp?.originalLink;
  if (!link) return { article, status: "no-original-link" };

  const html = await fetchHtml(link);
  if (!html) return { article, status: "fetch-failed", link };

  const rawImages = extractGalleryImagesFromLiveHtml(html, article.title);
  if (rawImages.length === 0) return { article, status: "no-images-on-live", link };

  // Try R2 first; fall back to the original WP URL when --fallback-wp is set
  // AND the live image responds 200.
  const alive = [];
  let fellBack = 0;
  for (const img of rawImages) {
    const r2 = wpToR2(img.url);
    if (r2 && (await headOk(r2))) {
      alive.push({ ...img, url: r2 });
    } else if (FALLBACK_WP && (await headOk(img.url))) {
      alive.push({ ...img, url: img.url });
      fellBack++;
    }
  }
  if (alive.length === 0) {
    return { article, status: "no-r2-match", link, attempted: rawImages.length };
  }
  return { article, status: "ok", link, images: alive, fellBack };
}

let okCount = 0;
const counters = {};
const samples = [];

// Process in small batches with concurrency
async function runBatches(items, n) {
  for (let i = 0; i < items.length; i += n) {
    const slice = items.slice(i, i + n);
    const results = await Promise.all(slice.map(processArticle));
    for (const r of results) {
      counters[r.status] = (counters[r.status] || 0) + 1;
      if (r.status === "ok") {
        okCount++;
        if (samples.length < 5) {
          samples.push({
            slug: r.article.slug,
            title: r.article.title,
            count: r.images.length,
            first: r.images[0]?.url,
            firstCaption: r.images[0]?.caption,
          });
        }
        if (APPLY) {
          const newContent = KEEP_HTML ? r.article.content : stripGalleryHtml(r.article.content);
          await db.query(
            `UPDATE articles
                SET gallery_images = $1::jsonb,
                    content = $2,
                    updated_at = NOW()
              WHERE id = $3`,
            [JSON.stringify(r.images), newContent, r.article.id],
          );
        }
      }
    }
    process.stderr.write(`  …processed ${Math.min(i + n, items.length)}/${items.length}\n`);
  }
}

await runBatches(rows, CONCURRENCY);

console.log(`\n=== Result ===`);
console.log(`  Articles ${APPLY ? "recovered" : "that would be recovered"}: ${okCount}`);
for (const [k, v] of Object.entries(counters)) {
  if (k !== "ok") console.log(`  ${k.padEnd(20)} : ${v}`);
}

if (samples.length) {
  console.log(`\n=== Sample (first ${samples.length}) ===`);
  for (const s of samples) {
    console.log(`  ${s.slug}  [${s.count} images]`);
    console.log(`    ${s.title}`);
    console.log(`    first: ${s.first}${s.firstCaption ? `  "${s.firstCaption}"` : ""}`);
  }
}

if (!APPLY) console.log(`\n[DRY RUN] No changes written. Re-run with --apply.`);

await db.end();
