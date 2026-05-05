import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, StarOff, Search, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ArticleWithDetails } from "@shared/schema";
import { format } from "date-fns";

export function FeaturedStoriesManager() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: featuredData, isLoading: featuredLoading } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: ["/api/articles/featured"],
  });

  const searchParams = new URLSearchParams({ status: "published", limit: "20", ...(search && { search }) });
  const { data: searchData, isLoading: searchLoading } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: [`/api/articles?${searchParams}`],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isFeatured, featuredOrder }: { id: string; isFeatured: boolean; featuredOrder: number }) => {
      const res = await apiRequest("PATCH", `/api/articles/${id}/featured`, { isFeatured, featuredOrder });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/articles/featured"] });
      queryClient.invalidateQueries({ predicate: q => (q.queryKey[0] as string).startsWith("/api/articles") });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update featured status.", variant: "destructive" });
    },
  });

  const pinned = featuredData?.articles?.filter(a => a.isFeatured) ?? [];

  const handleToggle = (article: ArticleWithDetails) => {
    if (article.isFeatured) {
      toggleMutation.mutate({ id: article.id, isFeatured: false, featuredOrder: 0 });
      toast({ title: "Removed", description: `"${article.title}" removed from hero rotation.` });
    } else {
      const nextOrder = pinned.length;
      toggleMutation.mutate({ id: article.id, isFeatured: true, featuredOrder: nextOrder });
      toast({ title: "Added", description: `"${article.title}" added to hero rotation.` });
    }
  };

  const articles = searchData?.articles ?? [];
  const pinnedIds = new Set(pinned.map(a => a.id));

  return (
    <div className="space-y-6" data-testid="featured-stories-manager">
      <div>
        <h2 className="text-xl font-bold mb-1">Featured Stories</h2>
        <p className="text-sm text-muted-foreground">
          Pin specific articles to the hero carousel. They rotate automatically on the homepage.
          If none are pinned, the latest articles with images are used.
        </p>
      </div>

      {/* Currently pinned */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            Currently in rotation
            <Badge variant="secondary">{pinned.length}</Badge>
          </h3>

          {featuredLoading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}

          {!featuredLoading && pinned.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              No articles pinned — showing latest articles with images automatically.
            </p>
          )}

          <div className="space-y-2">
            {pinned.map((article, idx) => (
              <div
                key={article.id}
                className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                data-testid={`pinned-article-${article.id}`}
              >
                <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                {article.featuredImage && (
                  <img
                    src={article.featuredImage}
                    alt=""
                    className="w-12 h-8 object-cover shrink-0"
                    style={{ borderRadius: 0 }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{article.title}</p>
                  <p className="text-xs text-muted-foreground">{article.category.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(article)}
                  disabled={toggleMutation.isPending}
                  data-testid={`unpin-${article.id}`}
                >
                  <StarOff className="w-4 h-4 mr-1" />
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search & add */}
      <Card>
        <CardContent className="pt-4">
          <h3 className="font-semibold mb-3">Add articles to rotation</h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search published articles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
              data-testid="featured-search"
            />
          </div>

          {searchLoading && <p className="text-sm text-muted-foreground">Searching…</p>}

          <div className="space-y-1">
            {articles.map(article => {
              const isPinned = pinnedIds.has(article.id);
              return (
                <div
                  key={article.id}
                  className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                  data-testid={`search-article-${article.id}`}
                >
                  {article.featuredImage ? (
                    <img
                      src={article.featuredImage}
                      alt=""
                      className="w-12 h-8 object-cover shrink-0"
                      style={{ borderRadius: 0 }}
                    />
                  ) : (
                    <div className="w-12 h-8 bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{article.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {article.category.name} · {format(new Date(article.publishedAt || article.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                  {!article.featuredImage && (
                    <Badge variant="outline" className="text-xs shrink-0">No image</Badge>
                  )}
                  <Button
                    variant={isPinned ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => handleToggle(article)}
                    disabled={toggleMutation.isPending}
                    data-testid={`pin-${article.id}`}
                  >
                    {isPinned ? (
                      <><StarOff className="w-4 h-4 mr-1" />Remove</>
                    ) : (
                      <><Star className="w-4 h-4 mr-1" />Pin</>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
