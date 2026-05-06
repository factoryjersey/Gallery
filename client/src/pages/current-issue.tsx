import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import LazyImage from "@/components/LazyImage";
import { Link } from "wouter";
import { BookOpen } from "lucide-react";

function ArticleCard({ article }: { article: any }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <article className="group cursor-pointer flex flex-col gap-3" data-testid={`article-card-${article.slug}`}>
        {article.featuredImage && (
          <div className="overflow-hidden w-full" style={{ aspectRatio: "3/2" }}>
            <LazyImage
              src={article.featuredImage}
              alt={article.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          </div>
        )}
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}>
          {article.category?.name}
        </div>
        <h3 className="group-hover:text-secondary transition-colors line-clamp-2"
          style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 400, lineHeight: 1.3, color: "hsl(0 0% 4%)", margin: 0 }}>
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="line-clamp-2" style={{ fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.55, color: "hsl(0 0% 43%)", margin: 0 }}>
            {article.excerpt}
          </p>
        )}
        <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}>
          <span>By {article.author?.name}</span>
          <span className="mx-2">—</span>
          <span>{format(new Date(article.publishedAt || article.createdAt), "d MMM yyyy")}</span>
        </div>
      </article>
    </Link>
  );
}

export default function CurrentIssue() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data, isLoading } = useQuery<{ articles: any[]; cutoff: string }>({
    queryKey: ["/api/articles/current-issue", { limit: 60 }],
    queryFn: () => fetch("/api/articles/current-issue?limit=60").then(r => r.json()),
  });

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const allArticles = data?.articles || [];
  const cutoff = data?.cutoff ? new Date(data.cutoff) : null;

  // Build category counts from the articles in this issue
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of allArticles) {
      const id = a.category?.id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [allArticles]);

  const issueCats = useMemo(() => {
    const cats = categoriesData?.categories?.filter(c => categoryCounts[c.id]) || [];
    return cats.sort((a, b) => (categoryCounts[b.id] || 0) - (categoryCounts[a.id] || 0));
  }, [categoriesData, categoryCounts]);

  const displayed = selectedCategory === "all"
    ? allArticles
    : allArticles.filter(a => a.category?.id === selectedCategory);

  const issueLabel = cutoff
    ? `${format(cutoff, "d MMM")} – ${format(new Date(), "d MMM yyyy")}`
    : "";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Masthead */}
      <section className="bg-white border-b border-border py-10">
        <div className="max-w-[1296px] mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}>
            <BookOpen className="w-4 h-4" />
            Current Issue
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)" }}>
            Gallery Magazine
          </h1>
          {issueLabel && (
            <p className="mt-1" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
              {issueLabel}
            </p>
          )}
          <p className="mt-2 max-w-lg mx-auto" style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: "hsl(0 0% 43%)", lineHeight: 1.6 }}>
            Jersey's lifestyle magazine — published every eight weeks
          </p>
        </div>
      </section>

      {/* Category filter tabs */}
      {issueCats.length > 1 && (
        <section className="bg-white border-b border-border">
          <div className="max-w-[1296px] mx-auto px-6">
            <div className="flex items-center gap-0 overflow-x-auto"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <button
                onClick={() => setSelectedCategory("all")}
                className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap ${
                  selectedCategory === "all" ? "border-secondary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({allArticles.length})
              </button>
              {issueCats.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id ? "border-secondary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.name} ({categoryCounts[cat.id]})
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Articles */}
      <section className="py-12 bg-background">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <div className="bg-border animate-pulse w-full" style={{ aspectRatio: "3/2" }} />
                      <div className="h-3 bg-border rounded w-16 animate-pulse" />
                      <div className="h-5 bg-border rounded w-3/4 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : displayed.length === 0 ? (
                <div className="py-20 text-center border border-border">
                  <BookOpen className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                  <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: "hsl(0 0% 43%)" }}>
                    No articles in the current issue yet.
                  </p>
                  <p className="mt-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 60%)" }}>
                    Articles published in the last 8 weeks will appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-10">
                  {displayed.map(article => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>
              )}
            </div>
            <div className="lg:col-span-1">
              <Sidebar />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
