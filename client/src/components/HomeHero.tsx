import { useQuery } from "@tanstack/react-query";
import type { ArticleWithDetails } from "@shared/schema";
import FeaturedHero from "@/components/FeaturedHero";

function hasImage(a: ArticleWithDetails): boolean {
  return Boolean(a.splashImage || a.featuredImage || a.galleryImages?.[0]?.url);
}

/**
 * Homepage rotating hero — restores the auto-rotating "cover story"
 * band that used to live at the top of the home page before the
 * Hunger-style tile fork. Sources from the same
 * /api/articles/highlights payload as LatestHighlights so editors curate
 * one set and get two visual treatments:
 *
 *   - The hero (this component) shows the same 5 highlighted articles
 *     as a full-bleed rotator with dot / chevron controls.
 *   - LatestHighlights (below) shows them as a 3-across tile strip.
 *
 * Renders nothing when the highlights payload is empty — no sad empty
 * band while the queries are in flight.
 */
export default function HomeHero() {
  const { data } = useQuery<{ articles: ArticleWithDetails[]; issueNumber: number | null }>({
    queryKey: ["/api/articles/highlights"],
  });
  const articles = (data?.articles ?? []).filter(hasImage);
  if (articles.length === 0) return null;
  // showSecondary=false — the tile strip below would otherwise duplicate
  // exactly the same articles as text cards under the hero image.
  return <FeaturedHero articles={articles} showSecondary={false} />;
}
