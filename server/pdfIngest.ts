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

  // Rip the text out of the PDF. Way cheaper than sending the whole
  // document as vision — a 48-page magazine transcript is roughly
  // 15-30k tokens vs 100k+ for the same PDF rendered.
  const { text: transcript, pageCount } = await pdfToPageTranscript(pdfUrl);
  phase("pdftotext done", { pageCount, transcriptChars: transcript.length });

  if (!transcript.trim()) {
    throw new Error(
      "PDF text layer was empty — the file is probably a scan without OCR. Tesseract fallback is not yet wired.",
    );
  }

  // Stream to sidestep the SDK's 10-minute no-stream guard. This call
  // is now text-only and much faster than the vision-heavy whole-PDF
  // path, but 60s+ is realistic for full-issue extraction so streaming
  // is still the safe path.
  //
  // Wrap the whole "call Claude → parse JSON" in a retry-once so a
  // single flaky response (Claude echoing back the transcript instead
  // of returning JSON, occasional stream aborts, transient 5xxs)
  // doesn't fail an entire batch-imported issue. Also enforce a hard
  // 6-minute per-attempt timeout via AbortSignal — the previous
  // Claude stream would occasionally hang indefinitely, forcing the
  // batch script user to Ctrl+C and manually resume.
  const PER_ATTEMPT_TIMEOUT_MS = 6 * 60 * 1000;

  const callAndParse = async (attempt: number) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
    try {
      const stream = client.messages.stream(
        {
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              // Wrap the transcript in explicit markers and re-affirm
              // the schema AFTER the transcript so the last thing
              // Claude reads is "return JSON, don't continue the
              // text". This fixes a failure mode on very long inputs
              // where Claude occasionally interpreted the transcript
              // as text to continue (echoing a fragment like ": dandara
              // sales suite…") rather than material to analyse.
              content:
                `Below is the text transcript of a magazine issue, delimited by markers. ` +
                `Treat it strictly as reference material to analyse — do NOT continue, ` +
                `reproduce, or echo the transcript in your response.\n\n` +
                `===== BEGIN MAGAZINE TRANSCRIPT =====\n\n` +
                transcript +
                `\n\n===== END MAGAZINE TRANSCRIPT =====\n\n` +
                `Now return valid JSON matching the schema in the system message. ` +
                `Start your response with the opening brace "{". No prose, no code ` +
                `fences, no continuation of the transcript above.`,
            },
          ],
        },
        { signal: controller.signal },
      );
      const response = await stream.finalMessage();
      phase(attempt === 1 ? "claude call done" : `claude call done (attempt ${attempt})`, {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });
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

  phase("claude call opening");
  let result: { parsed: ReturnType<typeof parseJsonPayload>; usage: { input_tokens: number; output_tokens: number } };
  try {
    result = await callAndParse(1);
  } catch (err: any) {
    // Log and retry once. Retry catches the two most common failure
    // shapes: Claude echoing back the transcript instead of JSON
    // (parseJsonPayload throws), and the stream aborting or hitting
    // the per-attempt timeout above. If the retry ALSO fails, throw
    // whichever error occurred second — the caller decides how to
    // surface it (batch script logs + moves on; the admin UI toasts).
    const kind = err?.name === "AbortError" ? "timeout" : "error";
    phase(`claude call ${kind}, retrying once`, { error: String(err?.message || err).slice(0, 200) });
    result = await callAndParse(2);
  }

  return {
    articles: result.parsed.articles,
    photo_sections: result.parsed.photo_sections,
    paparazzi_section: result.parsed.paparazzi_section,
    usage: {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
    },
    page_count: pageCount,
  };
}
