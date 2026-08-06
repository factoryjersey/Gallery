import { useQuery } from "@tanstack/react-query";
import type { ArticleWithDetails } from "@shared/schema";
import FeaturedHero from "@/components/FeaturedHero";

function hasImage(a: ArticleWithDetails): boolean {
  return Boolean(a.splashImage || a.featuredImage || a.galleryImages?.[0]?.url);
}

/**
 * Homepage rotating hero — auto-rotating "cover story" band at the top
 * of the home page. Sources from /api/articles/featured which is
 * driven by the Admin → Featured Stories manager: whatever the editor
 * pins there ends up here, ordered by featuredOrder. If nothing is
 * pinned, the endpoint's fallback surfaces the latest published
 * articles with images (respecting the manager's category-exclusion
 * rules) so the hero is never empty.
 *
 * LatestHighlights below uses the same payload for its tile strip —
 * one curation surface, two visual expressions.
 */
export default function HomeHero() {
  const { data } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: ["/api/articles/featured?limit=5"],
  });
  const articles = (data?.articles ?? []).filter(hasImage);
  if (articles.length === 0) return null;
  // showSecondary=false — the tile strip below would otherwise duplicate
  // exactly the same articles as text cards under the hero image.
  return <FeaturedHero articles={articles} showSecondary={false} />;
}
