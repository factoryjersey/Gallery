import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import os from "os";
import Anthropic from "@anthropic-ai/sdk";

const execFileP = promisify(execFile);

/**
 * PDF → main-feature article extraction via Claude 5 Sonnet.
 *
 * The whole-PDF-as-a-document approach we tried first ran into three
 * separate walls: the SDK refused >10-minute requests, Sonnet 5
 * rejected the assistant-prefill JSON-forcing trick, and vision-heavy
 * pages ate too many tokens per call. So we use the text layer
 * instead: `pdftotext` (Poppler, already in the container) rips the
 * text off each page in reading order, we hand that plain-text
 * transcript to Claude in one modestly-sized call, and Claude does
 * the structural extraction (headline / byline / body / range) on
 * text rather than pixels.
 *
 * Works for any PDF with an embedded text layer — every modern
 * InDesign export has one, and Gallery's archive is InDesign PDFs
 * going back to 2004. For a scanned-only PDF we'd need to fall back
 * to Tesseract OCR; not built yet, but Poppler + Tesseract are both
 * on the container so it's a follow-up if we ever need it.
 *
 * Nothing is written to the DB here — the caller shows the results
 * to an editor who reviews, tweaks and hits publish per article.
 */

const MODEL = "claude-sonnet-5";
// 64k output is well within Claude 5 Sonnet's ceiling and gives us
// headroom for a full-issue extraction (many features + long bodies +
// verbatim quotes). At 16k we saw truncated JSON on a modest 2005 issue.
const MAX_OUTPUT_TOKENS = 64_000;

// Categories the editor uses today — we ask Claude to pick from this
// list rather than invent free-form ones so the mapping to our
// existing category IDs stays clean.
const CATEGORY_HINTS = [
  "people",
  "culture",
  "events",
  "fashion",
  "business",
  "interiors",
  "appetite",
  "travel",
  "paparazzi",
];

const SYSTEM_PROMPT = `You are a magazine sub-editor helping Gallery Magazine (Jersey, Channel Islands, in print since 2004) re-import old print editions into their digital archive.

You will be given the plain-text transcript of one issue, extracted from the PDF's text layer with pages delimited by "===== PAGE N =====" markers. Text will be in visual reading order but will include drop caps, pull quotes, image captions and column-break oddities as they appeared on the page. Use judgement.

Extract ONLY the MAIN FEATURE articles — the pieces of ~500+ words with a real byline that would warrant their own web page. Do NOT extract:
  • Ads
  • Contents pages / masthead / staff listings
  • Short news snippets / listings / event calendars / classifieds
  • Small captioned photos without narrative prose
  • Editor's letter (handled separately)
  • Recipe cards, product round-ups, or one-page "shopping" pages

For each real feature, capture:
  • title — the printed headline verbatim
  • standfirst — the italic hook under the headline, if any (empty string if none)
  • byline — the writer's credited name (empty string if uncredited)
  • body — the article's full text, paragraphs separated by blank lines. Use "## Subhead" for internal section breaks if the piece has them. Preserve pull quotes on their own line prefixed with "> ". Strip stray drop caps and repeated pull-quote text. Do NOT invent copy or paraphrase — quote verbatim from the transcript.
  • estimated_page_range — [startPage, endPage] using the "===== PAGE N =====" markers you can see.
  • suggested_category — one of: ${CATEGORY_HINTS.join(", ")}. Pick the best fit; use "culture" as a catch-all for arts / features you can't slot elsewhere.
  • lead_image_description — one short sentence describing what image on those pages would work as the lead. You can only guess from captions + surrounding text since you don't see the images directly.

Additionally, identify the PAPARAZZI section if present — Gallery Magazine has, since day one, run a section of party / society photos usually labelled "Paparazzi" or "Snapped" or "Out and About". This is typically 4-12 contiguous pages of grouped party photos with heavy caption text. If you find it, include a paparazzi_section object with its page range and the printed label. Ignore if you're not sure — false positives here mean the editor imports the wrong pages as a gallery.

Return valid JSON, no code fences, no prose:
{
  "articles": [ { "title": "...", "standfirst": "...", "byline": "...", "body": "...", "estimated_page_range": [n, m], "suggested_category": "...", "lead_image_description": "..." } ],
  "paparazzi_section": { "estimated_page_range": [n, m], "label": "Paparazzi" } | null
}

If the transcript contains no extractable feature articles, return { "articles": [], "paparazzi_section": null }.`;

export interface ExtractedArticle {
  title: string;
  standfirst: string;
  byline: string;
  body: string;
  estimated_page_range: [number, number];
  suggested_category: string;
  lead_image_description: string;
}

export interface PaparazziSection {
  estimated_page_range: [number, number];
  label: string;
}

export interface IngestResult {
  articles: ExtractedArticle[];
  paparazzi_section: PaparazziSection | null;
  /** Raw usage from the Claude call so callers can display / log costs. */
  usage: { input_tokens: number; output_tokens: number };
  /** How many pages the PDF had, so the UI can show "extracted from N
   *  pages". Derived from the transcript's page markers. */
  page_count: number;
}

/**
 * Download the PDF and run `pdftotext -layout` on it. The `-layout`
 * flag preserves the visual arrangement (columns, indents) which reads
 * more naturally to the language model than the default flat text
 * mode. Returns the plain-text transcript with page markers so Claude
 * can attribute articles to page ranges.
 */
async function pdfToPageTranscript(pdfUrl: string): Promise<{ text: string; pageCount: number }> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = await mkdtemp(path.join(os.tmpdir(), "gallery-pdftxt-"));
  const pdfPath = path.join(dir, "input.pdf");
  await writeFile(pdfPath, buf);
  try {
    // First, discover the page count via pdfinfo. We could infer it
    // from the -layout output but this is more reliable and cheap.
    const { stdout: infoOut } = await execFileP("pdfinfo", [pdfPath]);
    const match = infoOut.match(/^Pages:\s+(\d+)/m);
    const pageCount = match ? Number(match[1]) : 0;
    if (!pageCount) {
      throw new Error("Couldn't read the PDF page count via pdfinfo — is it a real PDF?");
    }

    // Extract text page-by-page so we can wrap each with a PAGE N
    // marker. `pdftotext -layout -f N -l N` scopes to a single page.
    // Alternative: single call + split on \f (form feed), which
    // pdftotext emits between pages. Cheaper and one shell round-trip.
    const outPath = path.join(dir, "input.txt");
    await execFileP("pdftotext", ["-layout", pdfPath, outPath]);
    const wholeText = await readFile(outPath, "utf8");
    // Poppler separates pages with a form-feed (0x0C). If the PDF is
    // one long stream (no form feeds — rare, but possible for some
    // exports), fall back to a single "PAGE 1" wrap.
    const pages = wholeText.split("\f");
    const markedPages = pages
      .map((page, i) => {
        const trimmed = page.replace(/\s+$/g, "");
        if (!trimmed.trim()) return null; // skip blank pages
        return `===== PAGE ${i + 1} =====\n${trimmed}`;
      })
      .filter(Boolean);
    return { text: markedPages.join("\n\n"), pageCount };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function parseJsonPayload(text: string): {
  articles: ExtractedArticle[];
  paparazzi_section: PaparazziSection | null;
} {
  const trimmed = text.trim();
  // Robust extraction: find the first `{` and the LAST `}` anywhere
  // in the response. Handles all the ways Claude can wrap the payload:
  //   1. Raw JSON (best case)
  //   2. Code-fenced (```json … ```)
  //   3. Prose preamble + JSON + trailing prose
  //   4. Fence-started but truncated response (no closing fence)
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const raw =
    firstBrace !== -1 && lastBrace > firstBrace
      ? trimmed.slice(firstBrace, lastBrace + 1)
      : trimmed;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.articles)) {
      throw new Error("Response missing `articles` array");
    }
    let paparazzi: PaparazziSection | null = null;
    const p = parsed.paparazzi_section;
    if (
      p &&
      Array.isArray(p.estimated_page_range) &&
      p.estimated_page_range.length === 2 &&
      Number.isInteger(p.estimated_page_range[0]) &&
      Number.isInteger(p.estimated_page_range[1])
    ) {
      paparazzi = {
        estimated_page_range: [p.estimated_page_range[0], p.estimated_page_range[1]],
        label: typeof p.label === "string" && p.label.trim() ? p.label.trim() : "Paparazzi",
      };
    }
    return { articles: parsed.articles, paparazzi_section: paparazzi };
  } catch (err: any) {
    console.error(
      "pdfIngest parse failed. Raw payload head:",
      text.slice(0, 500),
      "\n… tail:",
      text.slice(-300),
    );
    throw new Error(
      `Couldn't parse Claude's JSON (${err?.message || err}). ` +
        `Response was ${text.length} chars — likely truncated at max_tokens or malformed.`,
    );
  }
}

export async function ingestPdf(pdfUrl: string): Promise<IngestResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Rip the text out of the PDF. Way cheaper than sending the whole
  // document as vision — a 48-page magazine transcript is roughly
  // 15-30k tokens vs 100k+ for the same PDF rendered.
  const { text: transcript, pageCount } = await pdfToPageTranscript(pdfUrl);
  if (!transcript.trim()) {
    throw new Error(
      "PDF text layer was empty — the file is probably a scan without OCR. Tesseract fallback is not yet wired.",
    );
  }

  // Stream to sidestep the SDK's 10-minute no-stream guard. This call
  // is now text-only and much faster than the vision-heavy whole-PDF
  // path, but 60s+ is realistic for full-issue extraction so streaming
  // is still the safe path.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is the text transcript of the magazine. Extract main features per the schema; return JSON only.\n\n${transcript}`,
      },
    ],
  });
  const response = await stream.finalMessage();

  const raw = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const { articles, paparazzi_section } = parseJsonPayload(raw);
  return {
    articles,
    paparazzi_section,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
    page_count: pageCount,
  };
}
