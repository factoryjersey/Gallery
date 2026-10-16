import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, ArrowLeft, ArrowRight, Edit, Columns, AlignLeft, LayoutGrid, Rows3 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import ArticleGallery from "@/components/ArticleGallery";
import RichContent from "@/components/RichContent";
import PaparazziGallery from "@/components/PaparazziGallery";
import PhotoshootSlider from "@/components/PhotoshootSlider";
import PhotoshootMasonry from "@/components/PhotoshootMasonry";
import GalleryCarousel from "@/components/GalleryCarousel";
import GalleryGrid from "@/components/GalleryGrid";
import PhotoshootGrid from "@/components/PhotoshootGrid";
import EventsGrid from "@/components/EventsGrid";
import VideoPlayer from "@/components/VideoPlayer";
import RelatedArticles from "@/components/RelatedArticles";
import { useAdmin } from "@/contexts/AdminContext";

export default function Article() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const { isAdmin } = useAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/articles/by-slug/${slug}`],
  });

  const article = data?.article;
  // Two paths to "this is a photoshoot, render it differently":
  //
  //  1. Explicit contentType = "photoshoot" — the new article type. The
  //     gallery images render as a full-bleed 3-across PhotoshootGrid on
  //     a black background. Standard lead image + flow body are skipped.
  //  2. Legacy fashion-shoots that haven't been migrated to galleryImages
  //     yet — fall back to PhotoshootSlider, which extracts images from
  //     the body HTML.
  //
  // `isPhotoshoot` covers both so the standard non-photoshoot body block
  // gets skipped in either case; the renderer below then picks the right
  // sub-path.
  const isExplicitPhotoshoot = article?.contentType === "photoshoot";
  const isLegacyPhotoshoot =
    !isExplicitPhotoshoot &&
    article?.category?.slug === "fashion-shoots" &&
    !(Array.isArray(article?.galleryImages) && article!.galleryImages!.length > 0);
  const isPhotoshoot = isExplicitPhotoshoot || isLegacyPhotoshoot;

  // Editor-selected "text at the top, full-width masonry below" layout
  // for picture-led features that aren't contentType=photoshoot. When
  // on, we force the narrow reading column (header + byline + body),
  // skip the inline gallery render inside the article container, and
  // append a full-bleed PhotoshootMasonry after the body. Only applies
  // when the article actually has galleryImages to show — otherwise
  // falls through to the default inline treatment.
  const isFullWidthGallery =
    !isPhotoshoot &&
    article?.galleryLayout === "full-width-masonry" &&
    Array.isArray(article?.galleryImages) &&
    (article!.galleryImages as any[]).length > 0;

  // Desktop layout preference: 2-col is the default — featured image
  // sticky on the left, body copy on the right, magazine-spread feel.
  // 1-col is the classic centred-narrow read. We persist whatever the
  // visitor last chose to localStorage so an explicit pick sticks
  // across visits; new visitors land on 2-col.
  const [layout, setLayout] = useState<"one-col" | "two-col">(() => {
    if (typeof window === "undefined") return "two-col";
    const stored = window.localStorage.getItem("gallery-article-layout");
    return stored === "one-col" || stored === "two-col" ? stored : "two-col";
  });
  useEffect(() => {
    try { window.localStorage.setItem("gallery-article-layout", layout); } catch {}
  }, [layout]);

  // Photoshoot gallery layout preference. Separate from `layout` above
  // because that controls the reading column; this controls the photo
  // grid itself. 'grid' = PhotoshootGrid (3-across square crops,
  // dramatic uniform rhythm). 'masonry' = PhotoshootMasonry (natural
  // aspect ratios, better for shoots mixing portrait + landscape).
  // Persisted per-browser so the reader's chosen view sticks across
  // photoshoots.
  const [photoshootLayout, setPhotoshootLayout] = useState<"grid" | "masonry">(() => {
    if (typeof window === "undefined") return "grid";
    const stored = window.localStorage.getItem("gallery-photoshoot-layout");
    return stored === "masonry" || stored === "grid" ? stored : "grid";
  });
  useEffect(() => {
    try { window.localStorage.setItem("gallery-photoshoot-layout", photoshootLayout); } catch {}
  }, [photoshootLayout]);

  // Per-article title, description, and Open Graph image so link
  // previews on Slack / WhatsApp / LinkedIn / Twitter render properly,
  // and so the browser tab + search engines see the article's own
  // headline rather than the site default.
  useDocumentMeta({
    title: article?.title,
    description: article?.excerpt || undefined,
    image: article?.splashImage || article?.featuredImage || article?.galleryImages?.[0]?.url || undefined,
    publishedAt: article?.publishedAt || undefined,
    author: article?.author?.name,
    type: "article",
  });

  const { data: adjacentData } = useQuery({
    queryKey: [`/api/articles/by-slug/${slug}/adjacent`],
    enabled: article?.contentType === "cartoon",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-[760px] mx-auto px-6 py-12 animate-pulse space-y-6">
          <div className="h-3 bg-border rounded w-20" />
          <div className="h-10 bg-border rounded w-3/4" />
          <div className="h-4 bg-border rounded w-1/2" />
          <div className="h-72 bg-border" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-border rounded" style={{ width: `${85 + Math.random() * 15}%` }} />
            ))}
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !data?.article) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-[760px] mx-auto px-6 py-16 text-center">
          <h1 className="mb-4" style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 400 }}>
            Article Not Found
          </h1>
          <p className="mb-6" style={{ fontFamily: "Arial, sans-serif", fontSize: 14, color: "hsl(0 0% 43%)" }}>
            The article you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/">
            <span className="inline-flex items-center gap-2 text-secondary hover:underline cursor-pointer"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <ArrowLeft className="h-4 w-4" /> Back to Home
            </span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Article — container width adapts to layout choice. 2-col gives the
          image room to sit alongside the body without cramping either.
          Photoshoots force the narrow read width because the body block
          is skipped entirely; the gallery escapes the container width via
          negative margins to run full-bleed on black. */}
      <article
        className={`mx-auto px-6 py-10 ${
          isExplicitPhotoshoot
            ? "max-w-[760px]"
            : isFullWidthGallery
              ? // Site width — the title + body stretch across the
                // whole page so there's no awkward whitespace on
                // either side of a short header above a full-bleed
                // masonry. Matches the max-w category pages use.
                "max-w-[1296px]"
              : layout === "two-col"
                ? "max-w-[1200px]"
                : "max-w-[760px]"
        }`}
      >

        {/* Back + layout toggle + Edit */}
        <div className="flex justify-between items-center mb-8 gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => {
              // Use the browser history. SPA pushState navigations are
              // tracked correctly here; the referrer check we had before
              // didn't work for in-app links because document.referrer
              // only updates on full page loads.
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate("/");
              }
            }}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-0 p-0"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}
            data-testid="back-button"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Articles
          </button>
          {/* Hide the 1-col / 2-col toggle for photoshoots — the gallery
              renders full-bleed regardless, and the body is skipped, so
              the toggle has nothing meaningful to switch. */}
          {!isExplicitPhotoshoot && !isFullWidthGallery && <LayoutToggle layout={layout} setLayout={setLayout} />}
          {isAdmin && article && (
            <button
              onClick={() => {
                // Pass the article id directly through the URL so the
                // admin editor is deep-linkable — refresh, share, or
                // paste the URL and it loads the right article.
                navigate(`/admin?tab=articles&edit=${encodeURIComponent(article.id)}`);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-white hover:bg-secondary hover:text-foreground transition-colors"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
              data-testid="button-edit-article"
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {/* Compact meta strip — only for full-width-masonry articles.
            Puts category + tags + byline + date + read-time all on one
            inline row so the header isn't three stacked lines wasting
            vertical space above the (full-width) title + body. */}
        {isFullWidthGallery && (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6 pb-4 border-b border-border"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
            data-testid="compact-meta"
          >
            <Link href={`/category/${article.category.slug}`}>
              <span
                className="hover:opacity-70 transition-opacity cursor-pointer"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "hsl(182 55% 56%)",
                }}
                data-testid="article-category"
              >
                {article.category.name}
              </span>
            </Link>
            {article.tags.map((tag: any) => (
              <span
                key={tag.id}
                style={{
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "hsl(0 0% 60%)",
                  border: "1px solid hsl(0 0% 85%)",
                  padding: "2px 8px",
                }}
                data-testid={`article-tag-${tag.slug}`}
              >
                {tag.name}
              </span>
            ))}
            <span>
              By{" "}
              {article.author.slug ? (
                <Link href={`/author/${article.author.slug}`}>
                  <a className="hover:underline">
                    <strong style={{ color: "hsl(0 0% 4%)", fontWeight: 600 }}>{article.author.name}</strong>
                  </a>
                </Link>
              ) : (
                <strong style={{ color: "hsl(0 0% 4%)", fontWeight: 600 }}>{article.author.name}</strong>
              )}
            </span>
            <span>—</span>
            <span data-testid="article-date">
              {format(new Date(article.publishedAt || article.createdAt), "d MMMM yyyy")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span data-testid="article-read-time">{article.readTime} min read</span>
            </span>
          </div>
        )}

        {/* Header */}
        {!isFullWidthGallery && (
        <header className="mb-8">
          {/* Category + tags */}
          <div className="flex flex-wrap items-center gap-4 mb-5">
            <Link href={`/category/${article.category.slug}`}>
              <span
                className="hover:opacity-70 transition-opacity cursor-pointer"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "hsl(182 55% 56%)",
                }}
                data-testid="article-category"
              >
                {article.category.name}
              </span>
            </Link>
            {article.tags.map((tag: any) => (
              <span
                key={tag.id}
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "hsl(0 0% 60%)",
                  border: "1px solid hsl(0 0% 85%)",
                  padding: "2px 8px",
                }}
                data-testid={`article-tag-${tag.slug}`}
              >
                {tag.name}
              </span>
            ))}
          </div>

          {/* Title + excerpt — hidden from the header when the
              full-width-masonry layout is on; both get re-rendered
              side-by-side in a two-column grid below so the eye
              lands on the picture gallery sooner. */}
          {!isFullWidthGallery && (
            <h1
              className="mb-5"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(28px, 4vw, 42px)",
                fontWeight: 400,
                lineHeight: 1.18,
                letterSpacing: "-0.5px",
                color: "hsl(0 0% 4%)",
              }}
              data-testid="article-title"
            >
              {article.title}
            </h1>
          )}

          {!isFullWidthGallery && article.excerpt && (
            <p
              className="mb-6"
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 18,
                lineHeight: 1.6,
                color: "hsl(0 0% 43%)",
                fontStyle: "italic",
                borderLeft: "3px solid hsl(52 97% 56%)",
                paddingLeft: 16,
              }}
              data-testid="article-excerpt"
            >
              {article.excerpt}
            </p>
          )}

          {/* Byline */}
          <div
            className="flex flex-wrap items-center gap-4 pb-6 border-b border-border"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
          >
            <span data-testid="article-author">
              By{" "}
              {article.author.slug ? (
                <Link href={`/author/${article.author.slug}`}>
                  <a className="hover:underline">
                    <strong style={{ color: "hsl(0 0% 4%)", fontWeight: 600 }}>{article.author.name}</strong>
                  </a>
                </Link>
              ) : (
                <strong style={{ color: "hsl(0 0% 4%)", fontWeight: 600 }}>{article.author.name}</strong>
              )}
            </span>
            {(() => {
              // Group structured credits by role (photographer / illustrator / …).
              // Falls back to the legacy text columns when an article hasn't
              // been migrated to the contributors table yet.
              const credits = Array.isArray((article as any).credits)
                ? (article as any).credits as Array<{ id: string; name: string; slug: string; role: string }>
                : [];
              const grouped = new Map<string, typeof credits>();
              for (const c of credits) {
                const arr = grouped.get(c.role) || [];
                arr.push(c);
                grouped.set(c.role, arr);
              }
              const labels: Record<string, string> = {
                photographer: "Photography",
                illustrator: "Illustration",
                stylist: "Styling",
                hair: "Hair",
                makeup: "Makeup",
              };
              const photogs = grouped.get("photographer") || [];
              const illos = grouped.get("illustrator") || [];

              const renderRoleCredit = (role: string, list: typeof credits, legacy?: string | null) => {
                if (list.length > 0) {
                  return (
                    <span data-testid={`article-${role}`}>
                      {labels[role] || role}{" "}
                      {list.map((c, i) => (
                        <span key={c.id}>
                          {i > 0 && <span>, </span>}
                          <Link href={`/contributor/${c.slug}`}>
                            <a className="hover:underline">
                              <strong style={{ color: "hsl(0 0% 4%)", fontWeight: 600 }}>{c.name}</strong>
                            </a>
                          </Link>
                        </span>
                      ))}
                    </span>
                  );
                }
                if (legacy) {
                  return (
                    <span data-testid={`article-${role}`}>
                      {labels[role] || role}{" "}
                      <strong style={{ color: "hsl(0 0% 4%)", fontWeight: 600 }}>{legacy}</strong>
                    </span>
                  );
                }
                return null;
              };

              return (
                <>
                  {renderRoleCredit("photographer", photogs, article.photographer)}
                  {renderRoleCredit("illustrator", illos, article.illustrator)}
                  {/* Render any other custom roles attached via the contributors picker */}
                  {Array.from(grouped.entries())
                    .filter(([role]) => role !== "photographer" && role !== "illustrator")
                    .map(([role, list]) => (
                      <span key={role}>{renderRoleCredit(role, list)}</span>
                    ))}
                </>
              );
            })()}
            <span>—</span>
            <span data-testid="article-date">
              {format(new Date(article.publishedAt || article.createdAt), "d MMMM yyyy")}
            </span>
            {article.contentType !== "gallery" && article.contentType !== "photoshoot" && !isPhotoshoot && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span data-testid="article-read-time">{article.readTime} min read</span>
              </span>
            )}
          </div>
        </header>
        )}

        {/* Body content — non-photoshoot. Photoshoots render outside this
            container so the slider can be full-page width (see below).
            2-col mode wraps the lead image + body in a grid so the image
            sits left (sticky on desktop) while the copy reads right. */}
        {!isPhotoshoot && (
          <div className={layout === "two-col" && !isFullWidthGallery ? "lg:grid lg:grid-cols-[5fr_7fr] lg:gap-10 lg:items-start" : ""}>
            {/* Lead media — video wins if the editor set one, otherwise
                the featured image acts as usual. Video containers keep
                the same sticky-left behaviour on 2-col layouts. */}
            {article.featuredVideo && article.contentType !== "gallery" && !isFullWidthGallery && (
              <figure
                className={
                  layout === "two-col"
                    ? "mb-8 -mx-6 sm:mx-0 lg:m-0 lg:sticky lg:top-40"
                    : "mb-8 -mx-6 sm:mx-0"
                }
                data-testid="article-featured-video"
              >
                <VideoPlayer
                  url={article.featuredVideo}
                  title={article.title}
                  poster={article.featuredImage || undefined}
                />
              </figure>
            )}
            {!article.featuredVideo && article.featuredImage && article.contentType !== "gallery" && !isFullWidthGallery && (
              <figure
                className={
                  layout === "two-col"
                    ? // Sticky offset = full header height (masthead + category
                      // nav ≈ 144px) + a small breathing gap, so the image
                      // parks just below the nav rather than tucking under it.
                      "mb-8 -mx-6 sm:mx-0 lg:m-0 lg:sticky lg:top-40"
                    : "mb-8 -mx-6 sm:mx-0"
                }
              >
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  className="w-full h-auto block lg:max-h-[calc(100vh-200px)] lg:object-contain"
                  loading="eager"
                  // LCP signal: this image is the dominant above-the-fold
                  // element on an article view. Marking it high-priority
                  // and decoding sync tells the browser to start the
                  // network fetch and image decode immediately.
                  {...({ fetchpriority: "high" } as any)}
                  decoding="sync"
                  data-testid="article-featured-image"
                />
              </figure>
            )}

            <div className={layout === "two-col" ? "lg:min-w-0" : ""}>
              {/* Curated image gallery (admin-curated, in article.galleryImages).
                  Layout picker, top-to-bottom precedence:
                   - events category → EventsGrid (3-up squares + caption
                     under each photo; the caption *is* the content).
                   - paparazzi / fashion / fashion-shoots / gallery-typed
                     / 12+ images → GalleryGrid (masonry, captions in
                     lightbox only).
                   - everything else → GalleryCarousel (inline flow). */}
              {Array.isArray(article.galleryImages) && article.galleryImages.length > 0 && !isFullWidthGallery && (() => {
                const imgs = article.galleryImages;
                const isEvents = article.category?.slug === "events";
                const useGrid =
                  !isEvents && (
                    article.contentType === "gallery" ||
                    article.category?.slug === "paparazzi" ||
                    article.category?.slug === "fashion-shoots" ||
                    article.category?.slug === "fashion" ||
                    imgs.length >= 12
                  );
                return (
                  <div className="mb-10 -mx-6 sm:mx-0">
                    {isEvents ? (
                      <EventsGrid images={imgs} altPrefix={article.title} />
                    ) : useGrid ? (
                      <GalleryGrid images={imgs} altPrefix={article.title} />
                    ) : (
                      <GalleryCarousel images={imgs} altPrefix={article.title} />
                    )}
                  </div>
                );
              })()}

              {isFullWidthGallery ? (
                // Full-width-masonry header, single-column flow:
                //   Title → Standfirst (italic, left-ruled) → Body
                // Everything at the standard reading width so a long
                // body copy and a short standfirst don't produce a
                // lopsided two-column layout with white space on one
                // side. The gallery below still runs full-bleed.
                //
                // This branch wins over the contentType==='gallery'
                // PaparazziGallery branch below so an editor who
                // explicitly set the layout to full-width-masonry
                // gets what they asked for, even on a 'gallery' type
                // article where PaparazziGallery would otherwise
                // scrape <img> tags out of the body (and render
                // nothing for a body that only contains text).
                <div className="mb-10">
                  <h1
                    className="mb-6"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: "clamp(28px, 4vw, 42px)",
                      fontWeight: 400,
                      lineHeight: 1.18,
                      letterSpacing: "-0.5px",
                      color: "hsl(0 0% 4%)",
                      margin: 0,
                    }}
                    data-testid="article-title"
                  >
                    {article.title}
                  </h1>
                  {article.excerpt && (
                    <p
                      className="mb-6"
                      style={{
                        fontFamily: "Georgia, serif",
                        fontSize: 20,
                        lineHeight: 1.55,
                        color: "hsl(0 0% 20%)",
                        fontStyle: "italic",
                        borderLeft: "3px solid hsl(52 97% 56%)",
                        paddingLeft: 20,
                      }}
                      data-testid="article-excerpt"
                    >
                      {article.excerpt}
                    </p>
                  )}
                  <RichContent
                    content={article.content}
                    className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:text-foreground prose-p:leading-relaxed prose-p:font-serif prose-a:text-secondary prose-a:no-underline hover:prose-a:underline"
                  />
                </div>
              ) : article.contentType === "gallery" ? (
                // Paparazzi-style gallery: scrape every <img> out of
                // the body HTML and render them on a dark grid. Used
                // only when the editor hasn't picked an explicit
                // galleryLayout above.
                <PaparazziGallery content={article.content} />
              ) : (
                <RichContent
                  content={article.content}
                  className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:text-foreground prose-p:leading-relaxed prose-p:font-serif prose-a:text-secondary prose-a:no-underline hover:prose-a:underline"
                />
              )}
            </div>
          </div>
        )}

        {/* Full-width gallery below the body — only when the editor
            picked galleryLayout='full-width-masonry' AND the article has
            galleryImages. Negative-margin trick escapes the article
            container's max-width + horizontal padding, so the masonry
            runs edge-to-edge even though its parent is a 760px column.
            Rendered OUTSIDE the body div so it sits visually under all
            the text, not interleaved with it. */}
        {isFullWidthGallery && (
          <div
            className="mt-10"
            style={{ marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}
          >
            <PhotoshootMasonry
              images={article.galleryImages as any}
              altPrefix={article.title}
            />
          </div>
        )}

        {/* Cartoon prev/next navigation */}
        {article.contentType === "cartoon" && (
          <nav className="mt-10 flex items-stretch justify-between gap-4 border-t border-b border-border py-6" data-testid="cartoon-navigation">
            {adjacentData?.prev ? (
              <Link href={`/article/${adjacentData.prev.slug}`}>
                <span
                  className="flex items-center gap-3 group cursor-pointer"
                  data-testid="button-prev-cartoon"
                >
                  <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-border group-hover:bg-foreground group-hover:text-white group-hover:border-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                  </span>
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
                    <span className="block" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Previous</span>
                    <span className="block group-hover:text-foreground transition-colors line-clamp-2" style={{ color: "hsl(0 0% 20%)" }}>{adjacentData.prev.title}</span>
                  </span>
                </span>
              </Link>
            ) : <span />}

            {adjacentData?.next ? (
              <Link href={`/article/${adjacentData.next.slug}`}>
                <span
                  className="flex items-center gap-3 group cursor-pointer text-right"
                  data-testid="button-next-cartoon"
                >
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
                    <span className="block" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Next</span>
                    <span className="block group-hover:text-foreground transition-colors line-clamp-2" style={{ color: "hsl(0 0% 20%)" }}>{adjacentData.next.title}</span>
                  </span>
                  <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-border group-hover:bg-foreground group-hover:text-white group-hover:border-foreground transition-colors">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </span>
              </Link>
            ) : <span />}
          </nav>
        )}

        {/* Photoshoot rendering, full-bleed via the negative-margin trick
            (escape the article container's max-width + padding so the
            black band runs to the viewport edge).

            Two flavours:
             - Explicit contentType=photoshoot → curated galleryImages
               rendered as a 3-across PhotoshootGrid on black.
             - Legacy fashion-shoots fallback → PhotoshootSlider extracts
               images from the body HTML. Kept for un-migrated rows. */}
        {isExplicitPhotoshoot &&
          Array.isArray(article.galleryImages) &&
          article.galleryImages.length > 0 && (
            <div
              className="my-8"
              style={{ marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}
            >
              {/* Layout toggle for the photoshoot gallery. Sits above
                  the grid, right-aligned inside the editorial reading
                  column so it doesn't float out into the full-bleed
                  black area below. The grid itself still escapes to
                  the viewport edges via the parent's negative margin. */}
              <div className="max-w-[1296px] mx-auto px-6 flex justify-end mb-3">
                <PhotoshootLayoutToggle
                  layout={photoshootLayout}
                  setLayout={setPhotoshootLayout}
                />
              </div>
              {photoshootLayout === "masonry" ? (
                <PhotoshootMasonry
                  images={article.galleryImages}
                  altPrefix={article.title}
                />
              ) : (
                <PhotoshootGrid
                  images={article.galleryImages}
                  altPrefix={article.title}
                />
              )}
            </div>
          )}
        {isLegacyPhotoshoot && (
          <div
            className="my-8"
            style={{ marginLeft: "calc(50% - 50vw)", marginRight: "calc(50% - 50vw)" }}
          >
            <PhotoshootSlider
              hero={article.featuredImage}
              content={article.content}
              altPrefix={article.title}
            />
          </div>
        )}

        {/* Optional body copy for explicit photoshoots — renders below the
            grid in the standard narrow reading column so the editor can
            credit the team, set the scene, or include a short standfirst
            of prose. Skipped if the body is empty/whitespace. */}
        {isExplicitPhotoshoot && article.content && article.content.replace(/<[^>]+>/g, "").trim().length > 0 && (
          <div className="max-w-[760px] mx-auto mt-10">
            <RichContent
              content={article.content}
              className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:text-foreground prose-p:leading-relaxed prose-p:font-serif prose-a:text-secondary prose-a:no-underline hover:prose-a:underline"
            />
          </div>
        )}

        {/* Related articles — scored server-side on shared category +
            tag overlap. Renders nothing when the endpoint finds no
            candidates, so brand-new / untagged articles don't grow an
            empty band. */}
        <RelatedArticles slug={article.slug} />

        {/* Author bio footer */}
        <footer className="mt-12 pt-8 border-t border-border">
          <div className="flex items-start gap-4">
            {article.author.avatar && (
              <img
                src={article.author.avatar}
                alt={article.author.name}
                className="w-12 h-12 object-cover"
                data-testid="author-avatar"
              />
            )}
            <div>
              <div
                className="mb-1"
                style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(0 0% 43%)" }}
              >
                About the author
              </div>
              <h3
                style={{ fontFamily: "Georgia, serif", fontSize: 17, fontWeight: 400, color: "hsl(0 0% 4%)" }}
                data-testid="author-name-footer"
              >
                {article.author.slug ? (
                  <Link href={`/author/${article.author.slug}`}>
                    <a className="hover:underline">{article.author.name}</a>
                  </Link>
                ) : (
                  article.author.name
                )}
              </h3>
              {article.author.bio && (
                <p
                  className="mt-1"
                  style={{ fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.6, color: "hsl(0 0% 43%)" }}
                  data-testid="author-bio"
                >
                  {article.author.bio}
                </p>
              )}
            </div>
          </div>
        </footer>
      </article>

      <Footer />
    </div>
  );
}

// Segmented control to switch between single-column (classic editorial)
// and two-column (image-on-left, copy-on-right) reading layouts. Hidden
// on mobile where two-col would never have enough room.
function LayoutToggle({
  layout,
  setLayout,
}: {
  layout: "one-col" | "two-col";
  setLayout: (l: "one-col" | "two-col") => void;
}) {
  // Compact icon-only switch — keeps the article header uncluttered.
  // Tooltips carry the labels for accessibility.
  const baseBtn =
    "inline-flex items-center justify-center w-7 h-7 transition-colors";
  return (
    <div
      className="hidden lg:inline-flex items-center border border-border ml-auto"
      role="radiogroup"
      aria-label="Article layout"
    >
      <button
        type="button"
        className={`${baseBtn} ${layout === "one-col" ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setLayout("one-col")}
        aria-pressed={layout === "one-col"}
        aria-label="Single column"
        title="Single column"
        data-testid="layout-one-col"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={`${baseBtn} ${layout === "two-col" ? "bg-foreground text-white" : "text-muted-foreground hover:text-foreground"}`}
        onClick={() => setLayout("two-col")}
        aria-pressed={layout === "two-col"}
        aria-label="Two columns — image left, copy right"
        title="Image left, copy right"
        data-testid="layout-two-col"
      >
        <Columns className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// Photoshoot-gallery layout toggle. Sibling to LayoutToggle above but
// controls the gallery grid (PhotoshootGrid vs PhotoshootMasonry), not
// the reading-column layout. Icon-only on mobile to save header space,
// with a labelled variant on sm+ because the two options are visually
// subtle enough that an uppercase word-tag helps readers understand
// what the toggle does on first encounter.
function PhotoshootLayoutToggle({
  layout,
  setLayout,
}: {
  layout: "grid" | "masonry";
  setLayout: (l: "grid" | "masonry") => void;
}) {
  const btn = (active: boolean) =>
    `inline-flex items-center gap-1.5 py-1.5 px-3 transition-colors ${
      active
        ? "bg-foreground text-white"
        : "text-muted-foreground hover:text-foreground"
    }`;
  return (
    <div
      className="inline-flex items-center border border-border"
      role="radiogroup"
      aria-label="Photoshoot layout"
      data-testid="photoshoot-layout-toggle"
    >
      <button
        type="button"
        role="radio"
        aria-checked={layout === "grid"}
        onClick={() => setLayout("grid")}
        className={btn(layout === "grid")}
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
        title="Grid — uniform square crops, 3-across"
        data-testid="photoshoot-layout-grid"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Grid</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={layout === "masonry"}
        onClick={() => setLayout("masonry")}
        className={`${btn(layout === "masonry")} border-l border-border`}
        style={{
          fontFamily: "Arial, sans-serif",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
        title="Masonry — natural aspect ratios, good for mixed portrait + landscape"
        data-testid="photoshoot-layout-masonry"
      >
        <Rows3 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Masonry</span>
      </button>
    </div>
  );
}
