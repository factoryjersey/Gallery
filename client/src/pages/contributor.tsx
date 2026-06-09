import { useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ArticleWithDetails } from "@shared/schema";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ArticleGrid from "@/components/ArticleGrid";
import Sidebar from "@/components/Sidebar";

type Contributor = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  photoUrl: string | null;
  defaultRole: string | null;
};

type Response = {
  contributor: Contributor;
  articles: Array<ArticleWithDetails & { roles: string[] }>;
};

const ROLE_LABELS: Record<string, string> = {
  photographer: "Photography",
  illustrator: "Illustration",
  stylist: "Styling",
  hair: "Hair",
  makeup: "Makeup",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default function ContributorPage() {
  const { slug } = useParams();

  const { data, isLoading } = useQuery<Response>({
    queryKey: [`/api/contributors/by-slug/${slug}`],
    enabled: !!slug,
  });

  // Tally up the roles this person has been credited in across their work,
  // so the masthead can read "Photographer · Illustrator" automatically.
  const roleSummary = useMemo(() => {
    const tally = new Map<string, number>();
    for (const a of data?.articles ?? []) {
      for (const r of a.roles) tally.set(r, (tally.get(r) ?? 0) + 1);
    }
    return Array.from(tally.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([role]) => ROLE_LABELS[role] || role[0].toUpperCase() + role.slice(1));
  }, [data]);

  if (!isLoading && !data?.contributor) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="max-w-[1296px] mx-auto px-6 py-16 text-center">
          <h1 className="text-2xl mb-4" style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>
            Contributor not found
          </h1>
          <Link href="/">
            <span
              className="inline-flex items-center gap-2 text-secondary hover:underline cursor-pointer"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}
            >
              <ArrowLeft className="h-4 w-4" /> Back to the site
            </span>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const c = data?.contributor;
  const photo = c?.photoUrl;
  const tagline = c?.bio?.trim() || (roleSummary.length > 0
    ? `${roleSummary.join(" · ")} contributor to Gallery.`
    : "");

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Masthead */}
      <section className="bg-white border-b border-border py-10">
        <div className="max-w-[1296px] mx-auto px-6">
          <Link href="/">
            <span
              className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-6"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}
              data-testid="back-button"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </span>
          </Link>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {photo ? (
              <img
                src={photo}
                alt={c?.name}
                className="h-28 w-28 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="h-28 w-28 rounded-full flex items-center justify-center bg-muted shrink-0"
                style={{ fontFamily: "Georgia, serif", fontSize: 32, color: "#555" }}
                aria-hidden
              >
                {c ? initials(c.name) : ""}
              </div>
            )}
            <div className="text-center sm:text-left">
              <h1
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 42,
                  fontWeight: 400,
                  letterSpacing: "-0.5px",
                  color: "hsl(0 0% 4%)",
                }}
                data-testid="contributor-title"
              >
                {c?.name}
              </h1>
              {roleSummary.length > 0 && (
                <div
                  style={{
                    fontFamily: "Arial, sans-serif",
                    fontSize: 11,
                    color: "#888",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginTop: 4,
                  }}
                  data-testid="contributor-roles"
                >
                  {roleSummary.join(" · ")}
                </div>
              )}
              {tagline && (
                <p
                  className="max-w-2xl"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 17,
                    lineHeight: 1.65,
                    color: "hsl(0 0% 30%)",
                    margin: "14px 0 0",
                  }}
                  data-testid="contributor-bio"
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
                {(data?.articles?.length ?? 0)} {(data?.articles?.length ?? 0) === 1 ? "article" : "articles"}
              </p>
              <ArticleGrid
                articles={data?.articles || []}
                isLoading={isLoading}
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
