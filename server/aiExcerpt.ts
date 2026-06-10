import Anthropic from "@anthropic-ai/sdk";

/**
 * Small, focused wrapper around Claude Haiku 3.5 for excerpt drafting.
 *
 * Why Haiku 3.5: cheapest in the Anthropic family at the time of writing
 * (~$0.80 / 1M input, $4 / 1M output) — a typical article excerpt costs
 * ~$0.003. Quality is more than enough for a 1-2 sentence standfirst the
 * editor will still glance at before saving.
 *
 * The key is read from ANTHROPIC_API_KEY at call time so a missing key
 * yields a clear error message instead of crashing the server on boot.
 */

const MODEL = "claude-3-5-haiku-latest";
const MAX_TOKENS = 200; // ~150 words headroom; we ask for far less.

/** Strip HTML to plain text — keeps paragraph breaks readable for the model. */
function htmlToPlainText(html: string): string {
  return html
    // Convert block-level closes to line breaks so paragraph structure survives.
    .replace(/<\/(p|h[1-6]|li|blockquote|div|figure|figcaption|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip remaining tags.
    .replace(/<[^>]+>/g, "")
    // Decode the handful of entities that show up most.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&hellip;/g, "…")
    // Collapse runs of whitespace.
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const SYSTEM_PROMPT = `You are a sub-editor at Gallery Magazine, Jersey's life & style magazine (in print since 2004). Write standfirsts — the short hook that runs under a headline.

Rules:
- One or two sentences. 25-35 words. Never more than 40.
- Present tense, active voice, factual but evocative.
- Don't repeat the headline. Add something — a hook, a stake, a specific.
- Magazine voice: literate, slightly dry, never breathless. Avoid clickbait verbs ("discover", "explore", "dive into"), marketing adjectives ("ultimate", "amazing", "must-read"), and rhetorical questions.
- Local where relevant — Jersey, the Channel Islands, the parishes. But don't force it.
- Return only the standfirst text. No quotes, no labels, no preamble, no markdown.`;

export interface ExcerptInput {
  title: string;
  content: string;
}

export async function generateExcerpt({ title, content }: ExcerptInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const plain = htmlToPlainText(content);
  // Hard-cap the article body sent to the model so a 10,000-word feature
  // doesn't balloon the input cost. The first ~2500 words is plenty of
  // context for a standfirst — and matches how a sub-editor would skim.
  const trimmed = plain.length > 12_000 ? plain.slice(0, 12_000) + "\n[...]" : plain;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Headline: ${title.trim()}\n\nArticle:\n${trimmed}`,
      },
    ],
  });

  // The response is an array of content blocks; we asked for plain text
  // so it's a single text block in practice. Concatenate defensively.
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  if (!text) {
    throw new Error("Empty response from Claude — try again");
  }

  // Strip surrounding quotes if Haiku adds them despite the instruction.
  return text.replace(/^["'“‘]+|["'”’]+$/g, "").trim();
}
