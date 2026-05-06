import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Download, BookOpen } from "lucide-react";
import { Link } from "wouter";

type Issue = {
  id: string;
  number: number;
  title: string | null;
  pdfUrl: string | null;
  coverImage: string | null;
  coverImageAlt: string | null;
  publishedAt: string | null;
  displayLabel: string | null;
};

function CoverCard({ issue }: { issue: Issue }) {
  // Rotate between primary and alt cover on each page load (stable per issue)
  const cover = issue.coverImageAlt && issue.number % 2 === Math.floor(Date.now() / 86400000) % 2
    ? issue.coverImageAlt
    : issue.coverImage!;
  return (
    <div className="group flex flex-col" data-testid={`issue-cover-${issue.number}`}>
      <div className="relative overflow-hidden shadow-md group-hover:shadow-xl transition-shadow duration-300"
        style={{ aspectRatio: "2/3" }}>
        <img
          src={cover}
          alt={`Gallery #${issue.number}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="lazy"
        />
        {/* Bottom gradient + number + PDF button */}
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 pt-8"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}>
          <div className="flex items-end justify-between">
            <div>
              {(issue.displayLabel || issue.publishedAt) && (
                <p style={{ fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em", textTransform: "uppercase", lineHeight: 1 }}>
                  {issue.displayLabel ?? format(new Date(issue.publishedAt!), "MMM yyyy")}
                </p>
              )}
              <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: "white", lineHeight: 1.1, marginTop: 1 }}>
                #{issue.number}
              </p>
            </div>
            {issue.pdfUrl && (
              <a href={issue.pdfUrl} download target="_blank" rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: "hsl(182 55% 56%)", fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, color: "hsl(0 0% 4%)", letterSpacing: "0.08em", textTransform: "uppercase" }}
                data-testid={`download-${issue.number}`}>
                <Download className="w-2.5 h-2.5" />
                PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderCard({ issue }: { issue: Issue }) {
  return (
    <div className="group flex items-center gap-3 py-2.5 border-b border-border hover:bg-white transition-colors"
      data-testid={`issue-list-${issue.number}`}>
      <div className="shrink-0 flex items-center justify-center bg-[hsl(0,0%,93%)] border border-border"
        style={{ width: 30, height: 44 }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontSize: 8, fontWeight: 700, color: "hsl(0 0% 65%)" }}>
          #{issue.number}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, color: "hsl(0 0% 10%)" }}>
          #{issue.number}
        </p>
        {(issue.displayLabel || issue.publishedAt) && (
          <p style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 55%)" }}>
            {issue.displayLabel ?? format(new Date(issue.publishedAt!), "MMMM yyyy")}
          </p>
        )}
      </div>
      {issue.pdfUrl ? (
        <a href={issue.pdfUrl} download target="_blank" rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 hover:text-secondary transition-colors"
          style={{ fontFamily: "Arial, sans-serif", fontSize: 10, color: "hsl(182 55% 56%)", fontWeight: 700 }}
          data-testid={`download-list-${issue.number}`}>
          <Download className="w-3 h-3" />PDF
        </a>
      ) : (
        <span style={{ fontFamily: "Arial, sans-serif", fontSize: 10, color: "hsl(0 0% 75%)" }}>—</span>
      )}
    </div>
  );
}

function getYear(issue: Issue): number {
  if (issue.publishedAt) return new Date(issue.publishedAt).getFullYear();
  return 0;
}

export default function Archive() {
  const { data, isLoading } = useQuery<{ issues: Issue[] }>({
    queryKey: ["/api/issues"],
  });

  const now = new Date();
  const allIssues = (data?.issues || [])
    .filter(i => i.coverImage || !i.publishedAt || new Date(i.publishedAt) <= now)
    .sort((a, b) => b.number - a.number);
  const withCovers = allIssues.filter(i => i.coverImage);
  const withoutCovers = allIssues.filter(i => !i.coverImage);

  // Group cover issues by year (descending)
  const byYear = new Map<number, Issue[]>();
  for (const issue of withCovers) {
    const yr = getYear(issue);
    if (!byYear.has(yr)) byYear.set(yr, []);
    byYear.get(yr)!.push(issue);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  const totalIssues = allIssues.length;
  const coverCount = withCovers.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Page header */}
      <section className="bg-white border-b border-border py-10">
        <div className="max-w-[1296px] mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "hsl(182 55% 56%)" }}>
            <BookOpen className="w-4 h-4" />
            Back Issues
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 400, letterSpacing: "-0.5px", color: "hsl(0 0% 4%)" }}>
            The Archive
          </h1>
          <p className="mt-2" style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: "hsl(0 0% 43%)", lineHeight: 1.6 }}>
            Every issue of Gallery Magazine — Jersey life &amp; style since 2004.
          </p>
          {!isLoading && (
            <p className="mt-3" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 60%)", letterSpacing: "0.06em" }}>
              {totalIssues} issues · {coverCount} covers
              {allIssues.filter(i => i.pdfUrl).length > 0 && ` · ${allIssues.filter(i => i.pdfUrl).length} PDFs available`}
            </p>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="max-w-[1296px] mx-auto px-6 py-16">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="bg-border animate-pulse w-full" style={{ aspectRatio: "2/3" }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-[1296px] mx-auto px-6 py-12 space-y-14">

          {/* Issues with covers — grouped by year */}
          {years.map(year => (
            <section key={year}>
              <div className="flex items-center gap-4 mb-6">
                <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(0 0% 25%)" }}>
                  {year === 0 ? "Earlier Issues" : year}
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 60%)" }}>
                  {byYear.get(year)!.length} {byYear.get(year)!.length === 1 ? "issue" : "issues"}
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 md:gap-4">
                {byYear.get(year)!.map(issue => (
                  <CoverCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          ))}

          {/* Issues without covers */}
          {withoutCovers.length > 0 && (
            <section>
              <div className="flex items-center gap-4 mb-6">
                <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
                  Earlier Issues
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 60%)" }}>
                  {withoutCovers.length} issues
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12">
                {withoutCovers.map(issue => (
                  <PlaceholderCard key={issue.id} issue={issue} />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      <Footer />
    </div>
  );
}
