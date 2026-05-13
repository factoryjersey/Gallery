import { useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ArticleWithDetails } from "@shared/schema";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";

type Author = {
  id: string;
  name: string;
  slug: string | null;
  bio: string | null;
  photoUrl: string | null;
  avatar: string | null;
  defaultRole: string | null;
};

type ArticlesResponse = {
  articles: ArticleWithDetails[];
  pagination?: { total: number; page: number; limit: number; totalPages: number };
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function writesAbout(cats: string[]): string {
  const clean = cats.filter(Boolean);
  if (clean.length === 0) return "";
  const top = clean.slice(0, 3);
  if (top.length === 1) return `Writes about ${top[0].toLowerCase()}.`;
  if (top.length === 2) return `Writes about ${top[0].toLowerCase()} and ${top[1].toLowerCase()}.`;
  return `Writes about ${top[0].toLowerCase()}, ${top[1].toLowerCase()} and ${top[2].toLowerCase()}.`;
}

export default function AuthorPage() {
  const { slug } = useParams();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: authorData, isLoading: authorLoading } = useQuery<{ author: Author }>({
    queryKey: [`/api/authors/by-slug/${slug}`],
    enabled: !!slug,
  });

  const queryParams = new URLSearchParams({
    ...(authorData?.author?.id && { authorId: authorData.author.id }),
    page: currentPage.toString(),
    limit: "16",
  });

  const { data: articlesData, isLoading: articlesLoading } = useQuery<ArticlesResponse>({
    queryKey: [`/api/articles?${queryParams.toString()}`],
    enabled: !!authorData?.author?.id,
  });

  // Derive a "Writes about…" line from the categories of the author's
  // articles, when no manual bio is set.
  const fallbackTagline = useMemo(() => {
    const list = articlesData?.articles ?? [];
    const seen = new Map<string, number>();
    for (const a of list) {
      const name = (a as ArticleWithDetails & { category?: { name?: string } | null }).category?.name;
      if (!name) continue;
      seen.set(name, (seen.get(name) ?? 0) + 1);
    }
    const ordered = Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([n]) => n);
    return writesAbout(ordered);
  }, [articlesData]);

  if (!authorLoading && !authorData?.author) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-[1296px] mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl mb-4" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
            Author not found
          </h1>
          <Link href="/authors">
            <span className="inline-flex items-center gap-2 text-secondary hover:underline cursor-pointer"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}>
              <ArrowLeft className="h-4 w-4" /> Back to authors
            </span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const author = authorData?.author;
  const photo = author?.photoUrl || author?.avatar;
  const tagline = author?.bio?.trim() || fallbackTagline;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Author masthead */}
      <section className="bg-white border-b border-border py-10">
        <div className="max-w-[1296px] mx-auto px-6">
          <Link href="/authors">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-6 block"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}
              data-testid="back-button">
              <ArrowLeft className="h-3.5 w-3.5" /> All authors
            </span>
          </Link>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {photo ? (
              <img
                src={photo}
                alt={author?.name}
                className="h-28 w-28 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="h-28 w-28 rounded-full flex items-center justify-center bg-muted shrink-0"
                style={{ fontFamily: "Georgia, serif", fontSize: 32, color: "#555" }}
                aria-hidden
              >
                {author ? initials(author.name) : ""}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h1
                style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)" }}
                data-testid="author-title"
              >
                {author?.name}
              </h1>
              {author?.defaultRole && (
                <div
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}
                >
                  {author.defaultRole}
                </div>
              )}
              {tagline && (
                <p
                  className="max-w-2xl"
                  style={{ fontFamily: "Georgia, serif", fontSize: 17, lineHeight: 1.65, color: "hsl(0 0% 30%)", margin: "14px 0 0" }}
                  data-testid="author-bio"
                >
                  {tagline}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="py-10 bg-background">
        <div className="max-w-[1296px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2">
              <p
                className="mb-6"
                style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 43%)" }}
              >
                {articlesData?.pagination?.total ?? 0} {(articlesData?.pagination?.total ?? 0) === 1 ? "article" : "articles"}
              </p>
              <ArticleGrid
                articles={articlesData?.articles || []}
                isLoading={authorLoading || articlesLoading}
                pagination={articlesData?.pagination}
                onPageChange={setCurrentPage}
              />
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
