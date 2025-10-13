import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Clock, User, Grid, List, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function ArticleGrid({ 
  articles, 
  isLoading, 
  pagination, 
  onPageChange,
  itemsPerPage = 20,
  onItemsPerPageChange
}: ArticleGridProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold font-serif text-foreground">Latest Stories</h2>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-8 bg-muted rounded animate-pulse"></div>
            <div className="w-10 h-8 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="h-48 bg-muted animate-pulse"></div>
              <CardContent className="p-5">
                <div className="h-4 bg-muted rounded w-1/4 mb-2 animate-pulse"></div>
                <div className="h-6 bg-muted rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-full mb-4 animate-pulse"></div>
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-1/3 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-1/4 animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold font-serif text-foreground">Latest Stories</h2>
        </div>
        
        <Card className="p-12 text-center">
          <div className="text-6xl mb-4">📰</div>
          <h3 className="text-xl font-semibold mb-2">No articles found</h3>
          <p className="text-muted-foreground">Try adjusting your search or category filter.</p>
        </Card>
      </div>
    );
  }

  const handlePageChange = (page: number) => {
    onPageChange?.(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-serif text-foreground">Latest Stories</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            data-testid="view-mode-grid"
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            data-testid="view-mode-list"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Article Grid */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-6'}>
        {articles.map((article) => (
          <Link key={article.id} href={`/article/${article.slug}`}>
            <Card className={`article-card overflow-hidden cursor-pointer ${viewMode === 'list' ? 'md:flex' : ''}`} data-testid={`article-card-${article.slug}`}>
              <div className={`relative overflow-hidden ${viewMode === 'list' ? 'md:w-1/3' : ''}`}>
                {article.featuredImage ? (
                  <LazyImage
                    src={article.featuredImage}
                    alt={article.title}
                    className={`w-full object-cover ${viewMode === 'grid' ? 'h-48' : 'h-48 md:h-full'}`}
                  />
                ) : (
                  <div className={`w-full bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center ${viewMode === 'grid' ? 'h-48' : 'h-48 md:h-full'}`}>
                    <span className="text-4xl text-muted-foreground">📄</span>
                  </div>
                )}
                <Badge className="absolute top-3 left-3 bg-secondary text-white hover:bg-secondary/90" data-testid={`article-category-${article.slug}`}>
                  {article.category.name}
                </Badge>
              </div>
              
              <CardContent className={`p-5 ${viewMode === 'list' ? 'md:flex-1' : ''}`}>
                <h3 className="text-xl font-bold font-serif text-foreground mb-2 line-clamp-2 hover:text-secondary cursor-pointer" data-testid={`article-title-${article.slug}`}>
                  {article.title}
                </h3>
                {article.excerpt && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3" data-testid={`article-excerpt-${article.slug}`}>
                    {article.excerpt}
                  </p>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {article.author.avatar ? (
                        <img src={article.author.avatar} alt={article.author.name} className="w-8 h-8 rounded-full" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <span data-testid={`article-author-${article.slug}`}>{article.author.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-3 h-3" />
                    <span data-testid={`article-date-${article.slug}`}>
                      {format(new Date(article.publishedAt || article.createdAt), "MMM d, yyyy")}
                    </span>
                    <span>•</span>
                    <Clock className="w-3 h-3" />
                    <span data-testid={`article-read-time-${article.slug}`}>{article.readTime} min</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} articles
            </div>
            {onItemsPerPageChange && (
              <div className="flex items-center space-x-2">
                <span>Items per page:</span>
                <select 
                  value={itemsPerPage} 
                  onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
                  className="border rounded px-2 py-1 bg-background"
                  data-testid="select-items-per-page"
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>
          
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center space-x-2" data-testid="pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                data-testid="pagination-prev"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNumber;
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
                data-testid="pagination-next"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
