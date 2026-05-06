import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { TrendingUp, Pencil } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

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
  const { toast } = useToast();

  const { data: trendingData } = useQuery({ queryKey: ["/api/articles/trending"] });
  const { data: categoriesData } = useQuery({ queryKey: ["/api/categories"] });

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

  const handleNewsletterSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    toast({ title: "Subscribed!", description: "Thanks — we'll be in touch." });
    setEmail("");
  };

  const trendingArticles = trendingData?.articles || [];
  const categories = (categoriesData?.categories || []).filter((c: any) => !c.parentId).slice(0, 7);
  const cartoonArticles = cartoonsData?.articles || [];

  return (
    <aside className="space-y-10">

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
                      <span data-testid={`trending-read-time-${index}`}>{article.readTime} min</span>
                      <span className="mx-1.5">·</span>
                      <span data-testid={`trending-views-${index}`}>{article.views.toLocaleString()} views</span>
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
          Get the latest stories from Gallery delivered to your inbox.
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

      {/* Cartoons */}
      {cartoonArticles.length > 0 && (
        <SidebarSection title="Cartoons">
          <div className="space-y-5" data-testid="cartoon-articles">
            {cartoonArticles.map((article: any, index: number) => (
              <Link key={article.id} href={`/article/${article.slug}`}>
                <div
                  className="group cursor-pointer"
                  data-testid={`cartoon-article-${index}`}
                >
                  {article.featuredImage ? (
                    <div className="mb-3 overflow-hidden">
                      <img
                        src={article.featuredImage}
                        alt={article.title}
                        className="w-full h-auto block group-hover:opacity-90 transition-opacity duration-300"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div
                      className="mb-3 flex items-center justify-center bg-[hsl(0,0%,94%)]"
                      style={{ aspectRatio: "4/3" }}
                    >
                      <Pencil className="w-6 h-6 text-border" />
                    </div>
                  )}
                  <h4
                    className="group-hover:text-secondary transition-colors line-clamp-2"
                    style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 15,
                      fontWeight: 400,
                      lineHeight: 1.4,
                      color: "hsl(0 0% 4%)",
                      margin: 0,
                    }}
                    data-testid={`cartoon-title-${index}`}
                  >
                    {article.title}
                  </h4>
                </div>
              </Link>
            ))}
            <Link href="/category/ntjp">
              <span
                className="inline-block hover:text-secondary transition-colors"
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

    </aside>
  );
}
