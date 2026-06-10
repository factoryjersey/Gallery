import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import LazyImage from "@/components/LazyImage";
import HighlightTile from "@/components/HighlightTile";
import TileSlider from "@/components/TileSlider";
import type { ArticleWithDetails, Category } from "@shared/schema";

interface Props {
  /** Display title for the section, e.g. "Events". */
  label: string;
  /** Category slug used both as the heading link and for the listing query. */
  slug: string;
  /** "feature" = 1 big tile + 3 small (large categories). "compact" = 3 equal small tiles. */
  variant: "feature" | "compact";
  /** Optional: prefer the first gallery_image as the tile image (paparazzi-style). */
  preferGallery?: boolean;
}

// For paparazzi-style articles where the featured image is often weak but
// the gallery has the actual content.
function tileImage(article: ArticleWithDetails, preferGallery: boolean): string | null {
  if (preferGallery && Array.isArray(article.galleryImages) && article.galleryImages[0]?.url) {
    return article.galleryImages[0].url;
  }
  return article.featuredImage || (article.galleryImages?.[0]?.url ?? null);
}

function tilePlaceholder(article: ArticleWithDetails) {
  return (
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
  );
}

function SmallTile({
  article,
  preferGallery,
}: {
  article: ArticleWithDetails;
  preferGallery: boolean;
  /** Kept in the type for source compatibility — every small tile is now
   *  square so this flag has no effect. */
  fillHeight?: boolean;
}) {
  const img = tileImage(article, preferGallery);
  return (
    <Link href={`/article/${article.slug}`}>
      <article
        className="group cursor-pointer flex flex-col gap-2"
        data-testid={`section-smalltile-${article.slug}`}
      >
        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: "1 / 1" }}
        >
          {img ? (
            <LazyImage
              src={img}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
            />
          ) : (
            tilePlaceholder(article)
          )}
        </div>
        <h4
          className="group-hover:text-secondary transition-colors line-clamp-2"
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 16,
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

export default function CategorySection({
  label,
  slug,
  variant,
  preferGallery = false,
}: Props) {
  // Feature variant: pull a deeper pool so the slider has something to
  // scroll to when a category has more than three recent articles.
  // Compact variant stays at 3 — it lives in a narrow column.
  const limit = variant === "feature" ? 12 : 3;
  // Look up the category id from its slug (shared cache hit since the rest
  // of the app already fetches /api/categories), then pull the latest few
  // articles. /api/articles takes categoryId; we don't have a slug filter.
  const { data: catsData } = useQuery<{ categories: Category[] }>({
    queryKey: ["/api/categories"],
  });
  const categoryId = catsData?.categories?.find((c) => c.slug === slug)?.id;

  const params = new URLSearchParams({
    ...(categoryId ? { categoryId } : {}),
    withImage: "true",
    limit: String(limit),
  });
  const { data, isLoading } = useQuery<{ articles: ArticleWithDetails[]; pagination?: any }>({
    queryKey: [`/api/articles?${params.toString()}`],
    enabled: !!categoryId,
  });

  const articles = data?.articles ?? [];
  if (!isLoading && articles.length === 0) return null;

  // Section header — used by both variants. The feature variant wraps it in
  // a full-bleed <section> with borders; the compact variant is meant to
  // nest inside a parent block so it just renders the header + tiles raw.
  const heading = (
    <header className={variant === "feature" ? "flex items-end justify-between gap-4 mb-6" : "mb-4"}>
      <Link href={`/category/${slug}`}>
        <h2
          className="hover:opacity-80 transition-opacity cursor-pointer"
          style={{
            fontFamily: variant === "feature" ? "Georgia, serif" : "Arial, sans-serif",
            fontSize: variant === "feature" ? "clamp(24px, 2.4vw, 38px)" : 11,
            fontWeight: variant === "feature" ? 400 : 700,
            lineHeight: 1.1,
            letterSpacing: variant === "feature" ? "-0.4px" : "0.14em",
            textTransform: variant === "feature" ? "none" : "uppercase",
            color: "hsl(0 0% 4%)",
            margin: 0,
          }}
        >
          {label}
        </h2>
      </Link>
      {variant === "feature" && (
        <Link href={`/category/${slug}`}>
          <span
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            See all <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      )}
    </header>
  );

  const body = variant === "feature" ? (
    // 3-across HighlightTile row. Auto-promotes to a horizontal slider
    // (Embla) when the category has more than three recent articles.
    // Off-screen slides keep their LazyImage so they don't fetch until
    // the visitor scrolls them in.
    <TileSlider
      items={articles}
      keyFor={(a) => a.id}
      renderTile={(a) => <HighlightTile article={a} preferGallery={preferGallery} />}
    />
  ) : (
    <div className="grid grid-cols-1 gap-4">
      {articles.slice(0, 3).map((a) => (
        <SmallTile key={a.id} article={a} preferGallery={preferGallery} />
      ))}
    </div>
  );

  if (variant === "compact") {
    // Caller (e.g. "More to read" block in home) provides the outer band.
    return (
      <div data-testid={`section-${slug}`}>
        {heading}
        {body}
      </div>
    );
  }

  // The feature variant lives inside the home page's column-with-sidebar
  // layout, so no inner max-width / horizontal padding — those are owned
  // by the parent container. We just stack section bands with hairline
  // dividers and consistent vertical breathing room.
  return (
    <section className="py-8 first:pt-0 border-b border-border last:border-b-0" data-testid={`section-${slug}`}>
      {heading}
      {body}
    </section>
  );
}
