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

  // Cap the strip at 12 so a maximally-flagged issue doesn't produce an
  // infinite-scrolling band. Filter out anything missing imagery —
  // text-only tiles look broken next to photographs.
  const articles = useMemo(() => {
    return (data?.articles ?? []).filter(hasImage).slice(0, 12);
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
          renderTile={(a) => <HighlightTile article={a} />}
        />
      </div>
    </section>
  );
}
