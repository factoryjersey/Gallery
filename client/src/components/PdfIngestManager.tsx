import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Sparkles, Check, X, ExternalLink, ImagePlus, Camera } from "lucide-react";
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

interface PaparazziSection {
  estimated_page_range: [number, number];
  label: string;
}

interface IngestResponse {
  articles: ExtractedArticle[];
  paparazzi_section: PaparazziSection | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface ExtractedImage {
  url: string;
  page: number;
  seq: number;
  width: number;
  height: number;
  bytes: number;
}

interface ExtractedImagesState {
  loading: boolean;
  images: ExtractedImage[];
  /** URLs the editor has ticked. First tick is the lead image; the
   *  rest become gallery_images on save. */
  selected: string[];
  error?: string;
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
  // Per-article image extraction state. Keyed by extraction index so
  // each feature card owns its own loading / thumbnails / selection.
  const [imagesByIndex, setImagesByIndex] = useState<Record<number, ExtractedImagesState>>({});
  // Paparazzi flow — separate state so it doesn't clash with the
  // article-index scheme above. The paparazzi_section from Claude's
  // extract gives us the initial page range; the editor can then hit
  // Extract to pull all images, review, and Save as a gallery.
  const [paparazziState, setPaparazziState] = useState<ExtractedImagesState>({
    loading: false,
    images: [],
    selected: [],
  });

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
      // Endpoint writes a whitespace keepalive during the long Claude
      // call — that means the response body arrives as `<spaces><json>`.
      // JSON.parse via res.json() handles leading whitespace fine.
      // Also: status is always 200 for the long path (headers commit
      // before we know the outcome), so errors show up as an `error`
      // field in the body rather than a non-2xx status — throw here
      // so onError picks them up.
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      return data;
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

  /**
   * Pulls every image out of the given page range, uploads each to R2,
   * returns the list. Used by both the per-feature card and the
   * paparazzi flow.
   */
  const runImageExtraction = async (
    pageRange: [number, number],
  ): Promise<ExtractedImage[]> => {
    const res = await apiRequest("POST", "/api/admin/ingest-pdf/extract-images", {
      pdfUrl: pdfUrl.trim(),
      pageRange,
      issueNumber: issueNumber ? Number(issueNumber) : null,
    });
    const data = await res.json();
    return data.images ?? [];
  };

  /** Toggle-select an image URL for a given card. First-selected becomes
   *  the lead image; subsequent selections queue up as gallery images. */
  const toggleImage = (
    state: ExtractedImagesState,
    setState: (next: ExtractedImagesState) => void,
    url: string,
  ) => {
    const already = state.selected.includes(url);
    const nextSelected = already
      ? state.selected.filter((u) => u !== url)
      : [...state.selected, url];
    setState({ ...state, selected: nextSelected });
  };

  const extractForArticle = async (index: number, pageRange: [number, number]) => {
    setImagesByIndex((prev) => ({
      ...prev,
      [index]: { loading: true, images: [], selected: prev[index]?.selected ?? [] },
    }));
    try {
      const images = await runImageExtraction(pageRange);
      // Default selection: none — editor picks. But if only one image
      // comes back, pre-select it as the obvious lead.
      const selected = images.length === 1 ? [images[0].url] : imagesByIndex[index]?.selected ?? [];
      setImagesByIndex((prev) => ({
        ...prev,
        [index]: { loading: false, images, selected },
      }));
    } catch (err: any) {
      const raw = err?.message || "";
      const m = raw.match(/^\d+:\s*(.*)$/);
      let msg = m ? m[1] : raw;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) msg = parsed.error;
      } catch {}
      setImagesByIndex((prev) => ({
        ...prev,
        [index]: { loading: false, images: [], selected: [], error: msg || "Extraction failed" },
      }));
      toast({ title: "Image extraction failed", description: msg, variant: "destructive" });
    }
  };

  const extractPaparazzi = async () => {
    const range = results?.paparazzi_section?.estimated_page_range;
    if (!range) return;
    setPaparazziState({ loading: true, images: [], selected: [] });
    try {
      const images = await runImageExtraction(range);
      // Paparazzi: pre-select everything — that IS the intent. Editor
      // ticks off decorative headers / spacers if any got through.
      setPaparazziState({ loading: false, images, selected: images.map((im) => im.url) });
    } catch (err: any) {
      const raw = err?.message || "";
      const m = raw.match(/^\d+:\s*(.*)$/);
      let msg = m ? m[1] : raw;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) msg = parsed.error;
      } catch {}
      setPaparazziState({ loading: false, images: [], selected: [], error: msg });
      toast({ title: "Paparazzi extraction failed", description: msg, variant: "destructive" });
    }
  };

  const publishOne = useMutation({
    mutationFn: async ({ article, i }: { article: ExtractedArticle; i: number }) => {
      const merged = { ...article, ...edits[i] } as ExtractedArticle;
      const categoryId =
        categoryIdBySlugHint(merged.suggested_category) || categories[0]?.id;
      const authorId = authorIdByName(merged.byline) || authors[0]?.id;
      if (!categoryId) throw new Error("No categories in the DB — can't save.");
      if (!authorId) throw new Error("No authors in the DB — can't save.");
      const words = wordCount(merged.body);
      // First selected image becomes the lead; the rest go into
      // gallery_images. If nothing is selected we still save (editor
      // will pick images later in the article editor).
      const picks = imagesByIndex[i]?.selected ?? [];
      const featuredImage = picks[0] || undefined;
      const galleryImages = picks.slice(1).map((url) => ({ url }));
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
        featuredImage,
        galleryImages,
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

  const publishPaparazzi = useMutation({
    mutationFn: async () => {
      const label = results?.paparazzi_section?.label || "Paparazzi";
      const range = results?.paparazzi_section?.estimated_page_range;
      const picks = paparazziState.selected;
      if (!range) throw new Error("No paparazzi section identified");
      if (picks.length === 0) throw new Error("Select at least one photo");
      const paparazziCategoryId =
        categories.find((c) => c.slug === "paparazzi")?.id ||
        categories.find((c) => c.slug.includes("paparazzi"))?.id ||
        categoryIdBySlugHint("paparazzi") ||
        categories[0]?.id;
      const authorId = authorIdByName("Gallery") || authors[0]?.id;
      if (!paparazziCategoryId) throw new Error("No 'paparazzi' category found — create one first.");
      if (!authorId) throw new Error("No authors in the DB — can't save.");
      const issueLabel = issueNumber ? ` — Gallery ${issueNumber}` : "";
      const title = `${label}${issueLabel}`;
      const payload = {
        title,
        slug: slugify(title),
        excerpt: "",
        content: "",
        categoryId: paparazziCategoryId,
        authorId,
        photographer: "",
        illustrator: "",
        status: "draft" as const,
        contentType: "article" as const,
        featuredImage: picks[0],
        galleryImages: picks.map((url) => ({ url })),
        readTime: 1,
        issueNumber: issueNumber ? Number(issueNumber) : undefined,
        homepageHighlight: false,
        tags: [],
      };
      const res = await apiRequest("POST", "/api/articles", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/articles"),
      });
      toast({
        title: "Paparazzi gallery saved",
        description: `${paparazziState.selected.length} photos — draft in the article list.`,
      });
      setPaparazziState({ loading: false, images: [], selected: [] });
    },
    onError: (err: any) => {
      const raw = err?.message || "";
      const m = raw.match(/^\d+:\s*(.*)$/);
      let msg = m ? m[1] : raw;
      try {
        const parsed = JSON.parse(msg);
        if (parsed?.error) msg = parsed.error;
      } catch {}
      toast({ title: "Couldn't save paparazzi gallery", description: msg, variant: "destructive" });
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
          <div className="flex flex-col gap-2 pt-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => ingest.mutate(pdfUrl.trim())}
                disabled={!pdfUrl.trim() || ingest.isPending}
                data-testid="pdf-ingest-run"
              >
                {ingest.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extracting…
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
            {ingest.isPending && <ExtractionProgress />}
          </div>
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-base font-semibold">
              Extracted {remaining.length} of {results.articles.length}{" "}
              article{results.articles.length === 1 ? "" : "s"}
              {results.paparazzi_section && " + paparazzi section"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {results.usage.input_tokens.toLocaleString()} in · {results.usage.output_tokens.toLocaleString()} out ·
              approx {formatCost(results.usage)}
            </span>
          </div>

          {/* Paparazzi section — dedicated flow: extract every image
              in the identified page range, editor prunes any false
              positives (headers / spacers), save as one gallery-heavy
              draft article in the paparazzi category. */}
          {results.paparazzi_section && (
            <Card className="border-pink-500/40" data-testid="pdf-ingest-paparazzi">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Camera className="w-4 h-4 text-pink-500" />
                      Paparazzi section — pp {results.paparazzi_section.estimated_page_range[0]}
                      –{results.paparazzi_section.estimated_page_range[1]}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Extract every photo from the identified pages into a single gallery
                      article filed under paparazzi.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {paparazziState.images.length === 0 && !paparazziState.loading && (
                  <Button type="button" onClick={extractPaparazzi} data-testid="pdf-ingest-paparazzi-extract">
                    <ImagePlus className="mr-2 h-4 w-4" /> Extract paparazzi photos
                  </Button>
                )}
                {paparazziState.loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Pulling photos from PDF…
                  </div>
                )}
                {paparazziState.images.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {paparazziState.selected.length}/{paparazziState.images.length} selected.
                        Click any thumbnail to toggle. First-selected becomes the featured image.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setPaparazziState({ ...paparazziState, selected: paparazziState.images.map((im) => im.url) })
                          }
                        >
                          Select all
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaparazziState({ ...paparazziState, selected: [] })}
                        >
                          None
                        </Button>
                      </div>
                    </div>
                    <ThumbnailGrid
                      state={paparazziState}
                      onToggle={(url) => toggleImage(paparazziState, setPaparazziState, url)}
                    />
                    <Button
                      type="button"
                      onClick={() => publishPaparazzi.mutate()}
                      disabled={publishPaparazzi.isPending || paparazziState.selected.length === 0}
                      data-testid="pdf-ingest-paparazzi-save"
                    >
                      {publishPaparazzi.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
                      ) : (
                        <><Check className="mr-2 h-4 w-4" /> Save paparazzi gallery ({paparazziState.selected.length})</>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

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

                  {/* Image extraction — pull every photo from the
                      article's page range so the editor can pick a lead
                      image + gallery without leaving this screen. */}
                  {(() => {
                    const imgState = imagesByIndex[i] || {
                      loading: false,
                      images: [],
                      selected: [] as string[],
                    };
                    if (imgState.images.length === 0 && !imgState.loading) {
                      return (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            extractForArticle(i, merged.estimated_page_range)
                          }
                          data-testid={`pdf-ingest-extract-images-${i}`}
                        >
                          <ImagePlus className="mr-2 h-4 w-4" /> Extract images from pp{" "}
                          {merged.estimated_page_range[0]}–{merged.estimated_page_range[1]}
                        </Button>
                      );
                    }
                    if (imgState.loading) {
                      return (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Pulling photos…
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          {imgState.selected.length}/{imgState.images.length} selected.
                          First-selected becomes the featured image; the rest go into the article
                          gallery.
                        </p>
                        <ThumbnailGrid
                          state={imgState}
                          onToggle={(url) =>
                            toggleImage(imgState, (next) =>
                              setImagesByIndex((prev) => ({ ...prev, [i]: next })),
                              url,
                            )
                          }
                        />
                      </div>
                    );
                  })()}

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
                          {(imagesByIndex[i]?.selected.length ?? 0) > 0 &&
                            ` (+ ${imagesByIndex[i]!.selected.length} image${
                              imagesByIndex[i]!.selected.length === 1 ? "" : "s"
                            })`}
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Draft goes to the article list; polish in the editor.
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

/** Live "what's happening" feedback while the ingest is in flight.
 *  The server phases (download PDF → pdftotext → Claude call → parse
 *  JSON) aren't reported back to the client, so we approximate their
 *  timing here. The elapsed counter is the real feedback ("this IS
 *  running, and it's been running for X seconds") while the hint
 *  message shifts to describe the likely current phase so the editor
 *  isn't staring at a spinner wondering if it hung. */
function ExtractionProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Approximate phase timings from watching typical runs on issue 8:
  //   0-5s  : fetching PDF from R2 + running pdftotext
  //   5-15s : sending transcript to Claude, waiting for first token
  //   15s+  : Claude generating the JSON payload (bulk of runtime)
  //   90s+  : whatever we're doing is taking longer than expected —
  //           usually still working, but worth flagging to the editor
  //           so they don't assume it's dead
  const hint =
    elapsed < 5
      ? "Downloading the PDF from R2…"
      : elapsed < 15
        ? "Reading the PDF's text layer…"
        : elapsed < 90
          ? "Sending to Claude and waiting for structured extraction…"
          : elapsed < 180
            ? "Still going — a full issue can take 2–3 minutes."
            : "Taking longer than expected — Claude might be having a slow moment.";

  const mm = String(Math.floor(elapsed / 60)).padStart(1, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      className="flex items-center gap-3 text-xs text-muted-foreground border-l-2 border-primary pl-3 py-1"
      data-testid="pdf-ingest-progress"
    >
      <span
        className="font-mono tabular-nums font-medium text-foreground"
        aria-label={`${elapsed} seconds elapsed`}
      >
        {mm}:{ss}
      </span>
      <span>{hint}</span>
    </div>
  );
}

/** Grid of thumbnail buttons with checkbox-selection state. Shared by
 *  the per-article extractor and the paparazzi flow. Selection order
 *  matters (first-selected = lead), so we show a small "1", "2" badge
 *  on ticked images. */
function ThumbnailGrid({
  state,
  onToggle,
}: {
  state: ExtractedImagesState;
  onToggle: (url: string) => void;
}) {
  if (state.images.length === 0) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2" data-testid="pdf-ingest-thumbs">
      {state.images.map((img) => {
        const idx = state.selected.indexOf(img.url);
        const isSelected = idx !== -1;
        return (
          <button
            key={img.url}
            type="button"
            onClick={() => onToggle(img.url)}
            className={`relative aspect-square overflow-hidden border-2 transition-all ${
              isSelected
                ? "border-primary shadow-md"
                : "border-transparent hover:border-border"
            }`}
            title={`page ${img.page} · ${img.width}×${img.height}`}
          >
            <img
              src={img.url}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
            {isSelected && (
              <span
                className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                aria-hidden
              >
                {idx + 1}
              </span>
            )}
            <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
              p{img.page}
            </span>
          </button>
        );
      })}
    </div>
  );
}
