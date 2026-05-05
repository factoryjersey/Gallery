import { format } from "date-fns";
import { Link } from "wouter";
import type { ArticleWithDetails } from "@shared/schema";
import LazyImage from "@/components/LazyImage";

interface FeaturedHeroProps {
  articles: ArticleWithDetails[];
}

export default function FeaturedHero({ articles }: FeaturedHeroProps) {
  const mainArticle = articles[0];
  const secondaryArticles = articles.slice(1, 4);

  if (!mainArticle) {
    return (
      <section className="bg-white border-b border-border py-16">
        <div className="max-w-[1296px] mx-auto px-6 text-center">
          <p className="text-muted-foreground" style={{ fontFamily: "Arial, sans-serif", fontSize: 14 }}>
            No featured articles yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white border-b border-border">
      <div className="max-w-[1296px] mx-auto px-6">

        {/* Main hero: text left, image right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 py-10 border-b border-border">
          {/* Text */}
          <Link href={`/article/${mainArticle.slug}`}>
            <div className="flex flex-col justify-center gap-5 cursor-pointer h-full" data-testid="featured-main">
              <div
                style={{
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "hsl(182 55% 56%)",
                }}
                data-testid="featured-main-category"
              >
                {mainArticle.category.name}
              </div>

              <h1
                className="hover:text-secondary transition-colors"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: "clamp(28px, 3vw, 44px)",
                  fontWeight: 400,
                  lineHeight: 1.18,
                  letterSpacing: "-0.5px",
                  color: "hsl(0 0% 4%)",
                  margin: 0,
                }}
                data-testid="featured-main-title"
              >
                {mainArticle.title}
              </h1>

              {mainArticle.excerpt && (
                <p
                  className="line-clamp-3"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 16,
                    lineHeight: 1.6,
                    color: "hsl(0 0% 4%)",
                    margin: 0,
                  }}
                  data-testid="featured-main-excerpt"
                >
                  {mainArticle.excerpt}
                </p>
              )}

              <div
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 12,
                  color: "hsl(0 0% 43%)",
                }}
                data-testid="featured-main-author"
              >
                By {mainArticle.author.name} —{" "}
                {format(new Date(mainArticle.publishedAt || mainArticle.createdAt), "d MMMM yyyy")}
              </div>
            </div>
          </Link>

          {/* Image */}
          <Link href={`/article/${mainArticle.slug}`}>
            <div className="overflow-hidden cursor-pointer" style={{ aspectRatio: "4/3" }}>
              {mainArticle.featuredImage ? (
                <LazyImage
                  src={mainArticle.featuredImage}
                  alt={mainArticle.title}
                  className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full bg-[hsl(0,0%,92%)] flex items-center justify-center">
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 43%)" }}>
                    Cover Story
                  </span>
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* Secondary articles strip */}
        {secondaryArticles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-8">
            {secondaryArticles.map((article, index) => (
              <Link key={article.id} href={`/article/${article.slug}`}>
                <div className="flex flex-col gap-3 cursor-pointer group" data-testid={`featured-secondary-${index}`}>
                  <div className="overflow-hidden" style={{ aspectRatio: "3/2" }}>
                    {article.featuredImage ? (
                      <LazyImage
                        src={article.featuredImage}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-[hsl(0,0%,92%)]" />
                    )}
                  </div>
                  <div
                    style={{
                      fontFamily: "Arial, sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "hsl(182 55% 56%)",
                    }}
                    data-testid={`featured-secondary-${index}-category`}
                  >
                    {article.category.name}
                  </div>
                  <h3
                    className="group-hover:text-secondary transition-colors line-clamp-2"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 18,
                      fontWeight: 400,
                      lineHeight: 1.3,
                      letterSpacing: "-0.2px",
                      color: "hsl(0 0% 4%)",
                      margin: 0,
                    }}
                    data-testid={`featured-secondary-${index}-title`}
                  >
                    {article.title}
                  </h3>
                  <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
                    data-testid={`featured-secondary-${index}-author`}>
                    By {article.author.name}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
