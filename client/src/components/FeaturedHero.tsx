import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import type { ArticleWithDetails } from "@shared/schema";

interface FeaturedHeroProps {
  articles: ArticleWithDetails[];
}

export default function FeaturedHero({ articles }: FeaturedHeroProps) {
  const mainArticle = articles[0];
  const secondaryArticles = articles.slice(1, 5);

  if (!mainArticle) {
    return (
      <section className="bg-background py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-muted rounded-lg p-12 text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">No Featured Articles</h2>
            <p className="text-muted-foreground">Articles will appear here once they're published.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Main Featured Article */}
          <Link href={`/article/${mainArticle.slug}`}>
            <div className="relative overflow-hidden rounded-lg shadow-lg group cursor-pointer article-card" data-testid="featured-main">
              {mainArticle.featuredImage ? (
                <img
                  src={mainArticle.featuredImage}
                  alt={mainArticle.title}
                  className="w-full h-[500px] object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-[500px] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                  <span className="text-6xl text-muted-foreground">📰</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <Badge className="mb-3 bg-secondary text-white hover:bg-secondary/90" data-testid="featured-main-category">
                  {mainArticle.category.name}
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold font-serif mb-3 line-clamp-2" data-testid="featured-main-title">
                  {mainArticle.title}
                </h2>
                {mainArticle.excerpt && (
                  <p className="text-gray-200 mb-4 line-clamp-2" data-testid="featured-main-excerpt">
                    {mainArticle.excerpt}
                  </p>
                )}
                <div className="flex items-center text-sm text-gray-300">
                  <User className="w-4 h-4 mr-1" />
                  <span data-testid="featured-main-author">{mainArticle.author.name}</span>
                  <span className="mx-2">•</span>
                  <Calendar className="w-4 h-4 mr-1" />
                  <span data-testid="featured-main-date">
                    {format(new Date(mainArticle.publishedAt || mainArticle.createdAt), "MMM d, yyyy")}
                  </span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-1" />
                  <span data-testid="featured-main-read-time">{mainArticle.readTime} min read</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Secondary Featured Articles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {secondaryArticles.map((article, index) => (
              <Link key={article.id} href={`/article/${article.slug}`}>
                <div className="relative overflow-hidden rounded-lg shadow-lg group cursor-pointer article-card" data-testid={`featured-secondary-${index}`}>
                  {article.featuredImage ? (
                    <img
                      src={article.featuredImage}
                      alt={article.title}
                      className="w-full h-[240px] object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-[240px] bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center">
                      <span className="text-4xl text-muted-foreground">📄</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <Badge className="mb-2 bg-secondary text-white text-xs hover:bg-secondary/90" data-testid={`featured-secondary-${index}-category`}>
                      {article.category.name}
                    </Badge>
                    <h3 className="text-lg font-bold font-serif mb-2 line-clamp-2" data-testid={`featured-secondary-${index}-title`}>
                      {article.title}
                    </h3>
                    <div className="text-xs text-gray-300">
                      <span data-testid={`featured-secondary-${index}-author`}>{article.author.name}</span>
                      <span className="mx-1">•</span>
                      <span data-testid={`featured-secondary-${index}-read-time`}>{article.readTime} min</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            
            {/* Fill empty slots if we have fewer than 4 secondary articles */}
            {Array.from({ length: Math.max(0, 4 - secondaryArticles.length) }).map((_, index) => (
              <div key={`empty-${index}`} className="relative overflow-hidden rounded-lg shadow-lg bg-muted/30 h-[240px] flex items-center justify-center" data-testid={`featured-placeholder-${index}`}>
                <div className="text-center text-muted-foreground">
                  <span className="text-4xl mb-2 block">📝</span>
                  <p className="text-sm">More articles coming soon</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
