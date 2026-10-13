import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LayoutGrid, Rows3 } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import type { ArticleWithDetails } from "@shared/schema";
import LazyImage from "@/components/LazyImage";

type ViewMode = "grid" | "masonry";

// Persist the reader's chosen view across pages (category → author →
// contributor) and across sessions. Scoped per-browser, so no server
// round-trip required. SSR-safe — guarded in useEffect.
const VIEW_MODE_STORAGE_KEY = "gallery:article-view-mode";
function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "grid";
  const v = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return v === "masonry" ? "masonry" : "grid";
}

interface ArticleGridProps {
  articles: ArticleWithDetails[];
  isLoading: boolean;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (limit: number) => void;
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-6">
      <div className="w-full bg-border animate-pulse" style={{ aspectRatio: "3/2" }} />
      <div className="h-3 bg-border rounded w-16 animate-pulse" />
      <div className="h-5 bg-border rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-border rounded w-1/3 animate-pulse" />
    </div>
  );
}

export default function ArticleGrid({
  articles,
  isLoading,
  pagination,
  onPageChange,
  itemsPerPage = 20,
  onItemsPerPageChange,
}: ArticleGridProps) {
  // Hydrate from localStorage on mount so SSR renders the default,
  // then swaps to the reader's saved preference. Avoids a flash of
  // the stored layout before React hydrates.
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  useEffect(() => {
    setViewMode(readStoredViewMode());
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Private-mode / storage-blocked — the setting just doesn't
      // persist. Non-fatal.
    }
  }, [viewMode]);

  const handlePageChange = (page: number) => {
    onPageChange?.(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <span className="gallery-section-label">Latest Stories</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <span className="gallery-section-label">Latest Stories</span>
        </div>
        <div className="py-16 text-center border border-border">
          <p className="text-muted-foreground" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            No articles found. Try adjusting your filters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Section header + view toggle. The toggle sits inline with the
          "Latest Stories" label so the layout control is where readers
          already look (top-left of the article list), not buried in a
          separate toolbar. */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <span className="gallery-section-label">Latest Stories</span>
        <div
          className="inline-flex items-center border border-border"
          role="radiogroup"
          aria-label="Article layout"
          data-testid="article-view-mode"
        >
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "grid"}
            onClick={() => setViewMode("grid")}
            className="flex items-center gap-1.5 py-1.5 px-3 transition-colors"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: viewMode === "grid" ? "hsl(0 0% 10%)" : "transparent",
              color: viewMode === "grid" ? "hsl(0 0% 100%)" : "hsl(0 0% 43%)",
            }}
            data-testid="article-view-grid"
            title="Grid layout — fixed-ratio cards with excerpts"
          >
            <Rows3 className="w-3.5 h-3.5" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={viewMode === "masonry"}
            onClick={() => setViewMode("masonry")}
            className="flex items-center gap-1.5 py-1.5 px-3 transition-colors border-l border-border"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: viewMode === "masonry" ? "hsl(0 0% 10%)" : "transparent",
              color: viewMode === "masonry" ? "hsl(0 0% 100%)" : "hsl(0 0% 43%)",
            }}
            data-testid="article-view-masonry"
            title="Masonry layout — images at natural proportions"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Masonry</span>
          </button>
        </div>
      </div>

      {/* Grid layout — fixed 3:2 crops, two-column, title + excerpt + meta.
          The editorial default: scannable, consistent, text-forward. */}
      {viewMode === "grid" && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
        {articles.map((article) => (
          <Link key={article.id} href={`/article/${article.slug}`}>
            <article
              className="article-card flex flex-col gap-3 cursor-pointer group border border-transparent"
              data-testid={`article-card-${article.slug}`}
            >
              {/* Image */}
              <div className="overflow-hidden w-full" style={{ aspectRatio: "3/2" }}>
                {article.featuredImage ? (
                  <LazyImage
                    src={article.featuredImage}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-[hsl(0,0%,92%)] flex items-center justify-center">
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 60%)" }}>
                      {article.category.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Category */}
              <div
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "hsl(182 55% 56%)",
                }}
                data-testid={`article-category-${article.slug}`}
              >
                {article.category.name}
              </div>

              {/* Title */}
              <h3
                className="group-hover:text-secondary transition-colors line-clamp-2"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 20,
                  fontWeight: 400,
                  lineHeight: 1.3,
                  letterSpacing: "-0.2px",
                  color: "hsl(0 0% 4%)",
                  margin: 0,
                }}
                data-testid={`article-title-${article.slug}`}
              >
                {article.title}
              </h3>

              {/* Excerpt */}
              {article.excerpt && (
                <p
                  className="line-clamp-2"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: "hsl(0 0% 43%)",
                    margin: 0,
                  }}
                  data-testid={`article-excerpt-${article.slug}`}
                >
                  {article.excerpt}
                </p>
              )}

              {/* Meta */}
              <div
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 12,
                  color: "hsl(0 0% 43%)",
                }}
              >
                <span data-testid={`article-author-${article.slug}`}>By {article.author.name}</span>
                <span className="mx-2">—</span>
                <span data-testid={`article-date-${article.slug}`}>
                  {format(new Date(article.publishedAt || article.createdAt), "d MMM yyyy")}
                </span>
                <span className="mx-2">·</span>
                <span data-testid={`article-read-time-${article.slug}`}>{article.readTime} min read</span>
              </div>
            </article>
          </Link>
        ))}
      </div>
      )}

      {/* Masonry layout — CSS columns for Pinterest-style flow, images
          at their natural aspect ratio (no 3:2 crop), title + category
          overlaid at the bottom on a gradient. Mirrors GalleryGrid's
          technique (same pure-CSS columns + break-inside: avoid) so a
          thousand-item category still renders at zero JS cost.

          Articles with no featured image render as a text-only tile
          with the category tint as the background, so the gallery
          doesn't look holey. */}
      {viewMode === "masonry" && (
      <div
        className="columns-1 sm:columns-2 lg:columns-3 gap-4"
        data-testid="article-masonry"
      >
        {articles.map((article) => (
          <Link key={article.id} href={`/article/${article.slug}`}>
            <article
              className="block w-full mb-4 cursor-pointer group relative overflow-hidden bg-[hsl(0,0%,8%)]"
              style={{ breakInside: "avoid" }}
              data-testid={`article-tile-${article.slug}`}
            >
              {article.featuredImage ? (
                <>
                  <LazyImage
                    src={article.featuredImage}
                    alt={article.title}
                    className="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-500"
                  />
                  {/* Bottom gradient so overlaid text stays readable
                      against any image. Only visible on hover + focus
                      so the gallery itself reads as pure image at rest. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 55%, rgba(0,0,0,0) 100%)",
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    <div
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "hsl(182 55% 76%)",
                      }}
                    >
                      {article.category.name}
                    </div>
                    <h3
                      className="line-clamp-3 mt-1"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 17,
                        fontWeight: 400,
                        lineHeight: 1.3,
                        color: "white",
                        margin: 0,
                      }}
                    >
                      {article.title}
                    </h3>
                  </div>
                </>
              ) : (
                // No-image fallback — give it some vertical space and
                // the category tint so it doesn't collapse into nothing
                // mid-column. Deliberately smaller than image tiles so
                // the eye flows past.
                <div
                  className="w-full p-5 flex flex-col gap-2"
                  style={{
                    minHeight: 180,
                    background: "hsl(182 15% 20%)",
                    color: "white",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "hsl(182 55% 76%)",
                    }}
                  >
                    {article.category.name}
                  </div>
                  <h3
                    className="line-clamp-4"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 17,
                      fontWeight: 400,
                      lineHeight: 1.3,
                      margin: 0,
                    }}
                  >
                    {article.title}
                  </h3>
                </div>
              )}
            </article>
          </Link>
        ))}
      </div>
      )}

      {/* Pagination */}
      {pagination && (
        <div className="mt-10 pt-6 border-t border-border space-y-4">
          <div className="flex items-center justify-between" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
            <span>
              {((pagination.page - 1) * pagination.limit) + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} articles
            </span>
            {onItemsPerPageChange && (
              <div className="flex items-center gap-2">
                <span>Per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                  className="border border-border px-2 py-1 bg-background text-foreground"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}
                  data-testid="select-items-per-page"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-1" data-testid="pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="rounded-none border-border"
                data-testid="pagination-prev"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Prev
              </Button>

              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNumber: number;
                if (pagination.totalPages <= 5) {
                  pageNumber = i + 1;
                } else {
                  const start = Math.max(1, pagination.page - 2);
                  const end = Math.min(pagination.totalPages, start + 4);
                  pageNumber = start + i;
                  if (pageNumber > end) return null;
                }
                return (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === pagination.page ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    className="rounded-none border-border"
                    data-testid={`pagination-${pageNumber}`}
                  >
                    {pageNumber}
                  </Button>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="rounded-none border-border"
                data-testid="pagination-next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
