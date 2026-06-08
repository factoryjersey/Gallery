// Convert WordPress gallery blocks embedded in article HTML into the new
// per-article `gallery_images` JSON column + drop the inline gallery HTML
// so the article page doesn't render the same images twice (once as a
// carousel above the body, once inline below).
//
// What this targets:
//   <figure class="wp-block-gallery">…<figure class="wp-block-image"><img …/></figure>… </figure>
//   <ul class="wp-block-gallery">…<li><figure><img …/></figure></li>…</ul>
//
// Per-image captions are read from <figcaption> when present.
//
// Safety:
//   - Skips any article whose gallery_images is already set (so manual
//     curation in /admin is never overwritten).
//   - wp_data on the article preserves the original WP payload — the
//     transform is recoverable if needed.
//   - --dry-run by default printable summary; --apply to write.
//
// Flags:
//   --apply            write changes (otherwise dry-run)
//   --limit=N          only process N matching articles
//   --slug=foo         only process the article with this slug
//   --keep-html        DO NOT strip the original gallery HTML from content
//                      (only populate gallery_images)
//
// Usage:
//   railway run node scripts/extract-wp-galleries.mjs              # dry-run
//   railway run node scripts/extract-wp-galleries.mjs --apply
import pg from "pg";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const APPLY = process.argv.includes("--apply");
const KEEP_HTML = process.argv.includes("--keep-html");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const SLUG_FILTER = (process.argv.find((a) => a.startsWith("--slug=")) || "").split("=")[1] || "";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Pull every candidate. The wp-block-gallery / wp-block-image markers cover
// the WordPress gutenberg gallery blocks. We DON'T touch wp-block-image
// outside a gallery wrapper — those stay inline in the body.
const filter = SLUG_FILTER
  ? `AND slug = $1`
  : `AND content LIKE '%wp-block-gallery%' AND (gallery_images IS NULL OR jsonb_typeof(gallery_images) = 'null' OR gallery_images = '[]'::jsonb)`;
const params = SLUG_FILTER ? [SLUG_FILTER] : [];
const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";

const { rows } = await db.query(
  `SELECT id, slug, title, content
     FROM articles
    WHERE status = 'published'
      ${filter}
    ORDER BY published_at DESC NULLS LAST
    ${limitClause}`,
  params,
);

console.log(`Found ${rows.length} candidate article${rows.length === 1 ? "" : "s"}.\n`);

// Wrap input so xmldom can parse fragments cleanly (it's strict about
// document-level structure).
function parseFragment(html) {
  const wrapped = `<root xmlns="http://www.w3.org/1999/xhtml">${html}</root>`;
  // Silence noisy warnings; we know WP HTML isn't well-formed XML.
  const parser = new DOMParser({
    locator: {},
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  });
  try {
    const doc = parser.parseFromString(wrapped, "text/html");
    return doc;
  } catch {
    return null;
  }
}

function nodeClassList(node) {
  const cls = node?.getAttribute?.("class") || "";
  return new Set(cls.split(/\s+/).filter(Boolean));
}

function getAllByClass(root, cls) {
  // xmldom doesn't implement getElementsByClassName — walk and filter.
  const out = [];
  function walk(n) {
    if (!n) return;
    if (n.nodeType === 1 && nodeClassList(n).has(cls)) out.push(n);
    let c = n.firstChild;
    while (c) { walk(c); c = c.nextSibling; }
  }
  walk(root);
  return out;
}

function textOf(node) {
  if (!node) return "";
  let t = "";
  function walk(n) {
    if (!n) return;
    if (n.nodeType === 3) t += n.nodeValue || "";
    let c = n.firstChild;
    while (c) { walk(c); c = c.nextSibling; }
  }
  walk(node);
  return t.replace(/\s+/g, " ").trim();
}

function firstChildFigcaption(node) {
  // Direct <figcaption> child only — not deeper ones that belong to nested
  // <figure> blocks.
  let c = node?.firstChild;
  while (c) {
    if (c.nodeType === 1 && c.tagName.toLowerCase() === "figcaption") return c;
    c = c.nextSibling;
  }
  return null;
}

function extractGalleryFromNode(galleryNode) {
  // For each <img> inside the gallery, pair with the nearest enclosing
  // <figure>'s direct <figcaption>.
  const out = [];
  const imgs = [];
  function walkImgs(n) {
    if (!n) return;
    if (n.nodeType === 1 && n.tagName.toLowerCase() === "img") imgs.push(n);
    let c = n.firstChild;
    while (c) { walkImgs(c); c = c.nextSibling; }
  }
  walkImgs(galleryNode);

  for (const img of imgs) {
    const src = img.getAttribute("src") || "";
    if (!src) continue;
    // Find caption from the nearest figure ancestor that's INSIDE the gallery
    let cap = "";
    let p = img.parentNode;
    while (p && p !== galleryNode) {
      if (p.nodeType === 1 && p.tagName.toLowerCase() === "figure") {
        const fc = firstChildFigcaption(p);
        if (fc) { cap = textOf(fc); break; }
      }
      p = p.parentNode;
    }
    // Also try the alt text as a fallback caption source
    if (!cap) {
      const alt = (img.getAttribute("alt") || "").trim();
      // Only use alt if it doesn't look like an autogenerated filename
      if (alt && !/^(image|img|dsc|p\d{6,}|screenshot)/i.test(alt) && alt.length > 3) {
        cap = alt;
      }
    }
    out.push(cap ? { url: src, caption: cap } : { url: src });
  }
  return out;
}

function serializeContent(doc) {
  // Pull contents back out of the <root> wrapper.
  const serializer = new XMLSerializer();
  const root = doc.documentElement;
  let html = "";
  let c = root?.firstChild;
  while (c) {
    html += serializer.serializeToString(c);
    c = c.nextSibling;
  }
  // xmldom sometimes injects xmlns attrs; strip the redundant xhtml ones.
  html = html.replace(/\sxmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
  return html;
}

let extracted = 0;
let wouldStrip = 0;
const skipReasons = { parseFailed: 0, noGalleryNode: 0, noImagesInGallery: 0 };
const samples = [];

for (const article of rows) {
  const doc = parseFragment(article.content || "");
  if (!doc) { skipReasons.parseFailed++; continue; }

  const galleries = getAllByClass(doc, "wp-block-gallery");
  if (galleries.length === 0) { skipReasons.noGalleryNode++; continue; }

  const all = [];
  for (const g of galleries) {
    all.push(...extractGalleryFromNode(g));
  }
  if (all.length === 0) { skipReasons.noImagesInGallery++; continue; }

  // De-dupe by URL while preserving order
  const seen = new Set();
  const cleaned = [];
  for (const item of all) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    cleaned.push(item);
  }

  let newContent = article.content;
  if (!KEEP_HTML) {
    // Remove the gallery nodes from the parsed doc and re-serialize.
    for (const g of galleries) {
      g.parentNode?.removeChild(g);
    }
    newContent = serializeContent(doc);
    wouldStrip++;
  }

  extracted++;
  if (samples.length < 5) {
    samples.push({
      slug: article.slug,
      title: article.title,
      count: cleaned.length,
      firstUrl: cleaned[0]?.url,
      firstCaption: cleaned[0]?.caption,
    });
  }

  if (APPLY) {
    await db.query(
      `UPDATE articles
          SET gallery_images = $1::jsonb,
              content = $2,
              updated_at = NOW()
        WHERE id = $3`,
      [JSON.stringify(cleaned), newContent, article.id],
    );
  }
}

console.log(`\n=== Result ===`);
console.log(`  Articles scanned                       : ${rows.length}`);
console.log(`  Articles ${APPLY ? "updated" : "that would be updated"}: ${extracted}`);
console.log(`  ${KEEP_HTML ? "(--keep-html — gallery HTML left in body)" : `Gallery HTML ${APPLY ? "stripped from" : "would be stripped from"} body: ${wouldStrip}`}`);
console.log(`  Skipped — parse failed                  : ${skipReasons.parseFailed}`);
console.log(`  Skipped — no wp-block-gallery node      : ${skipReasons.noGalleryNode}`);
console.log(`  Skipped — gallery node had no <img>     : ${skipReasons.noImagesInGallery}`);

if (samples.length) {
  console.log(`\n=== Sample (first ${samples.length}) ===`);
  for (const s of samples) {
    console.log(`  ${s.slug}  [${s.count} images]`);
    console.log(`    ${s.title}`);
    console.log(`    first: ${s.firstUrl}${s.firstCaption ? `  "${s.firstCaption}"` : ""}`);
  }
}

if (!APPLY) console.log(`\n[DRY RUN] No changes written. Re-run with --apply to commit.`);

await db.end();
