import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Sidebar from "@/components/Sidebar";
import LazyImage from "@/components/LazyImage";
import { Link } from "wouter";
import { BookOpen, Download, ChevronDown } from "lucide-react";

function stripHtml(html: string): string {
  return html
    .replace(/&hellip;/g, "…").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'").replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, "\u201C").replace(/&#8221;/g, "\u201D")
    .replace(/\[&hellip;\]/g, "…").replace(/<[^>]*>/g, "").replace(/\[…\]/g, "…").trim();
}

function ArticleCard({ article }: { article: any }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <article className="article-card group cursor-pointer flex flex-col gap-3" data-testid={`article-card-${article.slug}`}>
        {article.featuredImage && (
          <div className="overflow-hidden w-full" style={{ aspectRatio: "3/2" }}>
            <LazyImage src={article.featuredImage} alt={article.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
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

function readIssueFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const n = new URLSearchParams(window.location.search).get("issue");
  return n && /^\d+$/.test(n) ? parseInt(n, 10) : null;
}

export default function CurrentIssue() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedIssueNum, setSelectedIssueNum] = useState<number | null>(readIssueFromUrl);

  // Keep state in sync with browser back/forward navigation.
  useEffect(() => {
    const onPopState = () => setSelectedIssueNum(readIssueFromUrl());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Write the issue choice to the URL so back-nav remembers it and the page is shareable.
  const setIssueWithUrl = (n: number | null) => {
    setSelectedIssueNum(n);
    setSelectedCategory("all");
    const url = n ? `/current-issue?issue=${n}` : `/current-issue`;
    window.history.pushState({ issue: n }, "", url);
  };

  // All issues for the dropdown
  const { data: issuesData } = useQuery<{ issues: any[] }>({
    queryKey: ["/api/issues"],
  });
  const allIssues = useMemo(() =>
    (issuesData?.issues || []).filter(i => i.publishedAt && new Date(i.publishedAt) <= new Date())
      .sort((a, b) => b.number - a.number),
    [issuesData]
  );

  // Pick the default (latest) issue on first load
  const targetIssueNum = selectedIssueNum ?? allIssues[0]?.number ?? null;
  const selectedIssueData = allIssues.find(i => i.number === targetIssueNum) ?? allIssues[0];

  const { data, isLoading } = useQuery<{ articles: any[]; edito: any; issueNumber: number | null }>({
    queryKey: ["/api/articles/current-issue", targetIssueNum],
    queryFn: () => {
      const url = targetIssueNum
        ? `/api/articles/current-issue?issue=${targetIssueNum}&limit=200`
        : `/api/articles/current-issue?limit=200`;
      return fetch(url).then(r => r.json());
    },
  });

  const { data: categoriesData } = useQuery<{ categories: any[] }>({
    queryKey: ["/api/categories"],
  });

  const allArticles = data?.articles || [];
  const edito = data?.edito || null;
  const issueNumber = data?.issueNumber ?? targetIssueNum;

  // Cover: prefer the issues table cover, fall back to edito featured image
  const coverImage = selectedIssueData?.coverImage || edito?.featuredImage || null;
  const pdfUrl = selectedIssueData?.pdfUrl || null;
  const displayLabel = selectedIssueData?.displayLabel || null;
  const publishedAt = selectedIssueData?.publishedAt || edito?.publishedAt || null;

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

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* ── Full-width editorial hero ─────────────────────────────── */}
      <section className="w-full bg-white border-b border-border">
        <div className="flex flex-col md:flex-row gap-10 items-start px-6 lg:px-10 xl:px-16 py-10">

          {/* Cover image — original size */}
          <div className="shrink-0" style={{ width: 200 }}>
            {coverImage ? (
              <img src={coverImage} alt={`Gallery #${issueNumber}`}
                className="w-full h-auto shadow-md" />
            ) : (
              <div className="w-full flex items-center justify-center bg-[hsl(0,0%,94%)] border border-border" style={{ aspectRatio: "2/3" }}>
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex-1 flex flex-col justify-center">

            {/* Label */}
            <div className="flex items-center gap-2 mb-4"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}>
              <BookOpen className="w-3.5 h-3.5" />
              Current Issue
            </div>

            {/* Issue selector row */}
            <div className="flex flex-wrap items-baseline gap-4 mb-2">
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)", lineHeight: 1.15 }}>
                Gallery Magazine
              </h1>

              {/* Dropdown */}
              <div className="relative">
                <select
                  value={targetIssueNum ?? ""}
                  onChange={e => setIssueWithUrl(Number(e.target.value))}
                  className="appearance-none pl-3 pr-8 py-1.5 border border-border bg-white cursor-pointer hover:border-foreground transition-colors"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(0 0% 15%)" }}
                  data-testid="issue-selector"
                >
                  {allIssues.map(issue => (
                    <option key={issue.number} value={issue.number}>
                      #{issue.number} — {issue.displayLabel ?? (issue.publishedAt ? format(new Date(issue.publishedAt), "MMM yyyy") : "")}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-muted-foreground" />
              </div>
            </div>

            {/* Date */}
            {(displayLabel || publishedAt) && (
              <p className="mb-5" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
                {displayLabel ?? (publishedAt ? format(new Date(publishedAt), "MMMM yyyy") : "")}
              </p>
            )}

            {/* Edito excerpt */}
            {edito?.excerpt && (
              <p className="mb-6" style={{ fontFamily: "Georgia, serif", fontSize: 17, fontStyle: "italic", color: "hsl(0 0% 35%)", lineHeight: 1.65 }}>
                {stripHtml(edito.excerpt)}
              </p>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-4">
              {pdfUrl && (
                <a href={pdfUrl} download target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 transition-colors"
                  style={{ background: "hsl(0 0% 4%)", fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "white" }}
                  data-testid="download-pdf">
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </a>
              )}
              {edito && (
                <Link href={`/article/${edito.slug}`}>
                  <span className="inline-flex items-center gap-1.5 hover:text-secondary transition-colors cursor-pointer"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}>
                    Read the editor's letter →
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Category filter tabs ──────────────────────────────────── */}
      {issueCats.length > 1 && (
        <section className="bg-white border-b border-border">
          <div className="max-w-[1296px] mx-auto px-6">
            <div className="flex items-center gap-0 overflow-x-auto" style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <button onClick={() => setSelectedCategory("all")}
                className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap ${
                  selectedCategory === "all" ? "border-secondary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`} data-testid="filter-all">
                All ({allArticles.length})
              </button>
              {issueCats.map(cat => (
                <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 py-4 px-4 border-b-[3px] transition-colors whitespace-nowrap ${
                    selectedCategory === cat.id ? "border-secondary text-foreground font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`} data-testid={`filter-${cat.slug}`}>
                  {cat.name} ({categoryCounts[cat.id]})
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Articles grid ─────────────────────────────────────────── */}
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
                    No articles found for this issue.
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
