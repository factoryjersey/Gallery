import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import HighlightTile from "@/components/HighlightTile";
import TileSlider from "@/components/TileSlider";
import type { ArticleWithDetails } from "@shared/schema";

function hasImage(article: ArticleWithDetails): boolean {
  return Boolean(
    article.splashImage ||
      article.featuredImage ||
      article.galleryImages?.[0]?.url,
  );
}

/**
 * Latest-highlights strip at the top of the home page.
 *
 * Pulls from /api/articles/highlights — admin-flagged articles in the
 * current published issue (with sensible fallbacks server-side). Renders
 * as a 3-up tile grid; if more than three are flagged, TileSlider
 * upgrades it to a horizontal carousel with lazy-loaded slides.
 */
export default function LatestHighlights() {
  const { data } = useQuery<{ articles: ArticleWithDetails[]; issueNumber: number | null }>({
    queryKey: ["/api/articles/highlights"],
  });

  // Hard cap at 5: the server-side highlight enforcer keeps the flagged
  // set at or under this, but slicing client-side too means even if a
  // stale cache hands us more, we never render more than five. Newest
  // first (server orders by published_at DESC) → newest tile sits on
  // the left of the strip. Filter out images-less rows so the strip
  // never includes a placeholder-looking tile next to photographs.
  const articles = useMemo(() => {
    return (data?.articles ?? []).filter(hasImage).slice(0, 5);
  }, [data]);

  if (articles.length === 0) return null;

  return (
    <section className="pt-8 pb-12 border-b border-border" data-testid="latest-highlights">
      <div className="max-w-[1500px] mx-auto px-6">
        <div className="mb-6">
          <span
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "hsl(0 0% 4%)",
              borderBottom: "3px solid hsl(52 97% 56%)",
              paddingBottom: 6,
            }}
          >
            Latest Highlights
          </span>
        </div>
        <TileSlider
          items={articles}
          keyFor={(a) => a.id}
          // First tile gets priority — it's the likely LCP candidate
          // when the visitor lands on the homepage with the splash
          // already dismissed (or skipped).
          renderTile={(a, i) => <HighlightTile article={a} priority={i === 0} />}
        />
      </div>
    </section>
  );
}
