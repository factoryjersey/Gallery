import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import LazyImage from "@/components/LazyImage";
import type { ArticleWithDetails } from "@shared/schema";

interface Props {
  /** The article we're finding relations for — its slug drives the query
   *  and is excluded from the result server-side. */
  slug: string;
  /** How many to fetch (server capped at 12). Default 4. */
  limit?: number;
  /** Optional label override. Default "Related". */
  label?: string;
}

function tileImage(article: ArticleWithDetails): string | null {
  return (
    article.featuredImage ||
    article.splashImage ||
    article.galleryImages?.[0]?.url ||
    null
  );
}

/**
 * Compact vertical list of related articles, scored server-side on
 * shared category + tag overlap. Sits at the bottom of the article
 * page under the body, above the author-bio footer.
 *
 * Renders nothing when the endpoint returns no candidates (a brand-new
 * article with no tags in an unpopulated category) so the article
 * doesn't grow an empty band. Each row is small-thumbnail-plus-title,
 * consistent with the sidebar Trending pattern the visitor already
 * knows from the home page.
 */
export default function RelatedArticles({ slug, limit = 4, label = "Related" }: Props) {
  const { data } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: [`/api/articles/by-slug/${slug}/related?limit=${limit}`],
    // Kept fresh across route changes so opening a new article
    // recomputes its own related set; not shared across articles.
    enabled: !!slug,
  });

  const articles = (data?.articles ?? []).filter(Boolean);
  if (articles.length === 0) return null;

  return (
    <aside
      className="mt-14 pt-8 border-t border-border"
      data-testid="related-articles"
      aria-labelledby="related-heading"
    >
      <h3
        id="related-heading"
        className="mb-6"
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "hsl(0 0% 4%)",
          borderBottom: "3px solid hsl(52 97% 56%)",
          paddingBottom: 6,
          display: "inline-block",
          margin: 0,
        }}
      >
        {label}
      </h3>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 list-none p-0 m-0">
        {articles.map((article) => {
          const img = tileImage(article);
          return (
            <li key={article.id}>
              <Link href={`/article/${article.slug}`}>
                <div
                  className="group flex gap-4 items-start py-2 hover:bg-[hsl(0,0%,98%)] -mx-2 px-2 rounded-sm transition-colors cursor-pointer"
                  data-testid={`related-tile-${article.slug}`}
                >
                  <div
                    className="shrink-0 w-20 h-20 overflow-hidden bg-[hsl(0,0%,94%)]"
                    aria-hidden="true"
                  >
                    {img ? (
                      <LazyImage
                        src={img}
                        alt=""
                        className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] uppercase tracking-widest text-muted-foreground text-center px-1 leading-tight">
                        {article.category?.name || ""}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="mb-1"
                      style={{
                        fontFamily: "Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: "hsl(182 55% 56%)",
                      }}
                    >
                      {article.category?.name || ""}
                    </div>
                    <p
                      className="line-clamp-3 group-hover:text-secondary transition-colors"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 15,
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
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
