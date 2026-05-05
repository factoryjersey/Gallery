import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useState } from "react";
import type { ArticleWithDetails } from "@shared/schema";
import LazyImage from "@/components/LazyImage";

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
  const [viewMode] = useState<"grid">("grid");

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
      {/* Section header */}
      <div className="mb-6">
        <span className="gallery-section-label">Latest Stories</span>
      </div>

      {/* Grid */}
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
