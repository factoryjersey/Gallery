import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, BookOpen, Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface UploadState {
  issueNumber: number;
  filename: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function parseIssueNumber(filename: string): number | null {
  // Try patterns: gallery-207.pdf, gallery207.pdf, 207.pdf, issue-207.pdf, g207.pdf
  const patterns = [
    /gallery[-_\s]?(\d{2,3})/i,
    /issue[-_\s]?(\d{2,3})/i,
    /^g?(\d{2,3})\.pdf$/i,
    /[-_\s](\d{2,3})\.pdf$/i,
    /(\d{2,3})/,
  ];
  for (const re of patterns) {
    const m = filename.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 999) return n;
    }
  }
  return null;
}

export default function IssuesManager() {
  const { toast } = useToast();
  const [uploadQueue, setUploadQueue] = useState<UploadState[]>([]);
  const [singleUploading, setSingleUploading] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

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

  async function uploadSingle(issueNumber: number, file: File) {
    setSingleUploading(issueNumber);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      const res = await fetch(`/api/issues/${issueNumber}/pdf`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: `Issue #${issueNumber} PDF uploaded` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setSingleUploading(null);
    }
  }

  const startBulkUpload = useCallback(async (files: File[]) => {
    const queue: UploadState[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) continue;
      const num = parseIssueNumber(file.name);
      if (!num) { skipped.push(file.name); continue; }
      queue.push({ issueNumber: num, filename: file.name, status: "pending" });
    }

    if (skipped.length) {
      toast({ title: `${skipped.length} file(s) skipped — couldn't parse issue number`, variant: "destructive" });
    }
    if (!queue.length) return;

    setUploadQueue(queue);

    // Upload up to 3 at a time
    const CONCURRENCY = 3;
    let index = 0;

    async function runOne(state: UploadState) {
      setUploadQueue(q => q.map(x => x.issueNumber === state.issueNumber ? { ...x, status: "uploading" } : x));
      try {
        const fileObj = files.find(f => f.name === state.filename)!;
        const formData = new FormData();
        formData.append("pdf", fileObj);
        const res = await fetch(`/api/issues/${state.issueNumber}/pdf`, { method: "POST", body: formData });
        if (!res.ok) throw new Error();
        setUploadQueue(q => q.map(x => x.issueNumber === state.issueNumber ? { ...x, status: "done" } : x));
      } catch {
        setUploadQueue(q => q.map(x => x.issueNumber === state.issueNumber ? { ...x, status: "error", error: "Upload failed" } : x));
      }
    }

    async function worker() {
      while (index < queue.length) {
        const item = queue[index++];
        await runOne(item);
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker);
    await Promise.all(workers);
    await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
    toast({ title: `Uploaded ${queue.filter(x => x.status !== "error").length} of ${queue.length} PDFs` });
  }, [toast]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    startBulkUpload(files);
  }

  async function syncFromR2() {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/issues/sync-r2", { method: "POST" });
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: `Synced ${data.synced ?? 0} PDFs from R2` });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }

  const pdfCount = issues.filter(i => i.pdfUrl).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400 }}>
            Issue Archive — PDFs
          </h2>
          <p className="mt-1" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
            {pdfCount} of {issues.length} issues have a PDF.{" "}
            <a href="/archive" target="_blank" className="text-secondary hover:underline">
              View public archive →
            </a>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={syncFromR2}
          disabled={isSyncing}
          data-testid="sync-r2"
          className="shrink-0"
        >
          {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sync from R2
        </Button>
      </div>

      {/* Bulk drop zone */}
      <div
        ref={dropRef}
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed transition-colors p-8 text-center ${isDragging ? "border-secondary bg-secondary/5" : "border-border"}`}
        data-testid="bulk-drop-zone"
      >
        <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <p style={{ fontFamily: "Georgia, serif", fontSize: 16, color: "hsl(0 0% 35%)" }}>
          Drop all your PDFs here
        </p>
        <p className="mt-1 mb-4" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }}>
          Name files <strong>gallery-181.pdf</strong>, <strong>gallery-207.pdf</strong> etc. — issue numbers are parsed automatically.
          <br />Also accepts: <code>181.pdf</code>, <code>issue-207.pdf</code>, <code>g204.pdf</code>
        </p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-border hover:border-foreground transition-colors"
          style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700 }}>
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files || []);
              if (files.length) startBulkUpload(files);
              e.target.value = "";
            }}
            data-testid="bulk-file-input"
          />
          Select PDFs
        </label>
      </div>

      {/* Upload progress */}
      {uploadQueue.length > 0 && (
        <div className="border border-border divide-y divide-border">
          <div className="px-4 py-2 flex items-center justify-between bg-[hsl(0,0%,97%)]">
            <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
              Upload Progress — {uploadQueue.filter(x => x.status === "done").length}/{uploadQueue.length} complete
            </span>
            {uploadQueue.every(x => x.status === "done" || x.status === "error") && (
              <button onClick={() => setUploadQueue([])}
                style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }}
                className="hover:text-foreground">
                Clear
              </button>
            )}
          </div>
          {uploadQueue.map(item => (
            <div key={item.issueNumber} className="flex items-center gap-4 px-4 py-2">
              <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13, fontWeight: 700, minWidth: 40 }}>
                #{item.issueNumber}
              </span>
              <span className="flex-1 truncate" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
                {item.filename}
              </span>
              {item.status === "pending" && (
                <span style={{ fontSize: 12, color: "hsl(0 0% 65%)" }}>Waiting…</span>
              )}
              {item.status === "uploading" && (
                <Loader2 className="w-4 h-4 animate-spin text-secondary" />
              )}
              {item.status === "done" && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {item.status === "error" && (
                <div className="flex items-center gap-1.5">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span style={{ fontSize: 12, color: "hsl(0 0% 55%)" }}>{item.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-issue table */}
      <div className="border border-border divide-y divide-border">
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
            <div className="col-span-1">
              <span style={{ fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: 700 }}>
                #{issue.number}
              </span>
            </div>
            <div className="col-span-2" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
              {issue.publishedAt ? format(new Date(issue.publishedAt), "MMM yyyy") : "—"}
            </div>
            <div className="col-span-1">
              {issue.coverImage ? (
                <img src={issue.coverImage} alt="" className="w-8 h-12 object-cover" />
              ) : (
                <div className="w-8 h-12 bg-border flex items-center justify-center">
                  <BookOpen className="w-3 h-3 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="col-span-4">
              {issue.pdfUrl ? (
                <a href={issue.pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-secondary hover:underline"
                  style={{ fontFamily: "Arial, sans-serif", fontSize: 13 }}
                  data-testid={`pdf-link-${issue.number}`}>
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </a>
              ) : (
                <span style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 70%)" }}>
                  No PDF uploaded
                </span>
              )}
            </div>
            <div className="col-span-4 flex items-center gap-2">
              {singleUploading === issue.number ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : (
                <label className="cursor-pointer" data-testid={`upload-pdf-${issue.number}`}>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadSingle(issue.number, file);
                      e.target.value = "";
                    }}
                  />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-foreground transition-colors cursor-pointer"
                    style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}>
                    <Upload className="w-3.5 h-3.5" />
                    {issue.pdfUrl ? "Replace" : "Upload PDF"}
                  </span>
                </label>
              )}
              {issue.pdfUrl && (
                <Button variant="ghost" size="sm"
                  className="text-destructive hover:text-destructive h-7 px-2"
                  onClick={() => deletePdf.mutate(issue.number)}
                  data-testid={`delete-pdf-${issue.number}`}>
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
