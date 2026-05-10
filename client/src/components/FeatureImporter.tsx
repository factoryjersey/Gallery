import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Image as ImageIcon, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

type IssueSummary = { issue: number; total: number; missing: number };
type IssuesResp = { archiveAvailable: boolean; issues: IssueSummary[] };

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredImage: string | null;
};

type ImageItem = { filename: string; size: number; r2Key: string; r2Url: string };

type IssueDetail = { issue: number; articles: Article[]; images: ImageItem[] };

export default function FeatureImporter() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [hero, setHero] = useState<string | null>(null);
  const [gallery, setGallery] = useState<Set<string>>(new Set());

  const issuesQ = useQuery<IssuesResp>({ queryKey: ["/api/admin/feature-import/issues"] });
  const detailQ = useQuery<IssueDetail>({
    queryKey: [`/api/admin/feature-import/issues/${selectedIssue}`],
    enabled: selectedIssue !== null,
  });

  const syncImages = useMutation({
    mutationFn: async (issue: number) => {
      const r = await fetch(`/api/admin/feature-import/issues/${issue}/sync`, { method: "POST" });
      if (!r.ok) throw new Error((await r.json()).error || "Sync failed");
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: "Synced", description: `${d.uploaded} uploaded, ${d.skipped} already on R2` });
      qc.invalidateQueries({ queryKey: [`/api/admin/feature-import/issues/${selectedIssue}`] });
    },
    onError: (e: Error) => toast({ title: "Sync failed", description: e.message, variant: "destructive" }),
  });

  const attach = useMutation({
    mutationFn: async (body: { articleId: string; issue: number; hero: string; gallery: string[] }) => {
      const r = await fetch(`/api/admin/feature-import/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Attach failed");
      return r.json();
    },
    onSuccess: (d) => {
      toast({ title: "Attached", description: `Hero + ${d.galleryCount} gallery images on "${d.article.title}"` });
      // Reset & refresh
      setSelectedArticle(null);
      setHero(null);
      setGallery(new Set());
      qc.invalidateQueries({ queryKey: [`/api/admin/feature-import/issues/${selectedIssue}`] });
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-import/issues"] });
    },
    onError: (e: Error) => toast({ title: "Attach failed", description: e.message, variant: "destructive" }),
  });

  if (issuesQ.isLoading) return <p>Loading…</p>;
  if (issuesQ.data && !issuesQ.data.archiveAvailable) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            <p className="font-semibold">Google Drive archive not available.</p>
          </div>
          <p className="text-sm text-muted-foreground">
            This tool needs the InDesign packaged folders to be mounted at <code>{`/.../publications/gallery archive`}</code>.
            Run the dev server locally on a machine with Google Drive synced. Production deploys won't have access.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalMissing = (issuesQ.data?.issues || []).reduce((s, i) => s + i.missing, 0);
  const heroAlreadyPicked = selectedArticle?.featuredImage;
  const canAttach = !!selectedArticle && !!hero && !attach.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" /> Feature images — backfill
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {totalMissing} articles across {issuesQ.data?.issues.length ?? 0} packaged issues still need images.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {(issuesQ.data?.issues || [])
              .sort((a, b) => (b.missing - a.missing) || (b.issue - a.issue))
              .map((i) => (
                <button
                  key={i.issue}
                  onClick={() => { setSelectedIssue(i.issue); setSelectedArticle(null); setHero(null); setGallery(new Set()); }}
                  className={`px-2.5 py-1 text-xs border rounded ${
                    selectedIssue === i.issue
                      ? "bg-primary text-primary-foreground border-primary"
                      : i.missing === 0
                      ? "bg-green-50 border-green-200 text-green-700"
                      : "bg-card border-border hover:bg-accent"
                  }`}
                  data-testid={`issue-btn-${i.issue}`}
                >
                  #{i.issue}
                  <span className="ml-1.5 opacity-70">{i.missing}/{i.total}</span>
                </button>
              ))}
          </div>
        </CardContent>
      </Card>

      {selectedIssue && detailQ.data && (
        <div className="grid lg:grid-cols-2 gap-4">
          {/* LEFT — Articles missing images */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Issue #{selectedIssue} — articles needing images</CardTitle>
              <p className="text-xs text-muted-foreground">{detailQ.data.articles.length} articles. Click one to start.</p>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-y-auto space-y-1">
              {detailQ.data.articles.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedArticle(a); setHero(null); setGallery(new Set()); }}
                  className={`block w-full text-left p-2 rounded border text-sm ${
                    selectedArticle?.id === a.id ? "bg-primary/10 border-primary" : "border-border hover:bg-accent"
                  }`}
                  data-testid={`article-btn-${a.slug}`}
                >
                  <div className="font-medium truncate">{a.title.trim()}</div>
                  {a.excerpt && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{a.excerpt.slice(0, 110)}</div>
                  )}
                </button>
              ))}
              {detailQ.data.articles.length === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Every article in this issue has an image.</p>
              )}
            </CardContent>
          </Card>

          {/* RIGHT — Image picker */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">Available images ({detailQ.data.images.length})</CardTitle>
                  {selectedArticle ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      <strong>Click 1 image</strong> to set as hero, then click more to add to a body gallery.
                      Currently picking for: <span className="font-medium">"{selectedArticle.title.trim()}"</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Select an article on the left first.</p>
                  )}
                </div>
                <Button size="sm" variant="outline" disabled={syncImages.isPending} onClick={() => selectedIssue && syncImages.mutate(selectedIssue)}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncImages.isPending ? "animate-spin" : ""}`} />
                  Sync to R2
                </Button>
              </div>
              {heroAlreadyPicked && (
                <p className="text-xs text-amber-700 mt-2">Note: this article already had a featured image. New picks will overwrite it.</p>
              )}
            </CardHeader>
            <CardContent>
              {selectedArticle && hero && (
                <div className="mb-3 flex items-center gap-3">
                  <Button
                    size="sm"
                    disabled={!canAttach}
                    onClick={() =>
                      attach.mutate({
                        articleId: selectedArticle.id,
                        issue: selectedIssue,
                        hero,
                        gallery: [...gallery].filter((g) => g !== hero),
                      })
                    }
                    data-testid="attach-button"
                  >
                    Attach hero + {[...gallery].filter((g) => g !== hero).length} gallery image{gallery.size !== 1 ? "s" : ""}
                  </Button>
                  <button
                    onClick={() => { setHero(null); setGallery(new Set()); }}
                    className="text-xs underline text-muted-foreground"
                  >
                    Reset
                  </button>
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto">
                {detailQ.data.images.map((img) => {
                  const isHero = hero === img.filename;
                  const inGallery = gallery.has(img.filename) && !isHero;
                  return (
                    <button
                      key={img.filename}
                      disabled={!selectedArticle}
                      onClick={() => {
                        if (!selectedArticle) return;
                        if (!hero) { setHero(img.filename); return; }
                        if (img.filename === hero) { setHero(null); return; }
                        const next = new Set(gallery);
                        if (next.has(img.filename)) next.delete(img.filename);
                        else next.add(img.filename);
                        setGallery(next);
                      }}
                      className={`group relative aspect-square overflow-hidden rounded border-2 ${
                        isHero ? "border-primary"
                        : inGallery ? "border-secondary"
                        : "border-transparent hover:border-border"
                      } ${!selectedArticle ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      title={img.filename}
                      data-testid={`image-${img.filename}`}
                    >
                      <img
                        src={img.r2Url}
                        alt={img.filename}
                        loading="lazy"
                        className="w-full h-full object-cover bg-muted"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.opacity = "0.2";
                        }}
                      />
                      {isHero && (
                        <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] px-1 py-0.5 rounded">HERO</span>
                      )}
                      {inGallery && (
                        <span className="absolute top-1 left-1 bg-secondary text-secondary-foreground text-[10px] px-1 py-0.5 rounded">{[...gallery].indexOf(img.filename) + 1}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {detailQ.data.images.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Thumbnails load from R2. If they don't render, click "Sync to R2" first.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
