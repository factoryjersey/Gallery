#!/usr/bin/env node
/**
 * Rewrite WordPress-hosted image URLs to their R2 equivalents across
 * every article's gallery_images + featured_image.
 *
 * Backstory: the WP importer / gallery recovery pass sometimes wrote
 * URLs like https://www.gallery.je/wp-content/uploads/2026/04/IMG.jpg
 * to the DB even when the file had already been uploaded to R2. Those
 * URLs currently render because the old WP infra still serves them,
 * but they'll break the day gallery.je stops proxying /wp-content.
 * This script rewrites every such URL to its R2 twin where R2 has it.
 *
 * Resolution strategy per WP URL (tried in order, first HEAD-check
 * success wins):
 *   1. Drop /uploads from the path: /wp-content/uploads/2026/04/x.jpg
 *      → r2:/wp-content/2026/04/x.jpg
 *   2. Category-scoped prefix using the article's category slug
 *      (e.g. paparazzi/x.jpg, events/x.jpg, fashion-shoots/x.jpg).
 *   3. Basename at root of the r2 bucket (uploads/x.jpg,
 *      wp-content/x.jpg, x.jpg).
 * Nothing writes if we can't find the file — the URL stays as it was.
 *
 * Flags:
 *   --dry-run            preview only, no writes
 *   --concurrency=N      parallel HEAD requests (default 16)
 *   --article=<id>       restrict to a single article id (useful when
 *                        testing the strategy against a known case)
 *   --only-featured      only sweep featured_image, skip gallery_images
 *   --only-gallery       only sweep gallery_images, skip featured_image
 *
 * Usage:
 *   railway run node scripts/rewrite-wp-gallery-urls.mjs --dry-run
 *   railway run node scripts/rewrite-wp-gallery-urls.mjs --concurrency=32
 */
import pg from "pg";

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const has = (name) => args.includes(`--${name}`);

const DRY_RUN = has("dry-run");
const CONCURRENCY = parseInt(flag("concurrency", "16"), 10);
const ONLY_ARTICLE = flag("article");
const ONLY_FEATURED = has("only-featured");
const ONLY_GALLERY = has("only-gallery");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}

const R2_BASE =
  (process.env.R2_PUBLIC_URL || "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev").replace(/\/$/, "");

// A URL is "WP-hosted" if it points at gallery.je's /wp-content/ tree.
// We deliberately don't touch other origins — leave third-party embeds
// alone.
const WP_PATTERN = /^https?:\/\/(?:www\.)?gallery\.je\/wp-content\//i;

function isWpUrl(url) {
  return typeof url === "string" && WP_PATTERN.test(url);
}

/** Cache HEAD results — many articles share the same underlying images. */
const headCache = new Map();
async function headCheck(url) {
  if (headCache.has(url)) return headCache.get(url);
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    const ok = res.ok;
    headCache.set(url, ok);
    return ok;
  } catch {
    headCache.set(url, false);
    return false;
  }
}

/**
 * Build R2 candidates for a given WP URL, honouring the article's
 * category so we try the right scoped folder before the wide-open
 * fallbacks. Returns strings in try-order.
 */
function candidates(wpUrl, categorySlug) {
  const path = new URL(wpUrl).pathname;
  const basename = path.split("/").pop();
  const dropUploads = path.replace(/^\/wp-content\/uploads\//, "/wp-content/");
  const out = new Set();
  out.add(R2_BASE + dropUploads);
  if (categorySlug) out.add(`${R2_BASE}/${categorySlug}/${basename}`);
  // Common R2 landing prefixes for legacy back-catalogue uploads.
  out.add(`${R2_BASE}/uploads${dropUploads.replace(/^\/wp-content/, "")}`);
  out.add(`${R2_BASE}/paparazzi/${basename}`);
  out.add(`${R2_BASE}/events/${basename}`);
  out.add(`${R2_BASE}/fashion-shoots/${basename}`);
  out.add(`${R2_BASE}/${basename}`);
  return [...out];
}

async function resolveOnR2(wpUrl, categorySlug) {
  for (const c of candidates(wpUrl, categorySlug)) {
    if (await headCheck(c)) return c;
  }
  return null;
}

// ---- Run --------------------------------------------------------------

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const rows = await db
  .query(
    ONLY_ARTICLE
      ? `
        SELECT a.id, a.slug, a.featured_image, a.gallery_images, c.slug AS category_slug
          FROM articles a
          LEFT JOIN categories c ON c.id = a.category_id
         WHERE a.id = $1
      `
      : `
        SELECT a.id, a.slug, a.featured_image, a.gallery_images, c.slug AS category_slug
          FROM articles a
          LEFT JOIN categories c ON c.id = a.category_id
         WHERE (a.featured_image ~* $1)
            OR (a.gallery_images::text ~* $1)
      `,
    ONLY_ARTICLE ? [ONLY_ARTICLE] : ["gallery\\.je/wp-content"],
  )
  .then((r) => r.rows);

console.log(`Scanning ${rows.length} article${rows.length === 1 ? "" : "s"}${DRY_RUN ? " (dry run)" : ""}`);
console.log(`Concurrency: ${CONCURRENCY}  R2 base: ${R2_BASE}`);

let articlesUpdated = 0;
let galleryRewrites = 0;
let featuredRewrites = 0;
let stillMissing = 0;

// Simple concurrency gate — cap the number of in-flight HEAD checks so
// we don't accidentally DDoS ourselves. Each article's own image list
// runs sequentially inside its slot; the parallelism is *across*
// articles.
async function pool(items, worker, size) {
  const iter = items[Symbol.iterator]();
  const workers = Array.from({ length: size }, async () => {
    for (const it of iter) {
      await worker(it);
    }
  });
  await Promise.all(workers);
}

await pool(
  rows,
  async (row) => {
    const gallery = Array.isArray(row.gallery_images)
      ? row.gallery_images
      : typeof row.gallery_images === "string"
        ? (() => {
            try {
              return JSON.parse(row.gallery_images);
            } catch {
              return null;
            }
          })()
        : row.gallery_images;

    let nextFeatured = row.featured_image;
    let nextGallery = gallery;
    let touched = false;

    // Featured image
    if (!ONLY_GALLERY && isWpUrl(row.featured_image)) {
      const r2 = await resolveOnR2(row.featured_image, row.category_slug);
      if (r2) {
        nextFeatured = r2;
        featuredRewrites++;
        touched = true;
      } else {
        stillMissing++;
        console.log(`  · ${row.slug}: featured missing on R2 — ${row.featured_image}`);
      }
    }

    // Gallery images
    if (!ONLY_FEATURED && Array.isArray(gallery) && gallery.length > 0) {
      const rewritten = [];
      let changedInGallery = false;
      for (const item of gallery) {
        if (item && typeof item === "object" && isWpUrl(item.url)) {
          const r2 = await resolveOnR2(item.url, row.category_slug);
          if (r2) {
            rewritten.push({ ...item, url: r2 });
            galleryRewrites++;
            changedInGallery = true;
          } else {
            rewritten.push(item);
            stillMissing++;
            console.log(`  · ${row.slug}: gallery missing on R2 — ${item.url}`);
          }
        } else {
          rewritten.push(item);
        }
      }
      if (changedInGallery) {
        nextGallery = rewritten;
        touched = true;
      }
    }

    if (!touched) return;
    articlesUpdated++;
    if (DRY_RUN) {
      console.log(`[dry] would update ${row.slug} (${row.id})`);
      return;
    }
    await db.query(
      `
      UPDATE articles
         SET featured_image = $1,
             gallery_images = $2::jsonb,
             updated_at     = NOW()
       WHERE id = $3
      `,
      [nextFeatured, JSON.stringify(nextGallery), row.id],
    );
    console.log(`updated ${row.slug}`);
  },
  CONCURRENCY,
);

console.log(
  `\nDone. articles=${articlesUpdated} featuredRewrites=${featuredRewrites} galleryRewrites=${galleryRewrites} stillMissing=${stillMissing}${DRY_RUN ? " (dry run)" : ""}`,
);
await db.end();
