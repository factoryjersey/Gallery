import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { TrendingUp, Pencil, X, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface IssueSummary {
  id: string;
  number: number;
  title: string | null;
  pdfUrl: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  publishedAt: string | null;
  displayLabel: string | null;
}

function SidebarSection({ title, teal = false, children }: { title: string; teal?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-5">
        <span className={`gallery-section-label${teal ? " gallery-section-label--teal" : ""}`}>{title}</span>
      </div>
      {children}
    </div>
  );
}

export default function Sidebar() {
  const [email, setEmail] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: trendingData } = useQuery({ queryKey: ["/api/articles/trending"] });
  const { data: categoriesData } = useQuery({ queryKey: ["/api/categories"] });
  const { data: issuesData } = useQuery<{ issues: IssueSummary[] }>({
    queryKey: ["/api/issues"],
  });
  // Pick the highest-numbered issue whose published_at has actually
  // passed. Mirrors the server's latestPublishedIssueNumber() helper —
  // a future-dated issue row (or one without cover artwork yet) shouldn't
  // surface in the sidebar.
  const currentIssue = useMemo<IssueSummary | null>(() => {
    const list = issuesData?.issues ?? [];
    const now = Date.now();
    return (
      list
        .filter(
          (i) =>
            i.publishedAt &&
            new Date(i.publishedAt).getTime() <= now &&
            i.coverImage,
        )
        .sort((a, b) => b.number - a.number)[0] ?? null
    );
  }, [issuesData]);

  const cartoonParams = new URLSearchParams({
    contentType: "cartoon",
    status: "published",
    limit: "6",
    orderBy: "publishedAt",
    orderDir: "desc",
  }).toString();

  const { data: cartoonsData } = useQuery({
    queryKey: [`/api/articles?${cartoonParams}`],
  });

  const [submitting, setSubmitting] = useState(false);
  const handleNewsletterSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "sidebar" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Subscribe failed");
      }
      toast({ title: "Subscribed!", description: "Thanks — we'll be in touch." });
      setEmail("");
    } catch (err: any) {
      toast({ title: "Hmm…", description: err.message || "Try again in a sec.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const trendingArticles = trendingData?.articles || [];
  const categories = (categoriesData?.categories || []).filter((c: any) => !c.parentId).slice(0, 7);
  const cartoonArticles = cartoonsData?.articles || [];

  return (
    <aside className="space-y-10">

      {/* Current Edition — cover artwork at the top so the sidebar leads
          with the physical magazine. Cover links through to the
          current-issue archive page; PDF (when present) downloads
          straight from R2. The whole block is suppressed if the latest
          published issue has no cover yet, so we never render a sad
          empty card. */}
      {currentIssue && (
        <SidebarSection title="Current Edition" teal>
          <div className="flex flex-col gap-3" data-testid="sidebar-current-edition">
            <Link href={`/current-issue?issue=${currentIssue.number}`}>
              <div
                className="block group cursor-pointer focus:outline-none focus:ring-2 focus:ring-secondary"
                title={`Gallery #${currentIssue.number}${
                  currentIssue.displayLabel ? ` — ${currentIssue.displayLabel}` : ""
                }`}
              >
                <div
                  className="relative overflow-hidden border border-border bg-[hsl(0,0%,94%)]"
                  style={{ aspectRatio: "2 / 3" }}
                >
                  <img
                    src={currentIssue.coverImage!}
                    alt={
                      currentIssue.coverImageAlt ||
                      `Gallery #${currentIssue.number} cover`
                    }
                    width="320"
                    height="480"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.02]"
                    loading="lazy"
                    decoding="async"
                    data-testid="sidebar-current-cover"
                  />
                </div>
                <div
                  className="mt-2"
                  style={{
                    fontFamily: "Arial, sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "hsl(0 0% 35%)",
                  }}
                >
                  Gallery #{currentIssue.number}
                  {currentIssue.displayLabel && (
                    <span
                      className="ml-2"
                      style={{ fontWeight: 400, letterSpacing: "0.08em", color: "hsl(0 0% 50%)" }}
                    >
                      — {currentIssue.displayLabel}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            {currentIssue.pdfUrl && (
              <a
                href={currentIssue.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`gallery-${currentIssue.number}.pdf`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-white hover:bg-secondary hover:text-foreground transition-colors"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
                data-testid="sidebar-current-pdf"
              >
                <Download className="h-3.5 w-3.5" /> Download PDF
              </a>
            )}
          </div>
        </SidebarSection>
      )}

      {/* Trending Now */}
      <SidebarSection title="Trending Now" teal>
        <div data-testid="trending-articles">
          {trendingArticles.length > 0 ? (
            trendingArticles.map((article: any, index: number) => (
              <Link key={article.id} href={`/article/${article.slug}`}>
                <div
                  className="flex items-start gap-4 py-4 border-b border-border last:border-0 cursor-pointer group"
                  data-testid={`trending-article-${index}`}
                >
                  <span
                    className="font-bold min-w-[1.5rem] text-right shrink-0"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 22, color: "hsl(0 0% 85%)", lineHeight: 1 }}
                    data-testid={`trending-rank-${index}`}
                  >
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h4
                      className="group-hover:text-secondary transition-colors line-clamp-2 mb-1"
                      style={{ fontFamily: "Georgia, serif", fontSize: 15, fontWeight: 400, lineHeight: 1.4, color: "hsl(0 0% 4%)" }}
                      data-testid={`trending-title-${index}`}
                    >
                      {article.title}
                    </h4>
                    <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
                      <span data-testid={`trending-read-time-${index}`}>{article.readTime} min read</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="py-10 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-3 text-border" />
              <p style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 43%)" }}>
                No trending articles yet
              </p>
            </div>
          )}
        </div>
      </SidebarSection>

      {/* Newsletter */}
      <div className="bg-foreground text-white p-6">
        <div className="mb-1">
          <span
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              borderBottom: "3px solid hsl(52 97% 56%)",
              paddingBottom: 6,
              display: "inline-block",
            }}
            data-testid="newsletter-title"
          >
            Stay Informed
          </span>
        </div>
        <p className="text-sm mt-4 mb-4 opacity-80" style={{ fontFamily: "Georgia, serif", fontSize: 15, lineHeight: 1.5 }}>
          Get the latest stories from Gallery delivered to your inbox, now and again.
        </p>
        <form onSubmit={handleNewsletterSignup} className="space-y-3" data-testid="sidebar-newsletter-form">
          <Input
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-none bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-0 focus-visible:border-accent"
            required
            data-testid="sidebar-newsletter-email"
          />
          <button
            type="submit"
            className="w-full py-2.5 bg-accent text-foreground transition-opacity hover:opacity-90"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}
            data-testid="sidebar-newsletter-submit"
          >
            Subscribe Now
          </button>
        </form>
        <p className="text-xs mt-3 opacity-50" style={{ fontFamily: "Arial, sans-serif" }}>
          We respect your privacy. Unsubscribe anytime.
        </p>
      </div>

      {/* Popular Topics */}
      <SidebarSection title="Popular Topics">
        <div data-testid="popular-categories">
          {categories.length > 0 ? (
            categories.map((category: any) => (
              <Link key={category.id} href={`/category/${category.slug}`}>
                <div
                  className="flex items-center justify-between py-3 border-b border-border cursor-pointer group"
                  data-testid={`category-${category.slug}`}
                >
                  <span
                    className="group-hover:text-secondary transition-colors"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 4%)" }}
                  >
                    {category.name}
                  </span>
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(182 55% 56%)" }}>→</span>
                </div>
              </Link>
            ))
          ) : (
            <p style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 43%)" }}>
              No categories available
            </p>
          )}
        </div>
      </SidebarSection>

      {/* Cartoons — horizontal scroll strip */}
      {cartoonArticles.length > 0 && (
        <SidebarSection title="Cartoons">
          <div data-testid="cartoon-articles">
            {/* Full-width snap carousel */}
            <div
              className="flex overflow-x-auto"
              style={{
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                msOverflowStyle: "none",
                scrollbarWidth: "none",
              }}
            >
              {cartoonArticles.map((article: any, index: number) => (
                <div
                  key={article.id}
                  className="shrink-0"
                  style={{ flex: "0 0 100%", scrollSnapAlign: "start" }}
                  data-testid={`cartoon-article-${index}`}
                >
                  {article.featuredImage ? (
                    <img
                      src={article.featuredImage}
                      alt={article.title}
                      className="w-full h-auto block cursor-zoom-in hover:opacity-90 transition-opacity duration-200"
                      loading="lazy"
                      onClick={() => setLightboxImage(article.featuredImage)}
                    />
                  ) : (
                    <div
                      className="w-full flex items-center justify-center bg-[hsl(0,0%,94%)]"
                      style={{ height: 240 }}
                    >
                      <Pencil className="w-5 h-5 text-border" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Dot indicators */}
            {cartoonArticles.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {cartoonArticles.map((_: any, i: number) => (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      width: 5,
                      height: 5,
                      background: i === 0 ? "hsl(0 0% 4%)" : "hsl(0 0% 80%)",
                    }}
                  />
                ))}
              </div>
            )}

            <Link href="/category/ntjp">
              <span
                className="inline-block mt-3 hover:text-secondary transition-colors"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "hsl(182 55% 56%)",
                }}
                data-testid="cartoons-view-all"
              >
                View all cartoons →
              </span>
            </Link>
          </div>
        </SidebarSection>
      )}

      {/* Cartoon lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
          onClick={() => setLightboxImage(null)}
          data-testid="cartoon-lightbox"
        >
          <button
            className="absolute top-4 right-4 text-white hover:opacity-70 transition-opacity"
            onClick={() => setLightboxImage(null)}
            aria-label="Close"
            data-testid="lightbox-close"
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={lightboxImage}
            alt="Cartoon"
            className="max-w-[90vw] max-h-[90vh] object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </aside>
  );
}
