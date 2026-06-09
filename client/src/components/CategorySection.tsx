import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import LazyImage from "@/components/LazyImage";
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

function BigTile({ article, preferGallery }: { article: ArticleWithDetails; preferGallery: boolean }) {
  const img = tileImage(article, preferGallery);
  return (
    <Link href={`/article/${article.slug}`}>
      <article className="group cursor-pointer flex flex-col gap-3" data-testid={`section-bigtile-${article.slug}`}>
        <div className="relative overflow-hidden" style={{ aspectRatio: "4 / 3" }}>
          {img ? (
            <LazyImage
              src={img}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
            />
          ) : (
            tilePlaceholder(article)
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
            fontSize: "clamp(22px, 2vw, 32px)",
            fontWeight: 400,
            lineHeight: 1.15,
            letterSpacing: "-0.3px",
            color: "hsl(0 0% 4%)",
            margin: 0,
          }}
        >
          {article.title}
        </h3>
        {article.excerpt && (
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

function SmallTile({
  article,
  preferGallery,
  fillHeight = false,
}: {
  article: ArticleWithDetails;
  preferGallery: boolean;
  /** When true, image stretches to fill the grid cell (used in the
   *  feature layout so two small tiles together match the big tile's
   *  height). When false, image keeps a square aspect ratio. */
  fillHeight?: boolean;
}) {
  const img = tileImage(article, preferGallery);
  return (
    <Link href={`/article/${article.slug}`}>
      <article
        className={`group cursor-pointer flex flex-col gap-2 ${fillHeight ? "h-full" : ""}`}
        data-testid={`section-smalltile-${article.slug}`}
      >
        <div
          className={`relative overflow-hidden ${fillHeight ? "flex-1 min-h-0" : ""}`}
          style={fillHeight ? undefined : { aspectRatio: "1 / 1" }}
        >
          {img ? (
            <LazyImage
              src={img}
              alt={article.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[2500ms] ease-out group-hover:scale-[1.04]"
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
  const limit = variant === "feature" ? 4 : 3;
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
    // CSS grid trick: big tile spans 2 cols × 2 rows; each small tile
    // takes 1 col × 1 row in the right column. Row heights auto-size to
    // the big tile, so the two small tiles together exactly match the
    // big tile's height (minus the inter-row gap). Small tiles stretch
    // their image area to fill their cell via fillHeight.
    <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-4 lg:gap-6">
      <div className="lg:col-span-2 lg:row-span-2">
        {articles[0] && <BigTile article={articles[0]} preferGallery={preferGallery} />}
      </div>
      {articles.slice(1, 3).map((a) => (
        <SmallTile key={a.id} article={a} preferGallery={preferGallery} fillHeight />
      ))}
    </div>
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

  return (
    <section className="py-10 first:pt-4 border-b border-border last:border-b-0" data-testid={`section-${slug}`}>
      <div className="max-w-[1600px] mx-auto px-6">
        {heading}
        {body}
      </div>
    </section>
  );
}
