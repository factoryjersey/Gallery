#!/usr/bin/env tsx
/**
 * Promote inline body images on a single article to the structured
 * galleryImages array, strip them from the body HTML, and set
 * gallery_layout = 'full-width-masonry' so they render as a full-bleed
 * masonry below the text.
 *
 * Flow (preview with --dry-run first):
 *   1. Find the article by slug (or --id=<uuid>).
 *   2. Extract every <img src="…"> URL from article.content, in order.
 *   3. Append those URLs to the existing galleryImages (de-duped).
 *   4. Rewrite article.content with every <img> (and its <figure> /
 *      <a> wrapper, and any <p> that becomes empty as a result)
 *      stripped so the images don't appear twice on the article page.
 *   5. Set gallery_layout = 'full-width-masonry'.
 *
 * Usage:
 *   railway run npx tsx scripts/promote-inline-gallery.ts <slug> [--dry-run]
 *   railway run npx tsx scripts/promote-inline-gallery.ts --id=<uuid> [--dry-run]
 *
 * Safe to rerun — a second run finds no inline images and reports
 * "nothing to do". If you want to roll back:
 *   railway run npx tsx scripts/set-gallery-layout.ts <slug> auto
 * (but the body copy edit is not reversible via the script — editor
 * would need to re-paste from the original source).
 */

import pg from "pg";

function localFriendlyDatabaseUrl(raw: string): string {
  const isSupabase = /supabase\.(com|co)/i.test(raw);
  let parsed: URL | null = null;
  try { parsed = new URL(raw); } catch { return raw; }
  if (isSupabase && parsed.port === "5432") {
    parsed.port = "6543";
    return parsed.toString();
  }
  return raw;
}

const DRY_RUN = process.argv.includes("--dry-run");
const idArg = process.argv.find((a) => a.startsWith("--id="))?.split("=")[1];
const slugArg = process.argv.find((a) => !a.startsWith("-") && !a.endsWith("promote-inline-gallery.ts") && a !== process.argv[0] && a !== process.argv[1]);

if (!idArg && !slugArg) {
  console.error("Usage: promote-inline-gallery.ts <slug> [--dry-run]");
  console.error("   or: promote-inline-gallery.ts --id=<uuid> [--dry-run]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}

// Extract image srcs in document order. Tolerates single/double quotes
// and extra attributes before/after src.
const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

// Custom TipTap "gallery" block the admin editor emits: a <div> with
// the images encoded as HTML-escaped JSON in a data-images attribute.
// Looks like: <div data-images="[{&quot;url&quot;:&quot;…&quot;}]">…</div>
const DATA_IMAGES_RE = /<div\b[^>]*\bdata-images\s*=\s*"([^"]*)"[^>]*>[\s\S]*?<\/div>/gi;

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Parse the data-images attribute into an array of {url, caption?}. */
function parseDataImages(escaped: string): Array<{ url: string; caption?: string }> {
  try {
    const parsed = JSON.parse(decodeHtmlEntities(escaped));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((p: any) => (p && typeof p === "object" && typeof p.url === "string"
        ? { url: p.url, ...(typeof p.caption === "string" ? { caption: p.caption } : {}) }
        : null))
      .filter((x): x is { url: string; caption?: string } => x !== null);
  } catch {
    return [];
  }
}

// After collecting URLs, these patterns strip the source elements so
// the images don't render twice. Applied in order so nested wrappers
// collapse cleanly.
function stripImagesFromHtml(html: string): string {
  let out = html;
  // 0. Custom <div data-images="…">…</div> gallery blocks — drop whole.
  out = out.replace(DATA_IMAGES_RE, "");
  // 1. <figure>…<img…>…</figure> — figure wrappers around a single img
  //    (and optional <figcaption>). Drop the whole figure.
  out = out.replace(
    /<figure\b[^>]*>[\s\S]*?<img\b[^>]*>[\s\S]*?<\/figure>/gi,
    "",
  );
  // 2. <a …><img…></a> — Elementor-style lightbox anchor wrappers.
  out = out.replace(
    /<a\b[^>]*>\s*<img\b[^>]*>\s*<\/a>/gi,
    "",
  );
  // 3. <p>…<img…>…</p> — paragraph that's effectively just an image
  //    plus whitespace. Collapse the whole paragraph.
  out = out.replace(
    /<p\b[^>]*>\s*(?:<br\s*\/?>\s*)*<img\b[^>]*>\s*(?:<br\s*\/?>\s*)*<\/p>/gi,
    "",
  );
  // 4. Any remaining standalone <img>.
  out = out.replace(/<img\b[^>]*>/gi, "");
  // 5. Clean up empty <p></p> and runs of blank lines left behind.
  out = out.replace(/<p>\s*<\/p>/gi, "");
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim();
}

const pool = new pg.Pool({
  connectionString: localFriendlyDatabaseUrl(process.env.DATABASE_URL),
  idleTimeoutMillis: 10_000,
  max: 2,
});

const where = idArg ? "a.id = $1" : "a.slug = $1";
const param = idArg ?? slugArg;
const res = await pool.query<{
  id: string;
  slug: string;
  title: string;
  content: string;
  gallery_images: Array<{ url: string; caption?: string }> | null;
  gallery_layout: string | null;
  category_slug: string | null;
}>(
  `SELECT a.id, a.slug, a.title, a.content, a.gallery_images, a.gallery_layout,
          c.slug AS category_slug
     FROM articles a
     LEFT JOIN categories c ON c.id = a.category_id
    WHERE ${where}
    LIMIT 1`,
  [param],
);
if (res.rows.length === 0) {
  console.error(`No article found with ${idArg ? "id" : "slug"} = ${param}`);
  await pool.end();
  process.exit(1);
}
const article = res.rows[0];

// Collect every image reference from the body, in document order,
// across both shapes:
//   - TipTap inline-gallery block: <div data-images="[{url,caption?}…]">
//     The editor's "Add images" tool emits these.
//   - Raw <img src="…"> tags: legacy / imported WordPress content.
// Dedupe by URL. Skip data: URIs (base64 placeholders).
const collected: Array<{ url: string; caption?: string }> = [];
const seen = new Set<string>();
function addItem(item: { url: string; caption?: string }) {
  const url = item.url?.trim();
  if (!url || url.startsWith("data:")) return;
  if (seen.has(url)) return;
  seen.add(url);
  collected.push({ url, ...(item.caption ? { caption: item.caption } : {}) });
}

// Pass 1: TipTap gallery blocks.
let dm: RegExpExecArray | null;
let galleryBlocks = 0;
while ((dm = DATA_IMAGES_RE.exec(article.content)) !== null) {
  galleryBlocks++;
  for (const img of parseDataImages(dm[1])) addItem(img);
}

// Pass 2: raw <img> tags.
let m: RegExpExecArray | null;
let rawImgs = 0;
while ((m = IMG_SRC_RE.exec(article.content)) !== null) {
  rawImgs++;
  addItem({ url: m[1] });
}

console.log(`Article: "${article.title}" (/${article.slug}, ${article.category_slug ?? "no category"})`);
console.log(`  Current gallery_layout: ${article.gallery_layout ?? "(null — default)"}`);
console.log(`  Existing galleryImages: ${(article.gallery_images ?? []).length}`);
console.log(`  TipTap gallery blocks:  ${galleryBlocks}`);
console.log(`  Raw <img> tags:         ${rawImgs}`);
console.log(`  Unique images found:    ${collected.length}`);

if (collected.length === 0) {
  // No inline images to move, but the article may already have the
  // 15/67/whatever images in galleryImages (legacy WordPress imports
  // store them there with just a placeholder <!-- wp:gallery -->
  // marker in the body). In that case there's nothing to transform
  // — we just need to flip the layout flag so the article page uses
  // the full-width-masonry treatment. Idempotent: if the flag is
  // already set, we exit cleanly without a write.
  const already = (article.gallery_images ?? []).length;
  if (already === 0) {
    console.log("Nothing to do — article has no gallery images at all.");
    await pool.end();
    process.exit(0);
  }
  if (article.gallery_layout === "full-width-masonry") {
    console.log(`Nothing to do — ${already} image(s) already in galleryImages and layout is already full-width-masonry.`);
    await pool.end();
    process.exit(0);
  }
  console.log(`No inline images to move, but ${already} image(s) already in galleryImages. Flipping gallery_layout → full-width-masonry.`);
  if (DRY_RUN) {
    console.log("\n(dry run — no writes)");
    await pool.end();
    process.exit(0);
  }
  await pool.query(
    `UPDATE articles SET gallery_layout = 'full-width-masonry', updated_at = NOW() WHERE id = $1`,
    [article.id],
  );
  console.log(`\n✓ Updated. View: https://gallery.je/article/${article.slug}`);
  await pool.end();
  process.exit(0);
}

// Merge: existing galleryImages first, then any new inline ones that
// aren't already present. Preserves existing captions on the existing
// entries; inline-promoted entries keep whatever caption came with
// them in the TipTap block (or no caption for raw <img>).
const existingUrls = new Set((article.gallery_images ?? []).map((g) => g.url));
const additions = collected.filter((img) => !existingUrls.has(img.url));
const newGalleryImages = [...(article.gallery_images ?? []), ...additions];

const newContent = stripImagesFromHtml(article.content);

console.log(`  → galleryImages becomes: ${newGalleryImages.length} (${additions.length} added)`);
console.log(`  → gallery_layout becomes: full-width-masonry`);
console.log(`  → body content shrinks: ${article.content.length} → ${newContent.length} chars`);

if (DRY_RUN) {
  console.log("\n(dry run — no writes)");
  console.log("First 3 image URLs that would move:");
  collected.slice(0, 3).forEach((item) => console.log(`  - ${item.url}`));
  await pool.end();
  process.exit(0);
}

await pool.query(
  `UPDATE articles
      SET gallery_images = $1::jsonb,
          content = $2,
          gallery_layout = 'full-width-masonry',
          updated_at = NOW()
    WHERE id = $3`,
  [JSON.stringify(newGalleryImages), newContent, article.id],
);
console.log(`\n✓ Updated. View: https://gallery.je/article/${article.slug}`);
await pool.end();
