// Two related clean-ups for WordPress-imported articles:
//
//   1. Leading "Words: X | Photography: Y | Illustration: Z" paragraphs —
//      extract the names into articles.photographer / illustrator and
//      strip the paragraph from the body so it doesn't duplicate the
//      proper byline.
//   2. Excerpt duplicated in the body — when the article's excerpt
//      appears verbatim as the first paragraph(s) of the body (a common
//      WP-importer artefact), remove that paragraph so the standfirst
//      doesn't read twice.
//
// Safe-by-default: --apply required to write. Per-article transaction.
//
// Flags:
//   --apply           write changes (otherwise dry-run)
//   --limit=N         cap at N articles
//   --slug=foo        target one article
//   --skip-credits    only do excerpt dedup
//   --skip-excerpt    only do credit extraction
import pg from "pg";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

const APPLY = process.argv.includes("--apply");
const SKIP_CREDITS = process.argv.includes("--skip-credits");
const SKIP_EXCERPT = process.argv.includes("--skip-excerpt");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const SLUG = (process.argv.find((a) => a.startsWith("--slug=")) || "").split("=")[1] || "";

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const conds = [`status = 'published'`];
const params = [];
if (SLUG) {
  conds.push(`slug = $${params.length + 1}`);
  params.push(SLUG);
} else {
  conds.push(`content IS NOT NULL AND length(content) > 50`);
}
const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";
const { rows } = await db.query(
  `SELECT id, slug, title, content, excerpt, photographer, illustrator,
          featured_image AS "featuredImage"
     FROM articles
    WHERE ${conds.join(" AND ")}
    ORDER BY published_at DESC NULLS LAST
    ${limitClause}`,
  params,
);

console.log(`Scanning ${rows.length} article${rows.length === 1 ? "" : "s"}.\n`);

function parseFragment(html) {
  const parser = new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  });
  return parser.parseFromString(`<root>${html}</root>`, "text/html");
}

function serializeContent(doc) {
  const ser = new XMLSerializer();
  let html = "";
  let c = doc.documentElement.firstChild;
  while (c) {
    html += ser.serializeToString(c);
    c = c.nextSibling;
  }
  return html.replace(/\sxmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, "");
}

function textOf(node) {
  let t = "";
  (function walk(n) {
    if (!n) return;
    if (n.nodeType === 3) t += n.nodeValue || "";
    let c = n.firstChild;
    while (c) { walk(c); c = c.nextSibling; }
  })(node);
  return t;
}

function normaliseForCompare(s) {
  return (s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[^a-z0-9 ]/gi, " ")
    .replace(/[\s]+/g, " ")
    .trim()
    .toLowerCase();
}

// Look at the FIRST significant child (paragraph) of the body. If it reads
// like a credits line, return { photographer, illustrator, node }.
const CREDIT_LABELS = {
  photographer: /\b(?:Photography|Photographer|Photo|Photos)\s*[:|-]\s*/i,
  illustrator: /\b(?:Illustration|Illustrator|Illustrations|Artwork|Art)\s*[:|-]\s*/i,
};
const WORDS_LABEL = /\bWords\s*[:|-]\s*/i;

function looksLikeCreditsParagraph(text) {
  if (!text || text.length > 220) return false; // credits are short
  const hasCredit = CREDIT_LABELS.photographer.test(text) || CREDIT_LABELS.illustrator.test(text);
  if (!hasCredit) return false;
  // Reject lines that are clearly prose — the whole text should read like a credit list.
  // Heuristic: total length per label should be modest, and no full sentence with period+space mid-text.
  if (/[.!?]\s+[A-Z]/.test(text.trim().replace(/[.!?]$/, ""))) return false;
  return true;
}

function extractCredits(creditText) {
  const out = { photographer: null, illustrator: null };
  // Strip leading "Words: …" segment first
  let rest = creditText.replace(WORDS_LABEL, "");
  // Try each label
  for (const [field, labelRe] of Object.entries(CREDIT_LABELS)) {
    const m = rest.match(new RegExp(labelRe.source + "([^|·•,;\\n]+?)(?=\\s*(?:Photography|Photographer|Photo|Photos|Illustration|Illustrator|Illustrations|Artwork|Art|Words)\\s*[:|-]|$)", "i"));
    if (m) {
      const name = m[1].replace(/[.,;:|·•]+$/, "").trim();
      if (name && name.length < 80) out[field] = name;
    }
  }
  return out;
}

// First "real" child element of <root>. Skips empty text nodes, comments,
// and <p> nodes that are just whitespace/&nbsp;.
// First "real" child element of <root>. Skips empty text nodes, comments,
// and <p> nodes that are just whitespace/&nbsp;. Figures with images count
// as significant (they have no text but matter for body structure).
function firstSignificantChild(root) {
  let c = root?.firstChild;
  while (c) {
    if (c.nodeType === 1) {
      const tag = c.tagName?.toLowerCase();
      const txt = textOf(c).replace(/[\s]+/g, " ").trim();
      if (txt.length > 0 || tag === "figure") return c;
    }
    c = c.nextSibling;
  }
  return null;
}

// Return up to N leading significant children (paragraphs, figures, headings).
function leadingChildren(root, n) {
  const out = [];
  let c = root?.firstChild;
  while (c && out.length < n) {
    if (c.nodeType === 1) {
      const tag = c.tagName?.toLowerCase();
      const txt = textOf(c).replace(/[\s]+/g, " ").trim();
      if (txt.length > 0 || tag === "figure") out.push(c);
    }
    c = c.nextSibling;
  }
  return out;
}

// Pull the first <img> src from a node, with any "-WIDTHxHEIGHT" sizing
// suffix stripped so we can compare against the article featured_image.
function firstImgBaseUrl(node) {
  if (!node) return null;
  let img = null;
  (function walk(n) {
    if (img || !n) return;
    if (n.nodeType === 1 && n.tagName?.toLowerCase() === "img") { img = n; return; }
    let c = n.firstChild;
    while (c && !img) { walk(c); c = c.nextSibling; }
  })(node);
  if (!img) return null;
  const src = img.getAttribute("src") || "";
  return src.replace(/-\d+x\d+(\.[a-z]+)(\?.*)?$/i, "$1");
}

function baseOfUrl(url) {
  if (!url) return null;
  return url.replace(/-\d+x\d+(\.[a-z]+)(\?.*)?$/i, "$1");
}

let creditMatches = 0;
let dupFeaturedStripped = 0;
let creditSkippedAlreadySet = 0;
let excerptStripped = 0;
const samples = [];

for (const article of rows) {
  const doc = parseFragment(article.content || "");
  const root = doc.documentElement;
  let mutated = false;
  let extractedPhotographer = article.photographer;
  let extractedIllustrator = article.illustrator;

  // --- 1a. Strip a leading figure whose <img> is the article's featured
  //          image (a common WP artefact when the editor pasted both). ---
  if (article.featuredImage) {
    const first = firstSignificantChild(root);
    if (first && first.tagName?.toLowerCase() === "figure") {
      const firstImg = firstImgBaseUrl(first);
      const featuredBase = baseOfUrl(article.featuredImage);
      if (firstImg && featuredBase && firstImg === featuredBase) {
        first.parentNode?.removeChild(first);
        mutated = true;
        dupFeaturedStripped++;
        if (samples.length < 8) {
          samples.push({
            kind: "dup-featured",
            slug: article.slug,
            text: firstImg,
          });
        }
      }
    }
  }

  // --- 1b. Credit-line extraction ---
  // Looks at the first ~5 leading children (paragraphs / figures / etc) and
  // strips the first one that reads as a "Words: X, Photography: Y" credit.
  if (!SKIP_CREDITS) {
    const candidates = leadingChildren(root, 5);
    let creditNode = null;
    let creditText = "";
    for (const c of candidates) {
      const tag = c.tagName?.toLowerCase();
      if (tag === "figure") continue; // skip image figures, look past them
      const txt = textOf(c).replace(/[\s]+/g, " ").trim();
      if (looksLikeCreditsParagraph(txt)) { creditNode = c; creditText = txt; break; }
    }
    if (creditNode) {
      const { photographer, illustrator } = extractCredits(creditText);
      // Only overwrite when the slot is empty — never clobber a manual edit.
      if (photographer && !article.photographer) extractedPhotographer = photographer;
      else if (article.photographer) creditSkippedAlreadySet++;
      if (illustrator && !article.illustrator) extractedIllustrator = illustrator;
      else if (article.illustrator) creditSkippedAlreadySet++;
      creditNode.parentNode?.removeChild(creditNode);
      mutated = true;
      creditMatches++;
      if (samples.length < 8) {
        samples.push({
          kind: "credit",
          slug: article.slug,
          text: creditText.slice(0, 100),
          photographer: extractedPhotographer,
          illustrator: extractedIllustrator,
        });
      }
    }
  }

  // --- 2. Excerpt-in-body dedup ---
  if (!SKIP_EXCERPT && article.excerpt && article.excerpt.length >= 60) {
    const excerptNorm = normaliseForCompare(article.excerpt);
    // Look at the first 1-3 significant <p> elements and see if they form
    // the excerpt's opening text.
    const checkLimit = 3;
    let accumulated = "";
    const toRemove = [];
    let c = firstSignificantChild(root);
    while (c && toRemove.length < checkLimit) {
      const tag = c.tagName?.toLowerCase();
      if (tag !== "p") break; // only collapse leading paragraphs
      const txt = normaliseForCompare(textOf(c));
      if (!txt) {
        c = c.nextSibling;
        continue;
      }
      accumulated = accumulated ? `${accumulated} ${txt}` : txt;
      toRemove.push(c);
      // Match condition: the excerpt is a prefix (or 95%+ overlap) of accumulated
      if (
        excerptNorm.length > 60 &&
        (accumulated.startsWith(excerptNorm) || excerptNorm.startsWith(accumulated))
      ) {
        // Only count if we've covered ≥80% of the excerpt's length — otherwise
        // we might strip a paragraph that just happens to start with the same words.
        const ratio = Math.min(accumulated.length, excerptNorm.length) / excerptNorm.length;
        if (ratio >= 0.8) {
          for (const n of toRemove) n.parentNode?.removeChild(n);
          mutated = true;
          excerptStripped++;
          if (samples.length < 10 && samples.filter(s => s.kind === "excerpt").length < 5) {
            samples.push({ kind: "excerpt", slug: article.slug, removed: toRemove.length });
          }
          break;
        }
      }
      c = c.nextSibling;
    }
  }

  if (mutated && APPLY) {
    const newContent = serializeContent(doc);
    await db.query(
      `UPDATE articles
          SET content = $1,
              photographer = $2,
              illustrator = $3,
              updated_at = NOW()
        WHERE id = $4`,
      [newContent, extractedPhotographer, extractedIllustrator, article.id],
    );
  }
}

console.log(`=== Result ===`);
console.log(`  Credit paragraphs ${APPLY ? "removed" : "would be removed"}: ${creditMatches}`);
console.log(`  Leading featured-image figures ${APPLY ? "stripped" : "would be stripped"}: ${dupFeaturedStripped}`);
console.log(`  Credit fields already set (preserved)                    : ${creditSkippedAlreadySet}`);
console.log(`  Excerpt duplicate paragraphs ${APPLY ? "stripped" : "would be stripped"} : ${excerptStripped}`);

if (samples.length) {
  console.log(`\n=== Sample ===`);
  for (const s of samples) {
    if (s.kind === "credit") {
      console.log(`  [credit] ${s.slug}`);
      console.log(`    body: "${s.text}…"`);
      console.log(`    → photographer=${s.photographer || "—"}, illustrator=${s.illustrator || "—"}`);
    } else if (s.kind === "dup-featured") {
      console.log(`  [dup-featured] ${s.slug} — stripped leading figure: ${s.text}`);
    } else if (s.kind === "excerpt") {
      console.log(`  [excerpt] ${s.slug} — stripped ${s.removed} leading paragraph(s)`);
    }
  }
}

if (!APPLY) console.log(`\n[DRY RUN] No changes written. Re-run with --apply.`);

await db.end();
