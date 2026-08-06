import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ArticleWithDetails } from "@shared/schema";
import LazyImage from "@/components/LazyImage";

interface FeaturedHeroProps {
  articles: ArticleWithDetails[];
  /** Show the three-column strip of "other featured" cards under the
   *  main hero. Turn off when the hero is above another curated section
   *  (like LatestHighlights) that would duplicate the content. */
  showSecondary?: boolean;
}

const ROTATION_MS = 7000;

export default function FeaturedHero({ articles, showSecondary = true }: FeaturedHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const total = articles.length;

  const next = useCallback(() => {
    setActiveIndex(i => (i + 1) % total);
  }, [total]);

  const prev = useCallback(() => {
    setActiveIndex(i => (i - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(next, ROTATION_MS);
    return () => clearInterval(id);
  }, [paused, total, next]);

  const mainArticle = articles[activeIndex];
  const secondaryArticles = articles.filter((_, i) => i !== activeIndex).slice(0, 3);

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
    <section
      className="bg-white border-b border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="max-w-[1296px] mx-auto px-6">

        {/* Main hero: text left, image right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 py-10 border-b border-border relative">
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
            <div className="overflow-hidden cursor-pointer relative" style={{ aspectRatio: "4/3" }}>
              {mainArticle.featuredImage ? (
                <LazyImage
                  src={mainArticle.featuredImage}
                  alt={mainArticle.title}
                  // First-tile priority — the hero is the LCP candidate
                  // on the homepage; skip the IntersectionObserver gate
                  // and let the browser fetch it immediately.
                  priority={activeIndex === 0}
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

          {/* Navigation controls */}
          {total > 1 && (
            <div className="absolute bottom-4 right-0 flex items-center gap-3" onClick={e => e.stopPropagation()}>
              {/* Dot indicators */}
              <div className="flex gap-1.5">
                {articles.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIndex(i)}
                    data-testid={`hero-dot-${i}`}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 0,
                      border: "none",
                      background: i === activeIndex ? "hsl(0 0% 4%)" : "hsl(0 0% 80%)",
                      cursor: "pointer",
                      padding: 0,
                      transition: "background 0.2s",
                    }}
                  />
                ))}
              </div>
              <button
                onClick={prev}
                data-testid="hero-prev"
                className="hover:opacity-60 transition-opacity"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                aria-label="Previous story"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={next}
                data-testid="hero-next"
                className="hover:opacity-60 transition-opacity"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                aria-label="Next story"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Secondary articles strip — off by default when the hero sits
            above a full-width tile section (like LatestHighlights) that
            would otherwise duplicate the same articles below. */}
        {showSecondary && secondaryArticles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-t border-border divide-x divide-border">
            {secondaryArticles.map((article) => (
              <Link key={article.id} href={`/article/${article.slug}`}>
                <div
                  className="flex gap-4 py-5 px-4 hover:bg-[hsl(0,0%,98%)] transition-colors cursor-pointer group"
                  data-testid={`featured-secondary-${article.id}`}
                >
                  {article.featuredImage && (
                    <div className="shrink-0 w-20 h-16 overflow-hidden">
                      <img
                        src={article.featuredImage}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div
                      className="mb-1"
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "hsl(182 55% 56%)",
                      }}
                    >
                      {article.category.name}
                    </div>
                    <p
                      className="line-clamp-2 group-hover:text-secondary transition-colors"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 14,
                        lineHeight: 1.35,
                        color: "hsl(0 0% 4%)",
                        margin: 0,
                      }}
                    >
                      {article.title}
                    </p>
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
