import Anthropic from "@anthropic-ai/sdk";

/**
 * PDF → main-feature article extraction via Claude 5 Sonnet.
 *
 * Sends the whole PDF to Claude as a document (native PDF handling —
 * both the embedded text layer AND the rendered page images are made
 * available to the model). Asks for structured JSON: one entry per
 * main feature, ignoring snippets, contents pages, ads, event
 * calendars and other magazine furniture.
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

You are given a PDF of one issue. Extract ONLY the MAIN FEATURE articles — the pieces of ~500+ words with a real byline that would warrant their own web page. Do NOT extract:
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
  • body — the article's full text, paragraphs separated by blank lines. Use "## Subhead" for internal section breaks if the piece has them. Preserve pull quotes on their own line prefixed with "> ". Do NOT invent copy or paraphrase — quote verbatim from the PDF.
  • estimated_page_range — [startPage, endPage] using the PDF's own 1-indexed page numbers
  • suggested_category — one of: ${CATEGORY_HINTS.join(", ")}. Pick the best fit; use "culture" as a catch-all for arts / features you can't slot elsewhere.
  • lead_image_description — one sentence describing the most striking image on those pages. Helps the editor pick a featured image later.

Additionally, identify the PAPARAZZI section if present — Gallery Magazine has, since day one, run a section of party / society photos usually labelled "Paparazzi" or "Snapped" or "Out and About". This is typically 4-12 contiguous pages of grouped party photos. If you find one, include a paparazzi_section object with its page range and any obvious title. Ignore it if you're not sure — false positives here mean the editor imports the wrong pages as a gallery.

Return valid JSON, no code fences, no prose:
{
  "articles": [ { "title": "...", "standfirst": "...", "byline": "...", "body": "...", "estimated_page_range": [n, m], "suggested_category": "...", "lead_image_description": "..." } ],
  "paparazzi_section": { "estimated_page_range": [n, m], "label": "Paparazzi" } | null
}

If the PDF contains no extractable feature articles (e.g. it's a mostly-visual issue), return { "articles": [], "paparazzi_section": null }.`;

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
}

/** Fetch a PDF from a URL and base64-encode it. Streams into a Buffer
 *  first — the fetch API's arrayBuffer() is memory-safe for the ~30MB
 *  PDF cap Claude accepts. */
async function fetchPdfAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

/**
 * Try to parse Claude's output as JSON. Sonnet is pretty good about
 * returning bare JSON when instructed, but we defensively handle the
 * ```json``` fence case in case a future version starts wrapping.
 */
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
  // Falls back to the whole trimmed text if we can't find braces,
  // which lets JSON.parse produce a more informative error than our
  // brace-hunting logic would.
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
    // Normalise the paparazzi field: missing / null / malformed all
    // become null so the caller can just `if (payload.paparazzi_section)`.
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
    // Log the raw payload so we can eyeball what Claude actually
    // returned when parsing fails on the next issue. Truncated to
    // keep logs sane; full response goes to console for local repro.
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
  const base64 = await fetchPdfAsBase64(pdfUrl);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          {
            type: "text",
            text: "Extract every main feature article from this magazine PDF using the schema in the system message. Return valid JSON only.",
          },
        ],
      },
      // Prefill the assistant's response with the opening brace so
      // Claude has to continue in JSON mode — no room to preface with
      // "Here's the extracted data:" or wrap in ```json ... ```.
      { role: "assistant", content: "{" },
    ],
  });

  const rawResponse = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
  // Prepend the prefilled brace so parseJsonPayload sees complete JSON.
  const text = "{" + rawResponse;

  const { articles, paparazzi_section } = parseJsonPayload(text);
  return {
    articles,
    paparazzi_section,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
