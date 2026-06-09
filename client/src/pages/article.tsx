import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, ArrowLeft, ArrowRight, Edit } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Link } from "wouter";
import ArticleGallery from "@/components/ArticleGallery";
import RichContent from "@/components/RichContent";
import PaparazziGallery from "@/components/PaparazziGallery";
import PhotoshootSlider from "@/components/PhotoshootSlider";
import GalleryCarousel from "@/components/GalleryCarousel";
import GalleryGrid from "@/components/GalleryGrid";
import { useAdmin } from "@/contexts/AdminContext";

export default function Article() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const { isAdmin } = useAdmin();

  const { data, isLoading, error } = useQuery({
    queryKey: [`/api/articles/by-slug/${slug}`],
  });

  const article = data?.article;
  const isPhotoshoot = article?.category?.slug === "fashion-shoots";

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

      {/* Article */}
      <article className="max-w-[760px] mx-auto px-6 py-10">

        {/* Back + Edit */}
        <div className="flex justify-between items-center mb-8">
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
          {isAdmin && article && (
            <button
              onClick={() => {
                localStorage.setItem("editArticleId", article.id);
                navigate("/admin?tab=articles&edit=true");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-white hover:bg-secondary hover:text-foreground transition-colors"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
              data-testid="button-edit-article"
            >
              <Edit className="h-3.5 w-3.5" /> Edit
            </button>
          )}
        </div>

        {/* Header */}
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

          {/* Title */}
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

          {/* Excerpt / standfirst */}
          {article.excerpt && (
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
            <span>—</span>
            <span data-testid="article-date">
              {format(new Date(article.publishedAt || article.createdAt), "d MMMM yyyy")}
            </span>
            {article.contentType !== "gallery" && !isPhotoshoot && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span data-testid="article-read-time">{article.readTime} min read</span>
              </span>
            )}
          </div>
        </header>

        {/* Body content — non-photoshoot. Photoshoots render outside this
            container so the slider can be full-page width (see below). */}
        {!isPhotoshoot && (
          <>
            {/* Lead image */}
            {article.featuredImage && article.contentType !== "gallery" && (
              <figure className="mb-8 -mx-6 sm:mx-0">
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  className="w-full h-auto block"
                  loading="eager"
                  data-testid="article-featured-image"
                />
              </figure>
            )}

            {/* Curated image gallery (admin-curated, in article.galleryImages).
                For paparazzi-style spreads — gallery-typed articles or any
                gallery with 12+ images — render a tiled grid that opens a
                lightbox on click. Smaller editorial galleries get the
                carousel treatment. */}
            {Array.isArray(article.galleryImages) && article.galleryImages.length > 0 && (() => {
              const imgs = article.galleryImages;
              const useGrid =
                article.contentType === "gallery" ||
                article.category?.slug === "paparazzi" ||
                imgs.length >= 12;
              return (
                <div className="mb-10 -mx-6 sm:mx-0">
                  {useGrid ? (
                    <GalleryGrid
                      images={imgs}
                      altPrefix={article.title}
                      largeCols={imgs.length >= 30 ? 5 : 4}
                    />
                  ) : (
                    <GalleryCarousel images={imgs} altPrefix={article.title} />
                  )}
                </div>
              );
            })()}

            {article.contentType === "gallery" ? (
              <PaparazziGallery content={article.content} />
            ) : (
              <RichContent
                content={article.content}
                className="prose prose-lg max-w-none prose-headings:font-serif prose-headings:font-normal prose-p:text-foreground prose-p:leading-relaxed prose-p:font-serif prose-a:text-secondary prose-a:no-underline hover:prose-a:underline"
              />
            )}
          </>
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

        {/* Photoshoot slider rendered full-bleed by breaking out of the
            760px article container with negative-margin trick. */}
        {isPhotoshoot && (
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
