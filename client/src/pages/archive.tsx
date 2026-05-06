import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Download, BookOpen } from "lucide-react";

export default function Archive() {
  const { data, isLoading } = useQuery<{ issues: any[] }>({
    queryKey: ["/api/issues"],
  });

  const issues = (data?.issues || []).sort((a, b) => b.number - a.number);
  const withPdf = issues.filter(i => i.pdfUrl);
  const all = issues;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Masthead */}
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
          <p className="mt-2 max-w-lg mx-auto" style={{ fontFamily: "Georgia, serif", fontSize: 16, fontStyle: "italic", color: "hsl(0 0% 43%)", lineHeight: 1.6 }}>
            Every issue of Gallery Magazine, available to read and download.
          </p>
          {withPdf.length > 0 && (
            <p className="mt-1" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
              {withPdf.length} issue{withPdf.length !== 1 ? "s" : ""} available for download
            </p>
          )}
        </div>
      </section>

      {/* Issue grid */}
      <section className="py-12">
        <div className="max-w-[1296px] mx-auto px-6">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="bg-border animate-pulse w-full" style={{ aspectRatio: "2/3" }} />
                  <div className="h-3 bg-border rounded w-16 animate-pulse" />
                </div>
              ))}
            </div>
          ) : all.length === 0 ? (
            <div className="py-20 text-center border border-border">
              <BookOpen className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
              <p style={{ fontFamily: "Georgia, serif", fontSize: 18, color: "hsl(0 0% 43%)" }}>
                No issues in the archive yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {all.map((issue) => (
                <div key={issue.id} className="group" data-testid={`issue-${issue.number}`}>
                  {/* Cover */}
                  <div className="relative overflow-hidden bg-[hsl(0,0%,92%)] mb-3" style={{ aspectRatio: "2/3" }}>
                    {issue.coverImage ? (
                      <img
                        src={issue.coverImage}
                        alt={`Gallery #${issue.number}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <BookOpen className="w-6 h-6 text-muted-foreground" />
                        <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, color: "hsl(0 0% 55%)", letterSpacing: "0.08em" }}>
                          #{issue.number}
                        </span>
                      </div>
                    )}

                    {/* Download overlay */}
                    {issue.pdfUrl && (
                      <a
                        href={issue.pdfUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all duration-200 flex items-center justify-center"
                        data-testid={`download-issue-${issue.number}`}
                      >
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-2">
                          <Download className="w-6 h-6 text-white" />
                          <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, color: "white", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Download
                          </span>
                        </div>
                      </a>
                    )}
                  </div>

                  {/* Label */}
                  <div>
                    <p style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, color: "hsl(0 0% 4%)" }}>
                      #{issue.number}
                    </p>
                    {issue.publishedAt && (
                      <p style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 55%)" }}>
                        {format(new Date(issue.publishedAt), "MMM yyyy")}
                      </p>
                    )}
                    {issue.pdfUrl ? (
                      <a
                        href={issue.pdfUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 hover:text-secondary transition-colors"
                        style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(182 55% 56%)" }}
                      >
                        <Download className="w-3 h-3" />
                        PDF
                      </a>
                    ) : (
                      <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, color: "hsl(0 0% 75%)" }}>
                        No PDF yet
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
