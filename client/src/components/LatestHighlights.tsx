import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import LazyImage from "@/components/LazyImage";
import type { ArticleWithDetails } from "@shared/schema";

function tileImage(article: ArticleWithDetails): string | null {
  return (
    article.splashImage ||
    article.featuredImage ||
    article.galleryImages?.[0]?.url ||
    null
  );
}

function BigHero({ article }: { article: ArticleWithDetails }) {
  const img = tileImage(article);
  return (
    <Link href={`/article/${article.slug}`}>
      <article className="group cursor-pointer flex flex-col gap-3" data-testid={`highlight-big-${article.slug}`}>
        <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
          {img && (
            <LazyImage
              src={img}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
            />
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
            fontSize: "clamp(28px, 3vw, 44px)",
            fontWeight: 400,
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            color: "hsl(0 0% 4%)",
            margin: 0,
          }}
        >
          {article.title}
        </h3>
        {article.excerpt && (
          <p
            className="line-clamp-3"
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 16,
              lineHeight: 1.55,
              color: "hsl(0 0% 30%)",
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

function SideTile({ article }: { article: ArticleWithDetails }) {
  const img = tileImage(article);
  return (
    <Link href={`/article/${article.slug}`}>
      <article className="group cursor-pointer flex flex-col gap-2 h-full" data-testid={`highlight-side-${article.slug}`}>
        <div className="relative overflow-hidden flex-1 min-h-0">
          {img && (
            <LazyImage
              src={img}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
            />
          )}
        </div>
        <div
          style={{
            fontFamily: "Arial, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "hsl(182 55% 56%)",
          }}
        >
          {article.category.name}
        </div>
        <h4
          className="group-hover:text-secondary transition-colors line-clamp-2"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: "clamp(15px, 1.1vw, 18px)",
            fontWeight: 400,
            lineHeight: 1.2,
            color: "hsl(0 0% 4%)",
            margin: 0,
          }}
        >
          {article.title}
        </h4>
      </article>
    </Link>
  );
}

/**
 * Hero band at the top of the home — one big curated story plus two
 * smaller ones stacked on the right whose heights together match the
 * big tile's. Pulls from /api/articles/featured (admin-curated).
 */
export default function LatestHighlights() {
  // Pulls from the latest-issue highlights (articles in the current
  // issue with homepage_highlight=true). Falls back to featured /
  // most-recent on a brand-new issue with nothing flagged yet —
  // handled server-side, so the component just consumes the result.
  const { data } = useQuery<{ articles: ArticleWithDetails[]; issueNumber: number | null }>({
    queryKey: ["/api/articles/highlights"],
  });
  // Take up to the first 6 with usable imagery, then shuffle and pick 3.
  // Memoised so a re-render (e.g. router change) doesn't reshuffle mid-view,
  // but a fresh visit yields a different big tile + side tiles.
  const articles = useMemo(() => {
    const pool = (data?.articles ?? []).filter((a) => !!tileImage(a)).slice(0, 6);
    if (pool.length <= 3) return pool.slice(0, 3);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, 3);
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
        <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 lg:gap-8">
          <div className="lg:col-span-2 lg:row-span-2">
            <BigHero article={articles[0]} />
          </div>
          {articles.slice(1, 3).map((a) => (
            <SideTile key={a.id} article={a} />
          ))}
        </div>
      </div>
    </section>
  );
}
