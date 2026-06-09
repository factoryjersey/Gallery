// Fix the 70 articles whose excerpt got stuck on WordPress's "[…]"
// auto-truncation. Those articles also had their first body paragraph
// stripped by the earlier excerpt-in-body dedup pass — fetching the live
// WP page is the cleanest way to recover the original full opening.
//
// Per article:
//   1. Fetch wp_data.originalLink.
//   2. Find the first <p> in the rendered article body that isn't a
//      "Words: X, Photography: Y" credit line.
//   3. Replace articles.excerpt with that paragraph's plain text.
//      Body content is left alone — restoring the paragraph there would
//      duplicate the standfirst on the public page.
//
// Conservative: only updates articles whose excerpt currently ends with
// the "[…]" marker, so we never overwrite an excerpt that was hand-set.
//
// Flags:
//   --apply           write changes (otherwise dry-run)
//   --limit=N         cap at N articles
//   --slug=foo        one article only
//   --concurrency=N   parallel WP fetches (default 4)
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const SLUG = (process.argv.find((a) => a.startsWith("--slug=")) || "").split("=")[1] || "";
const CONCURRENCY = Number((process.argv.find((a) => a.startsWith("--concurrency=")) || "").split("=")[1] || 4);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const conds = [`status = 'published'`, `wp_data IS NOT NULL`, `excerpt LIKE '%[…]%'`];
const params = [];
if (SLUG) {
  conds[2] = `slug = $${params.length + 1}`; // override the truncation filter
  params.push(SLUG);
}
const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";

const { rows } = await db.query(
  `SELECT id, slug, title, excerpt, wp_data
     FROM articles
    WHERE ${conds.join(" AND ")}
    ORDER BY published_at DESC NULLS LAST
    ${limitClause}`,
  params,
);

console.log(`Found ${rows.length} article${rows.length === 1 ? "" : "s"} with truncated excerpts.\n`);

// Pull the first substantive body paragraph from the live WP page.
function extractFirstParagraph(html, title) {
  if (!html) return null;
  // The newspaper theme inlines lots of CSS inside <p> tags before the
  // article body. Anchor on the article's <h1> / title text so we only
  // scan paragraphs that come AFTER the headline — the actual body copy.
  // Anchor on the article's <h1>. Newspaper-theme renders the body title
  // as <h1 class="tdb-title-text">…title…</h1>; fall back to any <h1>
  // that contains the title text.
  let scanFrom = 0;
  if (title) {
    // Look for an <h1> whose text contains the article title (case-insensitive)
    const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
    for (const m of html.matchAll(h1Re)) {
      const inner = m[1].replace(/<[^>]+>/g, "").trim();
      if (inner.toLowerCase().includes(title.toLowerCase().slice(0, 30))) {
        scanFrom = m.index + m[0].length;
        break;
      }
    }
  }
  const window = html.slice(scanFrom);
  const paraRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  for (const m of window.matchAll(paraRe)) {
    const innerHtml = m[1];
    // Strip HTML tags + collapse whitespace
    const text = innerHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#039;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length < 80) continue;
    // Skip CSS-inside-<p> leakage that the WP theme generates
    if (/[\{\}]|font-family\s*:|display\s*:\s*block|vertical-align\s*:/i.test(text)) continue;
    // Skip credit paragraphs
    if (/^(?:Words|Words & Photography|Photography|Photographer|Photo|Photos|Illustration|Illustrator|Art)\s*[:|-]/i.test(text)) continue;
    return text;
  }
  return null;
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (gallery-excerpt-recovery)" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function processArticle(article) {
  const wp = typeof article.wp_data === "string" ? JSON.parse(article.wp_data) : article.wp_data;
  const link = wp?.originalLink;
  if (!link) return { article, status: "no-link" };
  const html = await fetchHtml(link);
  if (!html) return { article, status: "fetch-failed" };
  const para = extractFirstParagraph(html, article.title);
  if (!para) return { article, status: "no-paragraph-found" };
  return { article, status: "ok", excerpt: para };
}

let okCount = 0;
const counters = {};
const samples = [];

async function runBatches(items, n) {
  for (let i = 0; i < items.length; i += n) {
    const slice = items.slice(i, i + n);
    const results = await Promise.all(slice.map(processArticle));
    for (const r of results) {
      counters[r.status] = (counters[r.status] || 0) + 1;
      if (r.status === "ok") {
        okCount++;
        if (samples.length < 5) {
          samples.push({ slug: r.article.slug, old: r.article.excerpt.slice(0, 120), neu: r.excerpt.slice(0, 200) });
        }
        if (APPLY) {
          await db.query(
            `UPDATE articles SET excerpt = $1, updated_at = NOW() WHERE id = $2`,
            [r.excerpt, r.article.id],
          );
        }
      }
    }
    process.stderr.write(`  …processed ${Math.min(i + n, items.length)}/${items.length}\n`);
  }
}

await runBatches(rows, CONCURRENCY);

console.log(`\n=== Result ===`);
console.log(`  Excerpts ${APPLY ? "restored" : "that would be restored"}: ${okCount}`);
for (const [k, v] of Object.entries(counters)) {
  if (k !== "ok") console.log(`  ${k.padEnd(22)} : ${v}`);
}

if (samples.length) {
  console.log(`\n=== Sample ===`);
  for (const s of samples) {
    console.log(`  ${s.slug}`);
    console.log(`    OLD: ${s.old}…`);
    console.log(`    NEW: ${s.neu}…`);
  }
}

if (!APPLY) console.log(`\n[DRY RUN] No changes written. Re-run with --apply.`);

await db.end();
