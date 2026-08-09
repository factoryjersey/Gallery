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

Additionally, identify any PHOTO SECTIONS — pages that are deliberately image-heavy with minimal narrative prose. These are DELIBERATE editorial content (not the "small captioned photos" you're supposed to skip in the article list above); the difference is scale and intent. Types to look for:

  • fashion_shoot — an editorial fashion / beauty shoot, usually 4-8 pages of styled photography with credits at the end ("Photography by X, Styling by Y, Model Z"). The transcript will be sparse — mostly credits + one-line captions.
  • event — coverage of a single named event (gala, launch, opening, awards), usually 1-4 pages with a header naming the event and photo captions naming attendees. NOT the general paparazzi rollup.
  • paparazzi — the general nightlife / party rollup. Typically 4-12 contiguous pages, labelled "Paparazzi" or "Snapped" or "Out and About", covering multiple events grouped together. Only ONE per issue.
  • portfolio — a photographer / artist portfolio feature. Rare.

For each photo section, capture:
  • type — one of the four above.
  • estimated_page_range — [startPage, endPage]
  • label — printed section header if present ("Paparazzi", "SS05 Denim", "Battle of the Flowers Gala"), else best-guess from context
  • credits — for fashion_shoot only: any "Photography by / Styling by / Model" credit line. Empty string if absent or not a fashion_shoot.
  • caption_hint — one short sentence describing what the photos appear to show, based on the caption text.

Ignore if you're not sure — a false positive means the editor imports the wrong pages as a gallery.

Return valid JSON, no code fences, no prose:
{
  "articles": [ { "title": "...", "standfirst": "...", "byline": "...", "body": "...", "estimated_page_range": [n, m], "suggested_category": "...", "lead_image_description": "..." } ],
  "photo_sections": [ { "type": "fashion_shoot" | "event" | "paparazzi" | "portfolio", "estimated_page_range": [n, m], "label": "...", "credits": "...", "caption_hint": "..." } ]
}

If the transcript has neither feature articles nor photo sections, return { "articles": [], "photo_sections": [] }.`;

export interface ExtractedArticle {
  title: string;
  standfirst: string;
  byline: string;
  body: string;
  estimated_page_range: [number, number];
  suggested_category: string;
  lead_image_description: string;
}

export type PhotoSectionType = "fashion_shoot" | "event" | "paparazzi" | "portfolio";

export interface PhotoSection {
  type: PhotoSectionType;
  estimated_page_range: [number, number];
  label: string;
  /** Fashion-shoot credit line (photography / styling / model). Empty
   *  for other types or when absent. */
  credits: string;
  /** One-sentence description of what the photos appear to show. */
  caption_hint: string;
}

/** Kept for one deploy so any old callers referencing paparazzi_section
 *  don't break at the moment of upgrade. Derived from the first
 *  paparazzi entry in photo_sections if present. */
export interface PaparazziSection {
  estimated_page_range: [number, number];
  label: string;
}

export interface IngestResult {
  articles: ExtractedArticle[];
  photo_sections: PhotoSection[];
  paparazzi_section: PaparazziSection | null;
  /** Raw usage from the Claude call so callers can display / log costs. */
  usage: { input_tokens: number; output_tokens: number };
  /** How many pages the PDF had, so the UI can show "extracted from N
   *  pages". Derived from the transcript's page markers. */
  page_count: number;
}

const VALID_PHOTO_TYPES = new Set<PhotoSectionType>([
  "fashion_shoot",
  "event",
  "paparazzi",
  "portfolio",
]);

/** Human-readable default when Claude omits a label. */
function defaultLabelFor(type: PhotoSectionType): string {
  switch (type) {
    case "fashion_shoot":
      return "Fashion shoot";
    case "event":
      return "Event";
    case "paparazzi":
      return "Paparazzi";
    case "portfolio":
      return "Portfolio";
  }
}

interface Page {
  page: number;
  text: string;
}

/**
 * Download the PDF and run `pdftotext -layout` on it. Returns one
 * entry per non-empty page (blank pages dropped) so the caller can
 * chunk by page range. Also returns the total page count for progress
 * reporting.
 */
async function pdfToPages(pdfUrl: string): Promise<{ pages: Page[]; pageCount: number }> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = await mkdtemp(path.join(os.tmpdir(), "gallery-pdftxt-"));
  const pdfPath = path.join(dir, "input.pdf");
  await writeFile(pdfPath, buf);
  try {
    const { stdout: infoOut } = await execFileP("pdfinfo", [pdfPath]);
    const match = infoOut.match(/^Pages:\s+(\d+)/m);
    const pageCount = match ? Number(match[1]) : 0;
    if (!pageCount) {
      throw new Error("Couldn't read the PDF page count via pdfinfo — is it a real PDF?");
    }
    const outPath = path.join(dir, "input.txt");
    await execFileP("pdftotext", ["-layout", pdfPath, outPath]);
    const wholeText = await readFile(outPath, "utf8");
    // Poppler separates pages with a form-feed (0x0C).
    const rawPages = wholeText.split("\f");
    const pages: Page[] = [];
    for (let i = 0; i < rawPages.length; i++) {
      const trimmed = rawPages[i].replace(/\s+$/g, "");
      if (!trimmed.trim()) continue; // skip blank pages
      pages.push({ page: i + 1, text: trimmed });
    }
    return { pages, pageCount };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Wrap a set of pages into a transcript string with per-page markers,
 * ready to send to Claude.
 */
function pagesToTranscript(pages: Page[]): string {
  return pages
    .map((p) => `===== PAGE ${p.page} =====\n${p.text}`)
    .join("\n\n");
}

/**
 * Merge extraction results from multiple chunks into one deduplicated
 * result. Articles are deduped by normalised title (chunk overlap can
 * cause the same article to appear in adjacent chunks); we keep the
 * entry with the longest body. Photo sections are deduped by
 * overlapping page ranges of the same type.
 */
function mergeChunkResults(
  chunks: Array<{ articles: ExtractedArticle[]; photo_sections: PhotoSection[] }>,
): { articles: ExtractedArticle[]; photo_sections: PhotoSection[] } {
  const normTitle = (s: string) =>
    s.toLowerCase().replace(/\s+/g, " ").trim();
  const articlesByTitle = new Map<string, ExtractedArticle>();
  for (const chunk of chunks) {
    for (const a of chunk.articles) {
      const key = normTitle(a.title);
      const existing = articlesByTitle.get(key);
      if (!existing || (a.body?.length ?? 0) > (existing.body?.length ?? 0)) {
        articlesByTitle.set(key, a);
      }
    }
  }
  // Photo sections: dedupe by type + overlapping page range. Two
  // paparazzi sections whose ranges touch or overlap merge into one
  // spanning the union.
  const bySection: PhotoSection[] = [];
  for (const chunk of chunks) {
    outer: for (const s of chunk.photo_sections) {
      for (const existing of bySection) {
        if (existing.type !== s.type) continue;
        const [aStart, aEnd] = existing.estimated_page_range;
        const [bStart, bEnd] = s.estimated_page_range;
        // Ranges overlap or touch (within 1 page).
        if (bStart <= aEnd + 1 && bEnd >= aStart - 1) {
          existing.estimated_page_range = [
            Math.min(aStart, bStart),
            Math.max(aEnd, bEnd),
          ];
          if (!existing.label && s.label) existing.label = s.label;
          if (!existing.credits && s.credits) existing.credits = s.credits;
          if (!existing.caption_hint && s.caption_hint) existing.caption_hint = s.caption_hint;
          continue outer;
        }
      }
      bySection.push({ ...s });
    }
  }
  return {
    articles: [...articlesByTitle.values()],
    photo_sections: bySection,
  };
}

function parseJsonPayload(text: string): {
  articles: ExtractedArticle[];
  photo_sections: PhotoSection[];
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

    // Normalise photo_sections: filter out malformed entries, coerce
    // types to known values, ensure all required fields exist as
    // strings so the client can trust the shape.
    const rawSections = Array.isArray(parsed?.photo_sections)
      ? parsed.photo_sections
      : [];
    const photo_sections: PhotoSection[] = [];
    for (const s of rawSections) {
      if (
        !s ||
        !VALID_PHOTO_TYPES.has(s.type) ||
        !Array.isArray(s.estimated_page_range) ||
        s.estimated_page_range.length !== 2 ||
        !Number.isInteger(s.estimated_page_range[0]) ||
        !Number.isInteger(s.estimated_page_range[1])
      ) {
        continue;
      }
      photo_sections.push({
        type: s.type,
        estimated_page_range: [s.estimated_page_range[0], s.estimated_page_range[1]],
        label:
          typeof s.label === "string" && s.label.trim()
            ? s.label.trim()
            : defaultLabelFor(s.type),
        credits: typeof s.credits === "string" ? s.credits.trim() : "",
        caption_hint: typeof s.caption_hint === "string" ? s.caption_hint.trim() : "",
      });
    }

    // Backwards-compat: derive paparazzi_section from the first
    // paparazzi entry in photo_sections. Old client code (pre this
    // deploy) still reads this field.
    const firstPap = photo_sections.find((s) => s.type === "paparazzi");
    const paparazzi_section: PaparazziSection | null = firstPap
      ? { estimated_page_range: firstPap.estimated_page_range, label: firstPap.label }
      : null;

    return { articles: parsed.articles, photo_sections, paparazzi_section };
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

/** Callback the route handler passes in so ingest phases stream out
 *  as SSE events (in addition to being logged server-side). */
export type PhaseCallback = (name: string, extra?: Record<string, unknown>) => void;

export async function ingestPdf(
  pdfUrl: string,
  onPhase?: PhaseCallback,
): Promise<IngestResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const startedAt = Date.now();
  const phase = (name: string, extra?: Record<string, unknown>) => {
    console.log(
      `[pdfIngest] ${((Date.now() - startedAt) / 1000).toFixed(1)}s ${name}` +
        (extra ? " " + JSON.stringify(extra) : ""),
    );
    onPhase?.(name, extra);
  };

  phase("start", { pdfUrl });

  // Rip text pages out of the PDF. Way cheaper than sending the whole
  // document as vision — a 48-page magazine transcript is roughly
  // 15-30k tokens vs 100k+ for the same PDF rendered.
  const { pages, pageCount } = await pdfToPages(pdfUrl);
  const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
  phase("pdftotext done", { pageCount, transcriptChars: totalChars });

  if (pages.length === 0) {
    throw new Error(
      "PDF text layer was empty — the file is probably a scan without OCR. Tesseract fallback is not yet wired.",
    );
  }

  // Chunk the pages before sending to Claude. Whole-issue calls
  // (~80k tokens on a 68-page issue, ~200k on 160-page) hit the
  // fragile zone where Claude starts echoing the transcript instead
  // of extracting. 25 pages per chunk keeps each call around 25-35k
  // tokens — well inside the model's comfortable range.
  const CHUNK_PAGES = 25;
  const chunks: Page[][] = [];
  for (let i = 0; i < pages.length; i += CHUNK_PAGES) {
    chunks.push(pages.slice(i, i + CHUNK_PAGES));
  }
  phase("chunked", { chunks: chunks.length, pagesPerChunk: CHUNK_PAGES });

  // Stream to sidestep the SDK's 10-minute no-stream guard, and wrap
  // each call in retry-once + 6-min timeout so a single flaky chunk
  // response doesn't fail the whole issue. Chunks are processed
  // serially — parallel is possible but complicates rate-limit
  // handling and the wall-clock difference on 3-5 chunks isn't worth
  // the extra complexity for a batch job.
  const PER_ATTEMPT_TIMEOUT_MS = 6 * 60 * 1000;

  const callAndParse = async (chunkPages: Page[], chunkIdx: number, attempt: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
    try {
      const transcript = pagesToTranscript(chunkPages);
      const firstPage = chunkPages[0].page;
      const lastPage = chunkPages[chunkPages.length - 1].page;
      const stream = client.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content:
                `Below is a chunk of a magazine issue's text transcript ` +
                `(pages ${firstPage}–${lastPage} of ${pageCount}), delimited ` +
                `by markers. Treat it strictly as reference material to ` +
                `analyse — do NOT continue, reproduce, or echo the ` +
                `transcript in your response. Only extract features / ` +
                `photo sections that appear in THIS chunk; other chunks ` +
                `are processed separately and merged later, so don't ` +
                `worry about pieces that continue outside these pages.\n\n` +
                `===== BEGIN CHUNK TRANSCRIPT =====\n\n` +
                transcript +
                `\n\n===== END CHUNK TRANSCRIPT =====\n\n` +
                `Now return valid JSON matching the schema in the system ` +
                `message. Start your response with the opening brace "{". ` +
                `No prose, no code fences, no continuation of the ` +
                `transcript above.`,
            },
          ],
        },
        { signal: controller.signal },
      );
      const response = await stream.finalMessage();
      phase(
        attempt === 1
          ? `chunk ${chunkIdx + 1}/${chunks.length} done (pp${firstPage}-${lastPage})`
          : `chunk ${chunkIdx + 1}/${chunks.length} done attempt ${attempt} (pp${firstPage}-${lastPage})`,
        {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      );
      const raw = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      const parsed = parseJsonPayload(raw);
      return { parsed, usage: response.usage };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const chunkResults: Array<{ articles: ExtractedArticle[]; photo_sections: PhotoSection[] }> = [];
  let totalInput = 0;
  let totalOutput = 0;
  let chunksFailed = 0;

  for (let idx = 0; idx < chunks.length; idx++) {
    const chunkPages = chunks[idx];
    phase(`chunk ${idx + 1}/${chunks.length} opening`, {
      pages: `${chunkPages[0].page}-${chunkPages[chunkPages.length - 1].page}`,
    });
    let out: { parsed: ReturnType<typeof parseJsonPayload>; usage: { input_tokens: number; output_tokens: number } };
    try {
      out = await callAndParse(chunkPages, idx, 1);
    } catch (err: any) {
      const kind = err?.name === "AbortError" ? "timeout" : "error";
      phase(`chunk ${idx + 1}/${chunks.length} ${kind}, retrying once`, {
        error: String(err?.message || err).slice(0, 200),
      });
      try {
        out = await callAndParse(chunkPages, idx, 2);
      } catch (err2: any) {
        // A single bad chunk shouldn't fail the whole issue — log,
        // count, and continue with the remaining chunks. Merge below
        // just uses what did come back.
        chunksFailed++;
        phase(`chunk ${idx + 1}/${chunks.length} FAILED`, {
          error: String(err2?.message || err2).slice(0, 200),
        });
        continue;
      }
    }
    totalInput += out.usage.input_tokens;
    totalOutput += out.usage.output_tokens;
    chunkResults.push({
      articles: out.parsed.articles,
      photo_sections: out.parsed.photo_sections,
    });
  }

  if (chunkResults.length === 0) {
    throw new Error(`All ${chunks.length} chunk${chunks.length === 1 ? "" : "s"} failed`);
  }
  if (chunksFailed > 0) {
    phase(`merging with ${chunksFailed} failed chunk(s) skipped`);
  }

  // Merge dedupe: title-match for articles, page-range overlap for
  // photo sections. See mergeChunkResults for details.
  const merged = mergeChunkResults(chunkResults);
  // Backwards-compat paparazzi_section derivation, same as parseJsonPayload.
  const firstPap = merged.photo_sections.find((s) => s.type === "paparazzi");
  const paparazzi_section: PaparazziSection | null = firstPap
    ? { estimated_page_range: firstPap.estimated_page_range, label: firstPap.label }
    : null;

  return {
    articles: merged.articles,
    photo_sections: merged.photo_sections,
    paparazzi_section,
    usage: { input_tokens: totalInput, output_tokens: totalOutput },
    page_count: pageCount,
  };
}
