import { Link } from "wouter";
import LazyImage from "@/components/LazyImage";
import type { ArticleWithDetails } from "@shared/schema";

interface Props {
  article: ArticleWithDetails;
  /** Paparazzi-style sections: prefer the first gallery image over the
   *  featured image because the featured field is often a weak thumbnail. */
  preferGallery?: boolean;
  /** Show the standfirst/excerpt under the title. Default true. Set false
   *  for tight grids where titles alone are enough. */
  showExcerpt?: boolean;
  /** Mark as the LCP candidate — skips the IntersectionObserver gate and
   *  bumps fetchpriority. Use on the first tile in the homepage strip. */
  priority?: boolean;
}

function tileImage(article: ArticleWithDetails, preferGallery: boolean): string | null {
  if (preferGallery && Array.isArray(article.galleryImages) && article.galleryImages[0]?.url) {
    return article.galleryImages[0].url;
  }
  return (
    article.splashImage ||
    article.featuredImage ||
    article.galleryImages?.[0]?.url ||
    null
  );
}

/**
 * Equal-width article tile: square image up top, category superhead,
 * title, optional excerpt. Used inside the latest-highlights strip and
 * the category sections — the 3-across layout that replaced the old
 * 1-big + 2-side grid.
 *
 * Image uses LazyImage so off-screen slides in a TileSlider don't
 * download until they scroll into view.
 */
export default function HighlightTile({ article, preferGallery = false, showExcerpt = true, priority = false }: Props) {
  const img = tileImage(article, preferGallery);
  return (
    <Link href={`/article/${article.slug}`}>
      <article
        className="group cursor-pointer flex flex-col gap-3 h-full"
        data-testid={`tile-${article.slug}`}
      >
        <div className="relative overflow-hidden" style={{ aspectRatio: "1 / 1" }}>
          {img ? (
            <LazyImage
              src={img}
              alt={article.title}
              priority={priority}
              className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[hsl(0,0%,94%)]">
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
        <div
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "hsl(182 55% 56%)",
          }}
        >
          {article.category.name}
        </div>
        <h3
          className="group-hover:text-secondary transition-colors line-clamp-2"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(20px, 1.6vw, 26px)",
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-0.3px",
            color: "hsl(0 0% 4%)",
            margin: 0,
          }}
        >
          {article.title}
        </h3>
        {showExcerpt && article.excerpt && (
          <p
            className="line-clamp-2"
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 15,
              lineHeight: 1.55,
              color: "hsl(0 0% 35%)",
              margin: 0,
            }}
          >
            {article.excerpt}
          </p>
        )}
      </article>
    </Link>
  );
}
