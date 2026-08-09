#!/usr/bin/env tsx
/**
 * Batch PDF ingest — walks a range of issues, extracts photo sections
 * (fashion / events / paparazzi / portfolios by default) via Claude,
 * pulls the images with pdfimages, and lands each section as a draft
 * article automatically. Skips main features by default (those still
 * benefit from editor review since the text quality varies).
 *
 * Runtime is roughly 2-3 minutes per issue (Claude + image extraction),
 * so 100 issues ~= 4-5 hours. Log progress line per issue so the editor
 * can leave it running and check back. Idempotent-ish: it'll happily
 * re-run over issues that already have drafts (server auto-suffixes
 * the slug on collision), but you'll get duplicates. Use --skip-if-any
 * to skip issues that already have any article filed against them.
 *
 * Usage:
 *   railway run tsx scripts/pdf-batch-ingest.ts --from=1 --to=100
 *   railway run tsx scripts/pdf-batch-ingest.ts --from=1 --to=10 --dry-run
 *   railway run tsx scripts/pdf-batch-ingest.ts --from=50 --to=100 \
 *     --types=fashion_shoot,event --skip-if-any
 *
 * Flags:
 *   --from=N           first issue number (default: 1)
 *   --to=M             last issue number, inclusive (default: 100)
 *   --types=a,b,c      comma-separated photo section types to import
 *                      (default: fashion_shoot,event,paparazzi,portfolio)
 *   --skip-if-any      skip issues that already have any article filed
 *                      against them (prevents accidental duplicates on
 *                      re-runs)
 *   --dry-run          walk everything, log what WOULD be created, but
 *                      don't write to DB or upload to R2
 *
 * Env required (all injected by `railway run`):
 *   DATABASE_URL, ANTHROPIC_API_KEY, R2_BUCKET_NAME,
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID
 */

import pg from "pg";
import { ingestPdf, type PhotoSectionType } from "../server/pdfIngest";
import { extractImagesFromPageRange } from "../server/pdfImages";

// --- flags ---
const flag = (name: string, fallback?: string): string | undefined => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const has = (name: string): boolean => process.argv.includes(`--${name}`);

const FROM = parseInt(flag("from", "1")!, 10);
const TO = parseInt(flag("to", "100")!, 10);
const DRY_RUN = has("dry-run");
const SKIP_IF_ANY = has("skip-if-any");
const TYPES = (flag("types", "fashion_shoot,event,paparazzi,portfolio")!
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as PhotoSectionType[]);

if (!Number.isInteger(FROM) || !Number.isInteger(TO) || FROM < 1 || TO < FROM) {
  console.error(`Invalid --from / --to: ${FROM} → ${TO}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY.");
  process.exit(1);
}

console.log(
  `\nBatch PDF ingest — issues ${FROM}–${TO}, types: ${TYPES.join(", ")}${
    DRY_RUN ? " (dry run)" : ""
  }${SKIP_IF_ANY ? ", skipping issues with any existing article" : ""}\n`,
);

// --- Category + author lookups (shared across all issues) --------------

const PHOTO_SECTION_MAP: Record<
  PhotoSectionType,
  { categorySlug: string; contentType: "article" | "photoshoot"; typeLabel: string }
> = {
  fashion_shoot: {
    categorySlug: "fashion-shoots",
    contentType: "photoshoot",
    typeLabel: "Fashion shoot",
  },
  event: { categorySlug: "events", contentType: "article", typeLabel: "Event" },
  paparazzi: { categorySlug: "paparazzi", contentType: "article", typeLabel: "Paparazzi" },
  portfolio: { categorySlug: "culture", contentType: "photoshoot", typeLabel: "Portfolio" },
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Fetch categories + a default author id up-front — we use the same for
// every draft this batch creates.
const catsRes = await db.query<{ id: string; slug: string }>(
  `SELECT id, slug FROM categories`,
);
const categoryBySlug = new Map(catsRes.rows.map((r) => [r.slug, r.id]));
function categoryIdForType(type: PhotoSectionType): string | null {
  const meta = PHOTO_SECTION_MAP[type];
  return (
    categoryBySlug.get(meta.categorySlug) ||
    [...categoryBySlug.entries()].find(([s]) => s.includes(meta.categorySlug))?.[1] ||
    null
  );
}

// Default author — pick the "Gallery" house account if present, else
// alphabetically-first author as a fallback. Photo sections rarely
// carry meaningful byline data, so a house account is honest.
const houseAuthorRes = await db.query<{ id: string }>(
  `SELECT id FROM authors WHERE name ILIKE 'gallery' OR name ILIKE 'gallery magazine' ORDER BY name LIMIT 1`,
);
const fallbackAuthorRes = await db.query<{ id: string }>(
  `SELECT id FROM authors ORDER BY name LIMIT 1`,
);
const DEFAULT_AUTHOR_ID = houseAuthorRes.rows[0]?.id || fallbackAuthorRes.rows[0]?.id;
if (!DEFAULT_AUTHOR_ID) {
  console.error("No authors in the DB — can't save drafts.");
  process.exit(1);
}

// --- Main loop --------------------------------------------------------

let issuesProcessed = 0;
let issuesSkipped = 0;
let issuesFailed = 0;
let sectionsCreated = 0;
let imagesUploaded = 0;
const start = Date.now();

for (let issueNumber = FROM; issueNumber <= TO; issueNumber++) {
  const prefix = `[#${issueNumber}]`;
  try {
    const issueRes = await db.query<{ pdf_url: string | null; display_label: string | null }>(
      `SELECT pdf_url, display_label FROM issues WHERE number = $1`,
      [issueNumber],
    );
    const issue = issueRes.rows[0];
    if (!issue) {
      console.log(`${prefix} no issue row — skipping`);
      issuesSkipped++;
      continue;
    }
    if (!issue.pdf_url) {
      console.log(`${prefix} no PDF URL — skipping`);
      issuesSkipped++;
      continue;
    }

    if (SKIP_IF_ANY) {
      const existingRes = await db.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM articles WHERE issue_number = $1`,
        [issueNumber],
      );
      if (existingRes.rows[0].n > 0) {
        console.log(`${prefix} already has ${existingRes.rows[0].n} article(s) — skipping (--skip-if-any)`);
        issuesSkipped++;
        continue;
      }
    }

    console.log(
      `${prefix} ${issue.display_label || "no label"} — ingesting ${issue.pdf_url}`,
    );
    const ingestStart = Date.now();
    const result = await ingestPdf(issue.pdf_url);
    const ingestTook = ((Date.now() - ingestStart) / 1000).toFixed(1);
    console.log(
      `${prefix}   Claude done in ${ingestTook}s — ${result.articles.length} feature(s), ${result.photo_sections.length} photo section(s), ${result.page_count} pages`,
    );

    // Filter photo sections to just the requested types.
    const wanted = result.photo_sections.filter((s) => TYPES.includes(s.type));
    if (wanted.length === 0) {
      console.log(`${prefix}   no matching photo sections; issue done`);
      issuesProcessed++;
      continue;
    }

    for (const section of wanted) {
      const meta = PHOTO_SECTION_MAP[section.type];
      const categoryId = categoryIdForType(section.type);
      if (!categoryId) {
        console.warn(`${prefix}   [${section.type}] no matching category — skipping section`);
        continue;
      }

      // Pull the images. Loose thresholds so small crops make it through.
      const images = await extractImagesFromPageRange(
        issue.pdf_url,
        section.estimated_page_range,
        { issueNumber, loose: true },
      );
      if (images.length === 0) {
        console.warn(
          `${prefix}   [${section.type} pp${section.estimated_page_range[0]}-${section.estimated_page_range[1]}] no images extracted — skipping`,
        );
        continue;
      }

      const suffix = ` — Gallery ${issueNumber}`;
      const title = section.label
        ? section.label + (section.type === "paparazzi" ? suffix : "")
        : `${meta.typeLabel}${suffix}`;
      const slug = slugify(title) + `-${issueNumber}`; // suffix with issue# to reduce collisions

      if (DRY_RUN) {
        console.log(
          `${prefix}   [dry] would create ${meta.typeLabel}: "${title}" (${images.length} imgs, pp${section.estimated_page_range[0]}-${section.estimated_page_range[1]})`,
        );
        sectionsCreated++;
        imagesUploaded += images.length;
        continue;
      }

      // Direct INSERT — mirrors what POST /api/articles ends up doing
      // but without the HTTP round-trip. Slug collisions are handled
      // via a retry loop with numeric suffixes (matches the server's
      // auto-suffix pattern).
      let attempt = 0;
      let inserted = false;
      while (attempt < 20 && !inserted) {
        const candidateSlug = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
        try {
          const galleryImages = images.map((im) => ({ url: im.url }));
          await db.query(
            `INSERT INTO articles (
               title, slug, excerpt, content, category_id, author_id,
               photographer, illustrator, status, content_type,
               featured_image, gallery_images, read_time, issue_number,
               homepage_highlight, is_featured, featured_order, views
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
             )`,
            [
              title,
              candidateSlug,
              section.caption_hint || "",
              "",
              categoryId,
              DEFAULT_AUTHOR_ID,
              section.credits || "",
              "",
              "draft",
              meta.contentType,
              images[0].url,
              JSON.stringify(galleryImages),
              1,
              issueNumber,
              false,
              false,
              0,
              0,
            ],
          );
          inserted = true;
        } catch (err: any) {
          if (err?.code === "23505" && String(err?.constraint || "").includes("slug")) {
            attempt++;
            continue;
          }
          throw err;
        }
      }
      if (!inserted) {
        console.warn(`${prefix}   [${section.type}] slug collision after 20 tries — skipped`);
        continue;
      }
      console.log(
        `${prefix}   ✓ ${meta.typeLabel}: "${title}" (${images.length} imgs)`,
      );
      sectionsCreated++;
      imagesUploaded += images.length;
    }
    issuesProcessed++;
  } catch (err: any) {
    issuesFailed++;
    console.error(`${prefix} FAILED: ${err?.message || err}`);
    // Continue with the next issue — don't let one bad issue kill
    // the whole batch. Log it and press on.
    continue;
  }
}

const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
console.log(`\nDone in ${elapsed} minutes${DRY_RUN ? " (dry run)" : ""}.`);
console.log(
  `Issues: ${issuesProcessed} processed, ${issuesSkipped} skipped, ${issuesFailed} failed.`,
);
console.log(`Photo sections: ${sectionsCreated} draft articles created, ${imagesUploaded} images uploaded.`);
await db.end();
