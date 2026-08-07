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
const MAX_OUTPUT_TOKENS = 16_384;

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

Return valid JSON, no code fences, no prose:
{
  "articles": [ { "title": "...", "standfirst": "...", "byline": "...", "body": "...", "estimated_page_range": [n, m], "suggested_category": "...", "lead_image_description": "..." } ]
}

If the PDF contains no extractable feature articles (e.g. it's a mostly-visual issue), return { "articles": [] }.`;

export interface ExtractedArticle {
  title: string;
  standfirst: string;
  byline: string;
  body: string;
  estimated_page_range: [number, number];
  suggested_category: string;
  lead_image_description: string;
}

export interface IngestResult {
  articles: ExtractedArticle[];
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
function parseJsonPayload(text: string): { articles: ExtractedArticle[] } {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/);
  const raw = fenceMatch ? fenceMatch[1] : trimmed;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.articles)) {
      throw new Error("Response missing `articles` array");
    }
    return parsed;
  } catch (err: any) {
    throw new Error(`Couldn't parse Claude's JSON: ${err?.message || err}`);
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
    ],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const { articles } = parseJsonPayload(text);
  return {
    articles,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
