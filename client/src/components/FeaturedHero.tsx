import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ArticleWithDetails } from "@shared/schema";
import LazyImage from "@/components/LazyImage";

interface FeaturedHeroProps {
  articles: ArticleWithDetails[];
  /** Kept as a no-op for backwards compatibility with the previous
   *  text-left / image-right variant that had a small strip of other
   *  featured cards beneath the main hero. The new flood-fill design
   *  doesn't include a secondary strip — LatestHighlights below the
   *  hero covers the "other picks" role instead. */
  showSecondary?: boolean;
}

const ROTATION_MS = 7000;
const CROSSFADE_MS = 900;

/**
 * Flood-fill homepage hero: full-bleed image beneath a dark bottom
 * gradient, white serif title dropped in over the image's lower half,
 * category superhead in the brand teal above it. Auto-rotates through
 * every featured article, pauses on hover, exposes chevron + dot
 * controls at the bottom-right of the frame.
 *
 * Sourced from /api/articles/featured via the HomeHero wrapper — same
 * curation surface as LatestHighlights below.
 */
export default function FeaturedHero({ articles }: FeaturedHeroProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const total = articles.length;

  const goto = useCallback(
    (i: number) => setActiveIndex(((i % total) + total) % total),
    [total],
  );
  const next = useCallback(() => goto(activeIndex + 1), [goto, activeIndex]);
  const prev = useCallback(() => goto(activeIndex - 1), [goto, activeIndex]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const id = setInterval(() => goto(activeIndex + 1), ROTATION_MS);
    return () => clearInterval(id);
  }, [paused, total, activeIndex, goto]);

  if (total === 0) return null;

  return (
    <section
      className="relative w-full bg-black overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-testid="featured-hero"
      aria-roledescription="carousel"
      aria-label="Featured stories"
    >
      {/* Height ladder. Mobile: 4:5 portrait leaves room for headline
          over image; desktop: 55vh capped at 720px feels like a print
          spread without pushing the highlights strip below the fold. */}
      <div className="relative w-full h-[560px] sm:h-[65vh] sm:min-h-[520px] sm:max-h-[720px]">
        {articles.map((article, i) => {
          const isActive = i === activeIndex;
          return (
            <article
              key={article.id}
              aria-hidden={!isActive}
              className="absolute inset-0"
              style={{
                opacity: isActive ? 1 : 0,
                pointerEvents: isActive ? "auto" : "none",
                transition: `opacity ${CROSSFADE_MS}ms ease`,
                zIndex: isActive ? 2 : 1,
              }}
              data-testid={`featured-slide-${article.slug}`}
            >
              <Link href={`/article/${article.slug}`}>
                <div className="group relative w-full h-full cursor-pointer">
                  {/* Image layer — priority on the first slide so the
                      browser fetches it as an LCP candidate. Very slow
                      Ken-Burns-ish scale on hover so the still image
                      doesn't feel dead. */}
                  {article.featuredImage ? (
                    <LazyImage
                      src={article.featuredImage}
                      alt={article.title}
                      priority={i === 0}
                      className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-[6000ms] ease-out group-hover:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-[hsl(0,0%,12%)]" />
                  )}
                  {/* Dark gradient overlay — deeper at bottom so the
                      title reads on any image, transparent at top so
                      the photograph breathes. Second layer adds a
                      whisper of overall darkening for extra contrast
                      on bright shots. */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.55) 30%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0) 75%)",
                    }}
                  />
                  <div className="absolute inset-0 bg-black/10" />

                  {/* Copy layer — max-width so long titles wrap into a
                      column rather than sprawling across the frame. */}
                  <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 lg:p-16 text-white">
                    <div className="max-w-3xl">
                      <div
                        className="mb-3"
                        style={{
                          fontFamily: "Arial, Helvetica, sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.18em",
                          textTransform: "uppercase",
                          color: "hsl(52 97% 56%)",
                        }}
                        data-testid="featured-main-category"
                      >
                        {article.category.name}
                      </div>
                      <h1
                        className="mb-3 sm:mb-4"
                        style={{
                          fontFamily: "Georgia, serif",
                          fontSize: "clamp(30px, 4.2vw, 60px)",
                          fontWeight: 400,
                          lineHeight: 1.08,
                          letterSpacing: "-0.6px",
                          color: "#ffffff",
                          margin: 0,
                          textShadow: "0 2px 24px rgba(0,0,0,0.35)",
                        }}
                        data-testid="featured-main-title"
                      >
                        {article.title}
                      </h1>
                      {article.excerpt && (
                        <p
                          className="mb-4 line-clamp-2 sm:line-clamp-3"
                          style={{
                            fontFamily: "Georgia, serif",
                            fontSize: "clamp(15px, 1.3vw, 18px)",
                            lineHeight: 1.5,
                            color: "rgba(255,255,255,0.88)",
                            margin: 0,
                          }}
                          data-testid="featured-main-excerpt"
                        >
                          {article.excerpt}
                        </p>
                      )}
                      <div
                        style={{
                          fontFamily: "Arial, sans-serif",
                          fontSize: 12,
                          color: "rgba(255,255,255,0.7)",
                          letterSpacing: "0.02em",
                        }}
                        data-testid="featured-main-author"
                      >
                        By {article.author.name} —{" "}
                        {format(
                          new Date(article.publishedAt || article.createdAt),
                          "d MMMM yyyy",
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}

        {/* Controls — floats over the frame at the bottom-right so it
            never sits on top of the headline block. Own z-index so
            it's above the crossfading slide layers. */}
        {total > 1 && (
          <div
            className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-10 flex items-center gap-3 rounded-full bg-black/40 backdrop-blur-sm px-3 py-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-2">
              {articles.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goto(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  data-testid={`hero-dot-${i}`}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "9999px",
                    border: "none",
                    background:
                      i === activeIndex ? "#ffffff" : "rgba(255,255,255,0.4)",
                    cursor: "pointer",
                    padding: 0,
                    transition: "background 0.2s",
                  }}
                />
              ))}
            </div>
            <span className="w-px h-4 bg-white/30" aria-hidden="true" />
            <button
              onClick={prev}
              aria-label="Previous story"
              className="text-white hover:opacity-70 transition-opacity"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              data-testid="hero-prev"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Next story"
              className="text-white hover:opacity-70 transition-opacity"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
              data-testid="hero-next"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
