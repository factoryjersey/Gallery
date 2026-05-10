// Parses an InDesign .idml (packaged feature) into our structured shape.
//
// Output:
// {
//   source_layout, pages, hero, inline_images,
//   title, standfirst, content, pull_quote_1, pull_quote_2,
//   raw_paragraphs (for debugging / human review)
// }
//
// Style → field mapping is a pluggable function so we can tune it per-issue
// when older issues use older paragraph style names.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DOMParser } from "@xmldom/xmldom";

// ---------- Style classifier ----------

/** Classify an InDesign paragraph style name into one of our roles. */
export function classifyStyle(name) {
  const n = (name || "").toLowerCase();

  if (!n || n.includes("[no paragraph style]")) return "body";

  // Chrome / branding / fixed page furniture — discard
  if (/(corner section|page tab|page numbers|running head|footer|header|directory|footnote|product feature|sectional title section)/.test(n)) return "skip";

  // Title / heading
  if (/(page title|inline header|title sans|movers_title|heading|^title|main title|issuu heading)/.test(n)) return "title";

  // Standfirst / intro / dek
  if (/(lead.?in|standfirst|intro|dek|sub.?title|deck)/.test(n)) return "standfirst";

  // Pull quote
  if (/(pull.?quote|caslon pull|highlight description|last word quote|callout)/.test(n)) return "pullquote";

  // Caption
  if (/(caption|photo caption|cutline)/.test(n)) return "caption";

  // Default to body — InDesign uses many style names for body variants
  // (first para body, first paragraph, normalparagraphstyle, body text, etc.)
  return "body";
}

// ---------- XML helpers ----------

function attr(el, name) {
  if (!el || !el.getAttribute) return "";
  return el.getAttribute(name) || "";
}

function styleNameFromAttr(s) {
  // "ParagraphStyle/lead-in paragraph" → "lead-in paragraph"
  if (!s) return "";
  const idx = s.indexOf("/");
  return idx >= 0 ? s.slice(idx + 1) : s;
}

function textOfRange(range) {
  // Walk all CharacterStyleRange/Content children, concatenate text.
  // Preserve a soft break (space) between Content fragments.
  const parts = [];
  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === 1) {
      const tag = node.nodeName;
      if (tag === "Content") {
        let t = "";
        for (let c = node.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3 || c.nodeType === 4) t += c.nodeValue;
        }
        parts.push(t);
      } else if (tag === "Br") {
        parts.push("\n");
      } else {
        for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
      }
    }
  };
  walk(range);
  return parts.join("");
}

// ---------- Story extraction ----------

/** Extract paragraph blocks from one Story_*.xml */
function paragraphsFromStory(xml) {
  const doc = new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(xml, "text/xml");

  const ranges = doc.getElementsByTagName("ParagraphStyleRange");
  const result = [];
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges.item(i);
    const styleAttr = styleNameFromAttr(attr(range, "AppliedParagraphStyle"));
    const role = classifyStyle(styleAttr);
    if (role === "skip") continue;
    const text = textOfRange(range)
      .replace(/[\u2028\u2029]/g, "\n")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    if (text.length < 2) continue;
    result.push({ role, style: styleAttr, text });
  }
  return result;
}

// ---------- Spread extraction (images + page numbers) ----------

function imagesAndPagesFromSpread(xml) {
  const doc = new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(xml, "text/xml");

  const pages = [];
  for (const p of Array.from(doc.getElementsByTagName("Page"))) {
    const name = attr(p, "Name");
    if (name && /^\d+$/.test(name)) pages.push(parseInt(name, 10));
  }

  const images = [];
  for (const link of Array.from(doc.getElementsByTagName("Link"))) {
    const href = attr(link, "LinkResourceURI") || attr(link, "Href");
    if (!href) continue;
    const m = href.match(/([^/\\]+\.(?:jpe?g|png|tiff?|psd))$/i);
    if (m) {
      try { images.push(decodeURIComponent(m[1])); } catch { images.push(m[1]); }
    }
  }
  return { pages, images };
}

// ---------- Main ----------

export async function parseIDML(filePath) {
  const tmp = `/tmp/idml-parse-${Math.random().toString(36).slice(2)}`;
  spawnSync("unzip", ["-q", "-o", filePath, "-d", tmp]);

  try {
    const allPars = [];
    const storiesDir = path.join(tmp, "Stories");
    let storyFiles = [];
    try { storyFiles = (await readdir(storiesDir)).filter((f) => f.endsWith(".xml")); } catch {}
    storyFiles.sort(); // deterministic; not perfect reading order
    for (const sf of storyFiles) {
      const x = await readFile(path.join(storiesDir, sf), "utf8");
      allPars.push(...paragraphsFromStory(x));
    }

    let pagesSet = new Set();
    let images = [];
    const spreadsDir = path.join(tmp, "Spreads");
    let spreadFiles = [];
    try { spreadFiles = (await readdir(spreadsDir)).filter((f) => f.endsWith(".xml")); } catch {}
    for (const sf of spreadFiles) {
      const x = await readFile(path.join(spreadsDir, sf), "utf8");
      const { pages, images: imgs } = imagesAndPagesFromSpread(x);
      pages.forEach((p) => pagesSet.add(p));
      images.push(...imgs);
    }

    return {
      source_layout: path.basename(filePath),
      pages: [...pagesSet].sort((a, b) => a - b),
      images: [...new Set(images)],
      paragraphs: allPars,
    };
  } finally {
    spawnSync("rm", ["-rf", tmp]);
  }
}

// ---------- Reduce paragraphs to article shape ----------

const STOPWORDS_TITLE = /^(life ?&|wwwgallery|@gallerymag|@gallery|gallery\.je|www\.gallery)/i;
const ALL_CAPS = /^[A-Z0-9 .'!?,&\-:;]{4,}$/;

export function shapeArticle(parsed) {
  // Filter out repeated chrome-y paragraphs first
  const seen = new Map();
  for (const p of parsed.paragraphs) {
    const key = p.text.toLowerCase().slice(0, 80);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  // Drop strings repeated 3+ times — they're running heads
  const meaningful = parsed.paragraphs.filter((p) => {
    const key = p.text.toLowerCase().slice(0, 80);
    if (seen.get(key) >= 3) return false;
    if (STOPWORDS_TITLE.test(p.text)) return false;
    return true;
  });

  // Title: first "title"-role paragraph; fallback to first all-caps shortish paragraph
  let title = meaningful.find((p) => p.role === "title")?.text || "";
  if (!title) {
    const candidate = meaningful.find((p) => ALL_CAPS.test(p.text) && p.text.length < 80);
    if (candidate) title = candidate.text;
  }

  // Standfirst: first "standfirst"-role; fallback to longest paragraph before body
  let standfirst = meaningful.find((p) => p.role === "standfirst")?.text || "";

  // Pull quotes: first 2 "pullquote"-role
  const pullquotes = meaningful.filter((p) => p.role === "pullquote").map((p) => p.text);

  // Body: all "body"-role paragraphs joined; convert to simple HTML paragraphs
  const bodyParas = meaningful
    .filter((p) => p.role === "body" && p.text !== title && p.text !== standfirst)
    .map((p) => p.text)
    // De-dupe consecutive identical
    .filter((t, i, arr) => t !== arr[i - 1]);

  const content = bodyParas.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");

  // Hero / inline images
  const hero = parsed.images[0] || null;
  const inline_images = parsed.images.slice(1);

  return {
    source_layout: parsed.source_layout,
    pages: parsed.pages,
    title: title || null,
    standfirst: standfirst || null,
    content: content || null,
    pull_quote_1: pullquotes[0] || null,
    pull_quote_2: pullquotes[1] || null,
    hero,
    inline_images,
    word_count: bodyParas.join(" ").split(/\s+/).filter(Boolean).length,
    raw_paragraph_count: meaningful.length,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
