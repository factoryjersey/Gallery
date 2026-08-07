import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Sparkles, Check, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExtractedArticle {
  title: string;
  standfirst: string;
  byline: string;
  body: string;
  estimated_page_range: [number, number];
  suggested_category: string;
  lead_image_description: string;
}

interface IngestResponse {
  articles: ExtractedArticle[];
  usage: { input_tokens: number; output_tokens: number };
}

interface Category {
  id: string;
  slug: string;
  name: string;
}
interface Author {
  id: string;
  slug: string;
  name: string;
}
interface Issue {
  id: string;
  number: number;
  title: string | null;
  pdfUrl: string | null;
  displayLabel: string | null;
}

// Rough per-token pricing snapshot for the label under each extraction.
// Values here are order-of-magnitude — exact billing is in the Anthropic
// console. The point is to give editors a "well under a pound" signal.
const INPUT_COST_PER_M = 3.0; // $/M input tokens (Sonnet 5, mid-range)
const OUTPUT_COST_PER_M = 15.0;

function formatCost(usage: { input_tokens: number; output_tokens: number }): string {
  const dollars =
    (usage.input_tokens / 1_000_000) * INPUT_COST_PER_M +
    (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_M;
  return dollars < 0.01 ? "<$0.01" : `$${dollars.toFixed(2)}`;
}

/** Rough word count from a plain-text body. Used for the read-time
 *  chip and word-count summary. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Slug from a title using the same character rules as our storage
 * layer (kebab, lowercase, alphanumerics only). Server-side slug
 * auto-suffixing handles collisions if two ingested articles happen
 * to have identical titles.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Turn Claude's markdown-lite body into an article-editor-friendly
 * HTML string. Blank lines split paragraphs; `## Subhead` becomes
 * <h2>; pull quotes prefixed with `> ` become <blockquote>. Kept
 * intentionally lightweight — no heavy Markdown deps for a couple of
 * transformations. TipTap can parse this cleanly.
 */
function bodyToHtml(body: string): string {
  const blocks = body.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("## ")) {
        return `<h2>${trimmed.slice(3).trim()}</h2>`;
      }
      if (trimmed.startsWith("> ")) {
        return `<blockquote><p>${trimmed
          .split("\n")
          .map((l) => l.replace(/^>\s*/, ""))
          .join(" ")}</p></blockquote>`;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export function PdfIngestManager() {
  const { toast } = useToast();
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [issueNumber, setIssueNumber] = useState<string>("");
  const [results, setResults] = useState<IngestResponse | null>(null);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  // Per-article edits keyed by extraction index so the editor can
  // tweak title / body / byline before publishing without mutating
  // the raw extraction (handy if they want to re-generate).
  const [edits, setEdits] = useState<Record<number, Partial<ExtractedArticle>>>({});

  const { data: issuesData } = useQuery<{ issues: Issue[] }>({
    queryKey: ["/api/issues"],
  });
  const { data: categoriesData } = useQuery<{ categories: Category[] }>({
    queryKey: ["/api/categories"],
  });
  const { data: authorsData } = useQuery<{ authors: Author[] }>({
    queryKey: ["/api/authors"],
  });

  const issues = useMemo(
    () => (issuesData?.issues ?? []).slice().sort((a, b) => a.number - b.number),
    [issuesData],
  );
  const categories = categoriesData?.categories ?? [];
  const authors = authorsData?.authors ?? [];

  // Find best-fit category id from Claude's slug guess. Falls back to
  // a rough substring match, then to the first category as a
  // safety-net so the article can still save.
  const categoryIdBySlugHint = (hint: string): string | undefined => {
    const norm = (hint || "").toLowerCase();
    let match = categories.find((c) => c.slug === norm);
    if (!match) match = categories.find((c) => c.slug.includes(norm) || c.name.toLowerCase().includes(norm));
    return match?.id;
  };

  // Fuzzy match the extracted byline to an existing author row.
  // Exact-name first, then normalised match (case + spaces).
  const authorIdByName = (name: string): string | undefined => {
    const clean = (name || "").trim();
    if (!clean) return undefined;
    let match = authors.find((a) => a.name === clean);
    if (!match) {
      const norm = clean.toLowerCase().replace(/\s+/g, " ");
      match = authors.find((a) => a.name.toLowerCase().replace(/\s+/g, " ") === norm);
    }
    return match?.id;
  };

  const ingest = useMutation({
    mutationFn: async (url: string): Promise<IngestResponse> => {
      const res = await apiRequest("POST", "/api/admin/ingest-pdf", { pdfUrl: url });
      return res.json();
    },
    onSuccess: (data) => {
      setResults(data);
      setDismissed(new Set());
      setEdits({});
      toast({
        title: `Extracted ${data.articles.length} article${data.articles.length === 1 ? "" : "s"}`,
        description: `Est. cost: ${formatCost(data.usage)}. Review each below.`,
      });
    },
    onError: (err: any) => {
      const raw = err?.message || "";
      const m = raw.match(/^\d+:\s*(.*)$/);
      let msg = m ? m[1] : raw;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) msg = parsed.error;
      } catch {}
      toast({
        title: "Extraction failed",
        description: msg || "Try again.",
        variant: "destructive",
      });
    },
  });

  const publishOne = useMutation({
    mutationFn: async ({ article, i }: { article: ExtractedArticle; i: number }) => {
      const merged = { ...article, ...edits[i] } as ExtractedArticle;
      const categoryId =
        categoryIdBySlugHint(merged.suggested_category) || categories[0]?.id;
      const authorId = authorIdByName(merged.byline) || authors[0]?.id;
      if (!categoryId) throw new Error("No categories in the DB — can't save.");
      if (!authorId) throw new Error("No authors in the DB — can't save.");
      const words = wordCount(merged.body);
      const payload = {
        title: merged.title,
        slug: slugify(merged.title),
        excerpt: merged.standfirst || "",
        content: bodyToHtml(merged.body),
        categoryId,
        authorId,
        photographer: "",
        illustrator: "",
        status: "draft" as const,
        contentType: "article" as const,
        readTime: Math.max(1, Math.ceil(words / 200)),
        issueNumber: issueNumber ? Number(issueNumber) : undefined,
        homepageHighlight: false,
        tags: [],
      };
      const res = await apiRequest("POST", "/api/articles", payload);
      return res.json();
    },
    onSuccess: (_data, vars) => {
      setDismissed((prev) => new Set(prev).add(vars.i));
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/articles"),
      });
      toast({
        title: "Draft saved",
        description: `"${vars.article.title}" is in the article list as a draft.`,
      });
    },
    onError: (err: any) => {
      const raw = err?.message || "";
      const m = raw.match(/^\d+:\s*(.*)$/);
      let msg = m ? m[1] : raw;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) msg = parsed.error;
      } catch {}
      toast({
        title: "Couldn't save draft",
        description: msg || "Try again.",
        variant: "destructive",
      });
    },
  });

  const remaining = (results?.articles ?? []).filter((_, i) => !dismissed.has(i));

  return (
    <div className="space-y-6" data-testid="pdf-ingest-manager">
      <div>
        <h2 className="text-xl font-bold mb-1">Import articles from a PDF</h2>
        <p className="text-sm text-muted-foreground">
          Claude reads the whole PDF and pulls out every main feature article. Snippets, ads and
          listings are skipped. Nothing publishes automatically — each result appears below as a
          reviewable draft. Approve one and it lands in the article list with status = "draft",
          ready to open in the editor for final polish + lead image.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Choose a PDF
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Pick an issue</label>
            <select
              value={pdfUrl}
              onChange={(e) => {
                const chosen = issues.find((i) => i.pdfUrl === e.target.value);
                setPdfUrl(e.target.value);
                if (chosen) setIssueNumber(String(chosen.number));
              }}
              className="w-full px-3 py-2 border border-input rounded bg-background text-sm"
              data-testid="pdf-ingest-issue"
            >
              <option value="">— pick an issue with a PDF —</option>
              {issues
                .filter((i) => i.pdfUrl)
                .map((i) => (
                  <option key={i.id} value={i.pdfUrl!}>
                    Gallery #{i.number}
                    {i.displayLabel ? ` — ${i.displayLabel}` : i.title ? ` — ${i.title}` : ""}
                  </option>
                ))}
            </select>
          </div>
          <div className="text-xs text-muted-foreground">or</div>
          <div>
            <label className="text-sm font-medium block mb-1">Paste PDF URL</label>
            <Input
              type="url"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              placeholder="https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev/…"
              data-testid="pdf-ingest-url"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Only R2 URLs (*.r2.dev) accepted — we never fetch arbitrary hosts.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Issue number for imported drafts (optional)
            </label>
            <Input
              type="number"
              value={issueNumber}
              onChange={(e) => setIssueNumber(e.target.value)}
              placeholder="e.g. 8"
              className="max-w-[160px]"
              data-testid="pdf-ingest-issue-number"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Auto-filled when you pick an issue above. Sets the imported drafts' issueNumber
              field so they show up on the right Current Issue surface.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              onClick={() => ingest.mutate(pdfUrl.trim())}
              disabled={!pdfUrl.trim() || ingest.isPending}
              data-testid="pdf-ingest-run"
            >
              {ingest.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting (30-60s)…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" /> Extract main features
                </>
              )}
            </Button>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                Preview PDF <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold">
              Extracted {remaining.length} of {results.articles.length}{" "}
              article{results.articles.length === 1 ? "" : "s"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {results.usage.input_tokens.toLocaleString()} in · {results.usage.output_tokens.toLocaleString()} out ·
              approx {formatCost(results.usage)}
            </span>
          </div>
          {remaining.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">
              All extracted articles handled. Re-run to try again with different results.
            </div>
          )}
          {results.articles.map((article, i) => {
            if (dismissed.has(i)) return null;
            const merged = { ...article, ...edits[i] } as ExtractedArticle;
            const words = wordCount(merged.body);
            const patch = (p: Partial<ExtractedArticle>) =>
              setEdits((prev) => ({ ...prev, [i]: { ...prev[i], ...p } }));
            const matchedCat = categoryIdBySlugHint(merged.suggested_category);
            const matchedAuthor = authorIdByName(merged.byline);
            return (
              <Card key={i} data-testid={`pdf-ingest-article-${i}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Input
                        value={merged.title}
                        onChange={(e) => patch({ title: e.target.value })}
                        className="text-lg font-semibold"
                      />
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="secondary">
                          pp {merged.estimated_page_range?.[0]}–{merged.estimated_page_range?.[1]}
                        </Badge>
                        <Badge variant={matchedCat ? "default" : "outline"}>
                          {merged.suggested_category}
                          {!matchedCat && " (unmatched)"}
                        </Badge>
                        <Badge variant="outline">{words} words</Badge>
                        {merged.byline && (
                          <Badge variant={matchedAuthor ? "default" : "outline"}>
                            by {merged.byline}
                            {!matchedAuthor && " (new author)"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDismissed((prev) => new Set(prev).add(i))}
                      className="text-muted-foreground hover:text-foreground"
                      title="Discard"
                      data-testid={`pdf-ingest-dismiss-${i}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1">Standfirst</label>
                    <Input
                      value={merged.standfirst || ""}
                      onChange={(e) => patch({ standfirst: e.target.value })}
                      placeholder="(no standfirst extracted)"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Byline</label>
                    <Input
                      value={merged.byline || ""}
                      onChange={(e) => patch({ byline: e.target.value })}
                      placeholder="(uncredited)"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1">Body ({words} words)</label>
                    <textarea
                      value={merged.body}
                      onChange={(e) => patch({ body: e.target.value })}
                      className="w-full text-sm font-serif border border-input rounded bg-background p-3 min-h-[220px] max-h-[420px]"
                      style={{ fontFamily: "Georgia, serif", lineHeight: 1.5 }}
                    />
                  </div>
                  {merged.lead_image_description && (
                    <p className="text-xs italic text-muted-foreground">
                      Suggested lead image: {merged.lead_image_description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      type="button"
                      onClick={() => publishOne.mutate({ article: merged, i })}
                      disabled={publishOne.isPending}
                      data-testid={`pdf-ingest-save-${i}`}
                    >
                      {publishOne.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" /> Save as draft
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Opens as a draft in the article list — set the lead image + polish there.
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
