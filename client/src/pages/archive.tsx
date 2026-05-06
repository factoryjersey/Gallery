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
  publishedAt: string | null;
};

function CoverIssue({ issue }: { issue: Issue }) {
  return (
    <div className="group flex flex-col" data-testid={`issue-cover-${issue.number}`}>
      {/* Magazine cover card */}
      <div className="relative overflow-hidden shadow-lg group-hover:shadow-xl transition-shadow duration-300"
        style={{ aspectRatio: "2/3" }}>
        <img
          src={issue.coverImage!}
          alt={`Gallery #${issue.number}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          loading="lazy"
        />

        {/* Subtle masthead bar at top */}
        <div className="absolute top-0 left-0 right-0 px-3 py-2"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}>
          <span style={{ fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: "0.22em", color: "white", textTransform: "uppercase", opacity: 0.9 }}>
            Gallery
          </span>
        </div>

        {/* Issue number badge bottom-left */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)" }}>
          <div className="flex items-end justify-between">
            <div>
              <p style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "0.1em", textTransform: "uppercase", lineHeight: 1 }}>
                {issue.publishedAt ? format(new Date(issue.publishedAt), "MMM yyyy") : ""}
              </p>
              <p style={{ fontFamily: "Georgia, serif", fontSize: 22, color: "white", lineHeight: 1.1, marginTop: 2 }}>
                #{issue.number}
              </p>
            </div>
            {issue.pdfUrl && (
              <a
                href={issue.pdfUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="flex items-center gap-1.5 px-2.5 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ background: "hsl(182 55% 56%)", fontFamily: "Arial, sans-serif", fontSize: 10, fontWeight: 700, color: "hsl(0 0% 4%)", letterSpacing: "0.1em", textTransform: "uppercase" }}
                data-testid={`download-${issue.number}`}
              >
                <Download className="w-3 h-3" />
                PDF
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Below card */}
      <div className="mt-3">
        {issue.pdfUrl ? (
          <a
            href={issue.pdfUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-secondary transition-colors"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, color: "hsl(182 55% 56%)", letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            <Download className="w-3 h-3" />
            Download PDF
          </a>
        ) : (
          <Link href={`/current-issue`}>
            <span className="inline-flex items-center gap-1.5 hover:text-secondary transition-colors cursor-pointer"
              style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 55%)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Browse articles →
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}

function PlaceholderIssue({ issue }: { issue: Issue }) {
  return (
    <div className="group flex items-center gap-4 py-3 border-b border-border hover:bg-white transition-colors px-2 -mx-2"
      data-testid={`issue-list-${issue.number}`}>
      {/* Mini cover placeholder */}
      <div className="shrink-0 flex items-center justify-center bg-[hsl(0,0%,94%)] border border-border"
        style={{ width: 36, height: 52 }}>
        <span style={{ fontFamily: "Arial, sans-serif", fontSize: 9, fontWeight: 700, color: "hsl(0 0% 65%)", letterSpacing: "0.05em" }}>
          #{issue.number}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, color: "hsl(0 0% 10%)" }}>
          Gallery #{issue.number}
        </p>
        {issue.publishedAt && (
          <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }}>
            {format(new Date(issue.publishedAt), "MMMM yyyy")}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="shrink-0">
        {issue.pdfUrl ? (
          <a
            href={issue.pdfUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-secondary transition-colors"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(182 55% 56%)", fontWeight: 700 }}
            data-testid={`download-list-${issue.number}`}
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </a>
        ) : (
          <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 75%)" }}>
            No PDF
          </span>
        )}
      </div>
    </div>
  );
}

export default function Archive() {
  const { data, isLoading } = useQuery<{ issues: Issue[] }>({
    queryKey: ["/api/issues"],
  });

  const allIssues = (data?.issues || []).sort((a, b) => b.number - a.number);
  const withCovers = allIssues.filter(i => i.coverImage);
  const withoutCovers = allIssues.filter(i => !i.coverImage);

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
            Every issue of Gallery Magazine — Jersey life &amp; style since 2006.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="max-w-[1296px] mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="bg-border animate-pulse w-full" style={{ aspectRatio: "2/3" }} />
                <div className="h-3 bg-border rounded w-20 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* ── Cover issues — magazine shelf ─────────────────────────── */}
          {withCovers.length > 0 && (
            <section className="py-14 bg-white border-b border-border">
              <div className="max-w-[1296px] mx-auto px-6">
                <h2 className="mb-8"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
                  Recent Issues
                </h2>
                <div className={`grid gap-8 ${
                  withCovers.length === 1 ? "grid-cols-1 max-w-xs" :
                  withCovers.length === 2 ? "grid-cols-2 max-w-md" :
                  withCovers.length === 3 ? "grid-cols-3 max-w-xl" :
                  "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"
                }`}>
                  {withCovers.map(issue => (
                    <CoverIssue key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ── All other issues — catalogue list ─────────────────────── */}
          {withoutCovers.length > 0 && (
            <section className="py-12">
              <div className="max-w-[1296px] mx-auto px-6">
                <div className="flex items-baseline gap-4 mb-6">
                  <h2 style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
                    Earlier Issues
                  </h2>
                  <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 65%)" }}>
                    {withoutCovers.length} issues
                    {withoutCovers.filter(i => i.pdfUrl).length > 0 &&
                      ` · ${withoutCovers.filter(i => i.pdfUrl).length} with PDF`}
                  </span>
                </div>

                {/* Two-column list on desktop */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                  {withoutCovers.map(issue => (
                    <PlaceholderIssue key={issue.id} issue={issue} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <Footer />
    </div>
  );
}
