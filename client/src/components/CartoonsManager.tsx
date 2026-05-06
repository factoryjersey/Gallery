import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ArticleWithDetails } from "@shared/schema";
import { format } from "date-fns";

const NTJP_SLUG = "ntjp";

const cartoonListParams = new URLSearchParams({
  contentType: "cartoon",
  status: "published",
  limit: "20",
  orderBy: "publishedAt",
  orderDir: "desc",
}).toString();

export function CartoonsManager() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const { data: authorsData } = useQuery<{ authors: any[] }>({
    queryKey: ["/api/authors"],
  });

  const ntjpCategory = categoriesData?.categories?.find((c: any) => c.slug === NTJP_SLUG);

  const { data: cartoonsData, isLoading: cartoonsLoading } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: [`/api/articles?${cartoonListParams}`],
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, imageUrl, categoryId, authorId }: { title: string; imageUrl: string; categoryId: string; authorId: string }) => {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
      const res = await apiRequest("POST", "/api/articles", {
        title,
        slug,
        content: `<img src="${imageUrl}" alt="${title}" style="max-width:100%;height:auto;" />`,
        featuredImage: imageUrl,
        status: "published",
        contentType: "cartoon",
        categoryId,
        authorId,
        publishedAt: new Date().toISOString(),
        readTime: 1,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith?.("/api/articles") });
      setTitle("");
      setPreviewUrl(null);
      setUploadedImageUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Cartoon published", description: "It will now appear in the sidebar." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to publish cartoon.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/articles/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: q => (q.queryKey[0] as string)?.startsWith?.("/api/articles") });
      toast({ title: "Removed", description: "Cartoon deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete cartoon.", variant: "destructive" });
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreviewUrl(URL.createObjectURL(file));
    setUploadedImageUrl(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      const url = data.media?.url || data.url;
      setUploadedImageUrl(url);
      toast({ title: "Image uploaded", description: "Ready to publish." });
    } catch {
      toast({ title: "Upload failed", description: "Could not upload image.", variant: "destructive" });
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handlePublish = () => {
    if (!uploadedImageUrl || !title.trim() || !ntjpCategory) return;
    const authorId = authorsData?.authors?.[0]?.id;
    if (!authorId) {
      toast({ title: "No author found", description: "Add an author first.", variant: "destructive" });
      return;
    }
    createMutation.mutate({ title: title.trim(), imageUrl: uploadedImageUrl, categoryId: ntjpCategory.id, authorId });
  };

  const cartoons = cartoonsData?.articles ?? [];
  const canPublish = !!uploadedImageUrl && !!title.trim() && !isUploading && !createMutation.isPending;

  return (
    <div className="space-y-8" data-testid="cartoons-manager">
      <div>
        <h2 className="text-xl font-bold mb-1">Cartoons</h2>
        <p className="text-sm text-muted-foreground">
          Upload cartoon images and publish them to the sidebar. Images are displayed at their original dimensions.
        </p>
      </div>

      {/* Upload form */}
      <Card>
        <CardContent className="pt-5 space-y-5">
          <h3 className="font-semibold">Add a new cartoon</h3>

          {/* Drop / click area */}
          <div
            className="border-2 border-dashed border-border rounded-none hover:border-secondary transition-colors cursor-pointer bg-muted/30 flex flex-col items-center justify-center gap-3 p-8"
            onClick={() => fileInputRef.current?.click()}
            data-testid="cartoon-upload-area"
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-xs max-h-80 h-auto w-auto block"
                style={{ objectFit: "contain" }}
              />
            ) : (
              <>
                <ImagePlus className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Click to select an image<br />
                  <span className="text-xs">PNG, JPG, WebP — displayed at original size</span>
                </p>
              </>
            )}
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading…
              </div>
            )}
            {uploadedImageUrl && !isUploading && (
              <Badge variant="secondary" className="text-xs">✓ Image ready</Badge>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            data-testid="cartoon-file-input"
          />

          <div className="space-y-1.5">
            <Label htmlFor="cartoon-title">Title / caption</Label>
            <Input
              id="cartoon-title"
              placeholder="e.g. Gallery 209 Cartoons"
              value={title}
              onChange={e => setTitle(e.target.value)}
              data-testid="cartoon-title-input"
            />
          </div>

          <Button
            onClick={handlePublish}
            disabled={!canPublish}
            className="w-full"
            data-testid="cartoon-publish-btn"
          >
            {createMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Publishing…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Publish to sidebar</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Existing cartoons */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            Published cartoons
            <Badge variant="secondary">{cartoons.length}</Badge>
          </h3>

          {cartoonsLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!cartoonsLoading && cartoons.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">No cartoons published yet.</p>
          )}

          <div className="space-y-3">
            {cartoons.map((article, idx) => (
              <div
                key={article.id}
                className="flex items-center gap-3 py-3 border-b border-border last:border-0"
                data-testid={`cartoon-row-${idx}`}
              >
                {article.featuredImage && (
                  <img
                    src={article.featuredImage}
                    alt=""
                    className="w-20 h-auto block shrink-0 border border-border"
                    style={{ maxHeight: 64, objectFit: "cover" }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{article.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(article.publishedAt || article.createdAt), "d MMM yyyy")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteMutation.mutate(article.id)}
                  disabled={deleteMutation.isPending}
                  data-testid={`cartoon-delete-${article.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
