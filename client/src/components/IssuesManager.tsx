import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export default function IssuesManager() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ issues: any[] }>({
    queryKey: ["/api/issues"],
  });

  const issues = (data?.issues || []).sort((a, b) => b.number - a.number);

  const deletePdf = useMutation({
    mutationFn: async (issueNumber: number) => {
      const res = await fetch(`/api/issues/${issueNumber}/pdf`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove PDF");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: "PDF removed" });
    },
    onError: () => toast({ title: "Error removing PDF", variant: "destructive" }),
  });

  async function handlePdfUpload(issueNumber: number, file: File) {
    if (!file.type.includes("pdf")) {
      toast({ title: "Please select a PDF file", variant: "destructive" });
      return;
    }
    setUploading(issueNumber);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch(`/api/issues/${issueNumber}/pdf`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: `Issue #${issueNumber} PDF uploaded` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400 }}>
            Issue Archive — PDFs
          </h2>
          <p className="mt-1" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
            Upload PDFs for each issue so readers can download them from the archive page.
            {" "}{issues.filter(i => i.pdfUrl).length} of {issues.length} issues have a PDF.
          </p>
        </div>
        <a
          href="/archive"
          target="_blank"
          className="text-secondary hover:underline"
          style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}
        >
          View public archive →
        </a>
      </div>

      {/* Issue list */}
      <div className="border border-border divide-y divide-border">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-[hsl(0,0%,97%)]"
          style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
          <div className="col-span-1">Issue</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-1">Cover</div>
          <div className="col-span-4">PDF</div>
          <div className="col-span-4">Actions</div>
        </div>

        {issues.map((issue) => (
          <div key={issue.id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-[hsl(0,0%,99%)]">
            {/* Number */}
            <div className="col-span-1">
              <span style={{ fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: 700 }}>
                #{issue.number}
              </span>
            </div>

            {/* Date */}
            <div className="col-span-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
              {issue.publishedAt ? format(new Date(issue.publishedAt), "MMM yyyy") : "—"}
            </div>

            {/* Cover thumbnail */}
            <div className="col-span-1">
              {issue.coverImage ? (
                <img src={issue.coverImage} alt="" className="w-8 h-12 object-cover" />
              ) : (
                <div className="w-8 h-12 bg-border flex items-center justify-center">
                  <BookOpen className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* PDF status */}
            <div className="col-span-4">
              {issue.pdfUrl ? (
                <a
                  href={issue.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-secondary hover:underline"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}
                  data-testid={`pdf-link-${issue.number}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </a>
              ) : (
                <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 70%)" }}>
                  No PDF uploaded
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="col-span-4 flex items-center gap-2">
              {uploading === issue.number ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <label className="cursor-pointer" data-testid={`upload-pdf-${issue.number}`}>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePdfUpload(issue.number, file);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-foreground transition-colors cursor-pointer"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}>
                    <Upload className="w-3.5 h-3.5" />
                    {issue.pdfUrl ? "Replace PDF" : "Upload PDF"}
                  </span>
                </label>
              )}

              {issue.pdfUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive h-7 px-2"
                  onClick={() => deletePdf.mutate(issue.number)}
                  data-testid={`delete-pdf-${issue.number}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
