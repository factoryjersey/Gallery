import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import type { ArticleWithDetails } from "@shared/schema";
import LazyImage from "@/components/LazyImage";

interface HungerGridProps {
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

// Pick a tile aspect ratio: mostly 16:9, with every 5th tile square so the
// grid has the same broken-rhythm feel as hungermag.com.
function aspectFor(i: number): string {
  return i % 5 === 4 ? "1 / 1" : "16 / 9";
}

function SkeletonTile({ aspect }: { aspect: string }) {
  return (
    <div
      className="border border-black/10 -ml-[1px] -mt-[1px] bg-[hsl(0,0%,96%)] animate-pulse"
      style={{ aspectRatio: aspect }}
    />
  );
}

export default function HungerGrid({
  articles,
  isLoading,
  pagination,
  onPageChange,
  itemsPerPage = 20,
  onItemsPerPageChange,
}: HungerGridProps) {
  const handlePageChange = (page: number) => {
    onPageChange?.(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 -mb-[1px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <SkeletonTile key={i} aspect={aspectFor(i)} />
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="py-16 text-center border border-black/15">
        <p style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "hsl(0 0% 43%)" }}>
          No articles found. Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Tile grid — overlapping hairline borders, mixed 16:9 / square ratios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border-t border-l border-black/15">
        {articles.map((article, i) => (
          <Link key={article.id} href={`/article/${article.slug}`}>
            <article
              className="relative block overflow-hidden border-r border-b border-black/15 group cursor-pointer bg-black"
              style={{ aspectRatio: aspectFor(i) }}
              data-testid={`article-card-${article.slug}`}
            >
              {/* Image */}
              {article.featuredImage ? (
                <LazyImage
                  src={article.featuredImage}
                  alt={article.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.05]"
                />
              ) : (
                <div className="absolute inset-0 w-full h-full bg-[hsl(0,0%,12%)] flex items-center justify-center">
                  <span
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontSize: 11,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.55)",
                    }}
                  >
                    {article.category.name}
                  </span>
                </div>
              )}

              {/* Darkening overlay — keeps text readable, deepens on hover */}
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                  background: "linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.65) 100%)",
                }}
              />

              {/* Category tag */}
              <span
                className="absolute top-3 left-3"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#fff",
                  padding: "4px 8px",
                  border: "1px solid rgba(255,255,255,0.5)",
                  background: "rgba(0,0,0,0.25)",
                  backdropFilter: "blur(2px)",
                }}
                data-testid={`article-category-${article.slug}`}
              >
                {article.category.name}
              </span>

              {/* Title */}
              <h3
                className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-10 line-clamp-2"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "clamp(18px, 1.6vw, 26px)",
                  fontWeight: 400,
                  lineHeight: 1.18,
                  letterSpacing: "-0.2px",
                  color: "#fff",
                  margin: 0,
                  textShadow: "0 1px 12px rgba(0,0,0,0.4)",
                }}
                data-testid={`article-title-${article.slug}`}
              >
                {article.title}
              </h3>
            </article>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="mt-10 pt-6 border-t border-border space-y-4">
          <div
            className="flex items-center justify-between"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
          >
            <span>
              {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} articles
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
