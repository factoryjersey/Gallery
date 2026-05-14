import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
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

function SkeletonTile() {
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-[hsl(0,0%,94%)] animate-pulse" style={{ aspectRatio: "1 / 1" }} />
      <div className="h-3 bg-border rounded w-16 animate-pulse" />
      <div className="h-5 bg-border rounded w-3/4 animate-pulse" />
      <div className="h-3 bg-border rounded w-full animate-pulse" />
      <div className="h-3 bg-border rounded w-2/3 animate-pulse" />
    </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14 px-6">
        {Array.from({ length: 9 }).map((_, i) => <SkeletonTile key={i} />)}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="py-16 text-center border border-black/15 mx-6">
        <p style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "hsl(0 0% 43%)" }}>
          No articles found. Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Square tiles with title + excerpt below */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14 px-6">
        {articles.map((article) => (
          <Link key={article.id} href={`/article/${article.slug}`}>
            <article
              className="group cursor-pointer flex flex-col gap-3"
              data-testid={`article-card-${article.slug}`}
            >
              {/* Square image */}
              <div
                className="relative overflow-hidden bg-[hsl(0,0%,94%)]"
                style={{ aspectRatio: "1 / 1" }}
              >
                {article.featuredImage ? (
                  <LazyImage
                    src={article.featuredImage}
                    alt={article.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center">
                    <span
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: 11,
                        letterSpacing: "0.16em",
                        textTransform: "uppercase",
                        color: "hsl(0 0% 55%)",
                      }}
                    >
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
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "hsl(182 55% 56%)",
                  marginTop: 2,
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
                  fontSize: "clamp(20px, 1.5vw, 26px)",
                  fontWeight: 400,
                  lineHeight: 1.2,
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
                  className="line-clamp-3"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: "hsl(0 0% 35%)",
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
                  color: "hsl(0 0% 50%)",
                  marginTop: 2,
                }}
              >
                <span data-testid={`article-author-${article.slug}`}>By {article.author.name}</span>
                <span className="mx-2">—</span>
                <span data-testid={`article-date-${article.slug}`}>
                  {format(new Date(article.publishedAt || article.createdAt), "d MMM yyyy")}
                </span>
              </div>
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
