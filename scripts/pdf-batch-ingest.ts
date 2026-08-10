#!/usr/bin/env tsx
/**
 * Batch PDF ingest — walks a range of issues, extracts photo sections
 * (fashion / events / paparazzi / portfolios) and, optionally, main
 * features (text-led + portrait-led) via Claude, pulls the images with
 * pdfimages, and lands each as a draft automatically.
 *
 * Runtime is roughly 2-3 minutes per issue (Claude + image extraction),
 * so 100 issues ~= 4-5 hours. Log progress line per issue so the editor
 * can leave it running and check back. Idempotent-ish: it'll happily
 * re-run over issues that already have drafts (server auto-suffixes
 * the slug on collision), but you'll get duplicates. Use --skip-if-any
 * to skip issues that already have any article filed against them.
 *
 * Usage:
 *   railway run tsx scripts/pdf-batch-ingest.ts --status          # progress + pending list, no writes
 *   railway run tsx scripts/pdf-batch-ingest.ts --from=1 --to=100
 *   railway run tsx scripts/pdf-batch-ingest.ts --from=1 --to=10 --dry-run
 *   railway run tsx scripts/pdf-batch-ingest.ts --from=1 --to=6 \
 *     --skip-if-any --include-articles      # grab EVERYTHING in empty issues
 *
 * Flags:
 *   --status            print a progress summary (total / with_pdf /
 *                       processed / pending / no_pdf) plus the oldest
 *                       100 pending issues, then exit. No writes, no
 *                       Claude calls. Safe to run any time.
 *   --from=N            first issue number (default: 1)
 *   --to=M              last issue number, inclusive (default: 100)
 *   --types=a,b,c       comma-separated photo section types to import
 *                       (default: fashion_shoot,event,paparazzi,portfolio)
 *   --include-articles  also import feature articles as drafts — both
 *                       text-led features and shorter portrait-led
 *                       profile pieces. Off by default because articles
 *                       usually want editor review; ON is the right call
 *                       for empty back-catalogue issues where anything
 *                       is better than nothing.
 *   --skip-if-any       skip issues that already have any article filed
 *                       against them (prevents accidental duplicates on
 *                       re-runs). Pair with --include-articles when
 *                       backfilling empty years.
 *   --dry-run           walk everything, log what WOULD be created, but
 *                       don't write to DB or upload to R2
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

const STATUS_ONLY = has("status");
const FROM = parseInt(flag("from", "1")!, 10);
const TO = parseInt(flag("to", "100")!, 10);
const DRY_RUN = has("dry-run");
const SKIP_IF_ANY = has("skip-if-any");
const INCLUDE_ARTICLES = has("include-articles");
const TYPES = (flag("types", "fashion_shoot,event,paparazzi,portfolio")!
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean) as PhotoSectionType[]);

if (!STATUS_ONLY && (!Number.isInteger(FROM) || !Number.isInteger(TO) || FROM < 1 || TO < FROM)) {
  console.error(`Invalid --from / --to: ${FROM} → ${TO}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}
if (!STATUS_ONLY && !process.env.ANTHROPIC_API_KEY) {
  // Status-only doesn't hit the Anthropic API, so don't demand the key.
  console.error("Missing ANTHROPIC_API_KEY.");
  process.exit(1);
}

if (!STATUS_ONLY) {
  console.log(
    `\nBatch PDF ingest — issues ${FROM}–${TO}, types: ${TYPES.join(", ")}${
      INCLUDE_ARTICLES ? " + feature articles" : ""
    }${DRY_RUN ? " (dry run)" : ""}${
      SKIP_IF_ANY ? ", skipping issues with any existing article" : ""
    }\n`,
  );
}

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

// Supabase's session-mode pooler on port 5432 is often unreachable from
// external clients (IPv6-only in most regions). The transaction-mode
// pooler on 6543 accepts IPv4 and is the recommended external port —
// same URL, same credentials, just a different port. Only swap when
// running LOCALLY: inside Railway (RAILWAY_ENVIRONMENT is set) the
// original URL works natively and 5432 is preferable for long-lived
// scripts.
function localFriendlyDatabaseUrl(raw: string): string {
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.log("(railway env detected — using DATABASE_URL as-is)");
    return raw;
  }
  const isSupabase = /supabase\.(com|co)/i.test(raw);
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch (err: any) {
    console.warn(`Could not parse DATABASE_URL: ${err.message} — using raw string`);
    return raw;
  }
  console.log(
    `(local: DATABASE_URL host=${parsed.hostname} port=${parsed.port} supabase=${isSupabase})`,
  );
  if (isSupabase && parsed.port === "5432") {
    parsed.port = "6543";
    console.log(`(local: swapped port 5432 → 6543 for IPv4 reachability)`);
    return parsed.toString();
  }
  return raw;
}

const db = new pg.Client({ connectionString: localFriendlyDatabaseUrl(process.env.DATABASE_URL!) });
await db.connect();

// --- Status mode: print progress + candidate list, then exit ---------
// Runs before any category/author bootstrap so it's fast (~50ms) and
// safe to invoke frequently. No writes, no Claude calls, no image work.
if (STATUS_ONLY) {
  const summaryRes = await db.query<{
    total: number;
    with_pdf: number;
    processed: number;
    pending: number;
    no_pdf: number;
  }>(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE pdf_url IS NOT NULL)::int AS with_pdf,
      COUNT(*) FILTER (WHERE number IN (SELECT DISTINCT issue_number FROM articles WHERE issue_number IS NOT NULL))::int AS processed,
      COUNT(*) FILTER (
        WHERE pdf_url IS NOT NULL
          AND number NOT IN (SELECT DISTINCT issue_number FROM articles WHERE issue_number IS NOT NULL)
      )::int AS pending,
      COUNT(*) FILTER (WHERE pdf_url IS NULL)::int AS no_pdf
    FROM issues
  `);
  const s = summaryRes.rows[0];
  const pct = (n: number) => (s.total ? Math.round((n / s.total) * 100) : 0);
  console.log(`\nPDF ingest status`);
  console.log(`─────────────────`);
  console.log(`  Total issues:        ${s.total}`);
  console.log(`  With PDF:            ${s.with_pdf}  (${pct(s.with_pdf)}%)`);
  console.log(`  Processed (any art): ${s.processed}  (${pct(s.processed)}%)`);
  console.log(`  Pending (PDF + 0):   ${s.pending}   ← candidates for --include-articles`);
  console.log(`  No PDF at all:       ${s.no_pdf}`);

  const pendingRes = await db.query<{
    number: number;
    display_label: string | null;
    published_at: string | null;
  }>(`
    SELECT number, display_label, published_at::date::text AS published_at
    FROM issues
    WHERE pdf_url IS NOT NULL
      AND number NOT IN (SELECT DISTINCT issue_number FROM articles WHERE issue_number IS NOT NULL)
    ORDER BY published_at NULLS LAST, number
    LIMIT 100
  `);
  console.log(`\nPending issues (up to 100, oldest first):`);
  if (pendingRes.rows.length === 0) {
    console.log(`  (none — every PDF-bearing issue has been processed)`);
  } else {
    for (const row of pendingRes.rows) {
      console.log(
        `  #${String(row.number).padStart(4)}  ${row.published_at ?? "        "}  ${row.display_label ?? "(no label)"}`,
      );
    }
  }
  console.log("");
  await db.end();
  process.exit(0);
}

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

// --- Byline parsing + author resolution (for --include-articles) ------
// Mirrors the client-side cleanByline() in PdfIngestManager.tsx so the
// batch script attributes the same author the admin UI would.
function cleanByline(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).trim();
  // Strip common editorial prefixes: "Words by", "Photography by",
  // "Interview by", plain "By", "Photos by", etc.
  s = s.replace(/^(words|photography|photographs?|photos?|interview|reporting|feature)\s+by\s+/i, "");
  s = s.replace(/^by\s+/i, "");
  // Cut trailing "for Gallery" / titles / role qualifiers.
  s = s.replace(/,?\s+(for gallery|for gallery magazine).*$/i, "");
  s = s.trim();
  // Reject bylines that are obviously not a person name — too short is
  // a caption fragment, too long is a whole paragraph Claude grabbed.
  if (s.length < 3 || s.length > 80) return "";
  return s;
}

// Resolve a cleaned byline to an author row, creating one if needed.
// Case-insensitive name match; falls back to inserting a fresh author
// row with an auto-suffixed slug on collision. Returns null only if
// the byline is empty / unusable — in which case the caller uses
// DEFAULT_AUTHOR_ID.
async function resolveAuthor(rawByline: string | null | undefined): Promise<string | null> {
  const name = cleanByline(rawByline);
  if (!name) return null;
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM authors WHERE LOWER(name) = LOWER($1) LIMIT 1`,
    [name],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  // Create — retry on slug collision, matches server storage pattern.
  const baseSlug = slugify(name);
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try {
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO authors (name, slug) VALUES ($1, $2) RETURNING id`,
        [name, slug],
      );
      return inserted.rows[0].id;
    } catch (err: any) {
      if (err?.code === "23505" && String(err?.constraint || "").includes("slug")) continue;
      throw err;
    }
  }
  return null;
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
    const issueRes = await db.query<{
      pdf_url: string | null;
      display_label: string | null;
      published_at: Date | null;
    }>(
      // Pull published_at too so we can backdate imported drafts to the
      // print-edition date rather than "now" — otherwise the article
      // list shows a 2005 magazine's articles as published today.
      `SELECT pdf_url, display_label, published_at FROM issues WHERE number = $1`,
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
          // Photo sections have very little prose but still need SEO
          // copy — mirror the caption_hint into both excerpt AND
          // meta_description so the standfirst on the article page and
          // the meta description used by search / social previews are
          // both populated from the same source.
          const captionText = section.caption_hint || "";
          await db.query(
            `INSERT INTO articles (
               title, slug, excerpt, content, category_id, author_id,
               photographer, illustrator, status, content_type,
               featured_image, gallery_images, read_time, issue_number,
               published_at, meta_description,
               homepage_highlight, is_featured, featured_order, views
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
             )`,
            [
              title,
              candidateSlug,
              captionText,
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
              // Backdate to the print-edition publish date so the
              // article list surfaces these where they belong
              // chronologically. Falls back to null if the issue row
              // has no date (rare).
              issue.published_at,
              captionText,
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

    // --- Feature articles (opt-in via --include-articles) ------------
    // Text-led features AND portrait-led profile pieces — both come
    // through as entries in result.articles. We drop them in as drafts
    // with real body text, first extracted image as featured, rest as
    // gallery. Editor reviews in admin before publish.
    if (INCLUDE_ARTICLES && result.articles.length > 0) {
      for (const article of result.articles) {
        const targetSlug = article.suggested_category?.trim();
        const categoryId =
          (targetSlug && categoryBySlug.get(targetSlug)) ||
          categoryBySlug.get("culture") ||
          categoryBySlug.get("features") ||
          null;
        if (!categoryId) {
          console.warn(`${prefix}   [article] no matching category for "${article.title}" — skipping`);
          continue;
        }

        // Author resolution: try to match/create from byline, else
        // fall back to the house account. Missing byline is common on
        // photo-led features — that's expected.
        const authorId = (await resolveAuthor(article.byline)) || DEFAULT_AUTHOR_ID;

        // Loose image extraction across the article's page range. Even
        // portrait-led features tend to have <5 images across 1-3
        // pages, so this is cheap.
        let images: Awaited<ReturnType<typeof extractImagesFromPageRange>> = [];
        try {
          images = await extractImagesFromPageRange(
            issue.pdf_url,
            article.estimated_page_range,
            { issueNumber, loose: true },
          );
        } catch (err: any) {
          console.warn(`${prefix}   [article] image extract failed for "${article.title}": ${err?.message || err}`);
        }
        const featuredImage = images[0]?.url || null;
        const galleryImages = images.slice(1).map((im) => ({ url: im.url }));

        // Compose body: prepend standfirst as an intro paragraph if
        // present, then the article body verbatim. Excerpt = standfirst
        // (or first ~200 chars of body if no standfirst).
        const standfirst = (article.standfirst || "").trim();
        const body = (article.body || "").trim();
        const excerpt = standfirst || body.slice(0, 200).replace(/\s+\S*$/, "") + (body.length > 200 ? "…" : "");
        const content = standfirst
          ? `<p><em>${standfirst}</em></p>\n\n${body.split("\n\n").map((p) => `<p>${p.trim()}</p>`).join("\n\n")}`
          : body.split("\n\n").map((p) => `<p>${p.trim()}</p>`).join("\n\n");

        const slug = slugify(article.title) + `-${issueNumber}`;

        if (DRY_RUN) {
          console.log(
            `${prefix}   [dry] would create feature: "${article.title}" by ${cleanByline(article.byline) || "uncredited"} (${images.length} imgs, pp${article.estimated_page_range[0]}-${article.estimated_page_range[1]})`,
          );
          sectionsCreated++;
          imagesUploaded += images.length;
          continue;
        }

        let attempt = 0;
        let inserted = false;
        while (attempt < 20 && !inserted) {
          const candidateSlug = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
          try {
            await db.query(
              `INSERT INTO articles (
                 title, slug, excerpt, content, category_id, author_id,
                 photographer, illustrator, status, content_type,
                 featured_image, gallery_images, read_time, issue_number,
                 published_at, meta_description,
                 homepage_highlight, is_featured, featured_order, views
               ) VALUES (
                 $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
               )`,
              [
                article.title,
                candidateSlug,
                excerpt,
                content,
                categoryId,
                authorId,
                "", // photographer — features don't reliably credit
                "",
                "draft",
                "article",
                featuredImage,
                JSON.stringify(galleryImages),
                Math.max(1, Math.ceil(body.split(/\s+/).length / 220)), // rough reading time
                issueNumber,
                issue.published_at,
                excerpt, // meta_description mirrors excerpt
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
          console.warn(`${prefix}   [article] slug collision after 20 tries — skipped "${article.title}"`);
          continue;
        }
        console.log(
          `${prefix}   ✓ Feature: "${article.title}" by ${cleanByline(article.byline) || "uncredited"} (${images.length} imgs)`,
        );
        sectionsCreated++;
        imagesUploaded += images.length;
      }
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
