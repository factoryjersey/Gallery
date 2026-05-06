import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Trash2, BookOpen, Loader2, CheckCircle2, XCircle, RefreshCw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface UploadState {
  issueNumber: number;
  filename: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function parseIssueNumber(filename: string): number | null {
  const patterns = [
    /gallery[-_\s]?(\d{2,3})/i,
    /issue[-_\s]?(\d{2,3})/i,
    /^g?(\d{2,3})\.(pdf|jpg|jpeg|png|webp)$/i,
    /[-_\s](\d{2,3})\.(pdf|jpg|jpeg|png|webp)$/i,
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

function BulkZone({
  accept, label, hint, fieldName, endpoint, dragLabel
}: {
  accept: string; label: string; hint: string;
  fieldName: string; endpoint: string; dragLabel: string;
}) {
  const { toast } = useToast();
  const [queue, setQueue] = useState<UploadState[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const start = useCallback(async (files: File[]) => {
    const items: UploadState[] = [];
    const skipped: string[] = [];
    for (const file of files) {
      const num = parseIssueNumber(file.name);
      if (!num) { skipped.push(file.name); continue; }
      items.push({ issueNumber: num, filename: file.name, status: "pending" });
    }
    if (skipped.length) toast({ title: `${skipped.length} skipped — couldn't parse issue number`, variant: "destructive" });
    if (!items.length) return;
    setQueue(items);

    const CONCURRENCY = 3;
    let index = 0;
    async function runOne(state: UploadState) {
      setQueue(q => q.map(x => x.issueNumber === state.issueNumber ? { ...x, status: "uploading" } : x));
      try {
        const file = files.find(f => f.name === state.filename)!;
        const fd = new FormData();
        fd.append(fieldName, file);
        const res = await fetch(`${endpoint}/${state.issueNumber}/${fieldName === "pdf" ? "pdf" : "cover"}`, { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        setQueue(q => q.map(x => x.issueNumber === state.issueNumber ? { ...x, status: "done" } : x));
      } catch {
        setQueue(q => q.map(x => x.issueNumber === state.issueNumber ? { ...x, status: "error", error: "Failed" } : x));
      }
    }
    async function worker() {
      while (index < items.length) { const item = items[index++]; await runOne(item); }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
    await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
    toast({ title: `Uploaded ${items.filter(x => x.status !== "error").length} of ${items.length} files` });
  }, [toast, fieldName, endpoint]);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); start(Array.from(e.dataTransfer.files)); }}
        className={`border-2 border-dashed transition-colors p-6 text-center ${isDragging ? "border-secondary bg-secondary/5" : "border-border"}`}
      >
        <p style={{ fontFamily: "Georgia, serif", fontSize: 15, color: "hsl(0 0% 35%)" }}>{dragLabel}</p>
        <p className="mt-1 mb-3" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }}>
          {hint}
        </p>
        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 border border-border hover:border-foreground transition-colors"
          style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700 }}>
          <input type="file" accept={accept} multiple className="hidden"
            onChange={e => { const f = Array.from(e.target.files || []); if (f.length) start(f); e.target.value = ""; }} />
          {label}
        </label>
      </div>

      {queue.length > 0 && (
        <div className="border border-border divide-y divide-border">
          <div className="px-3 py-1.5 flex items-center justify-between bg-[hsl(0,0%,97%)]">
            <span style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
              {queue.filter(x => x.status === "done").length}/{queue.length} complete
            </span>
            {queue.every(x => x.status === "done" || x.status === "error") && (
              <button onClick={() => setQueue([])} style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }} className="hover:text-foreground">Clear</button>
            )}
          </div>
          {queue.map(item => (
            <div key={item.issueNumber} className="flex items-center gap-3 px-3 py-2">
              <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, minWidth: 36 }}>#{item.issueNumber}</span>
              <span className="flex-1 truncate" style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }}>{item.filename}</span>
              {item.status === "pending" && <span style={{ fontSize: 11, color: "hsl(0 0% 65%)" }}>Waiting…</span>}
              {item.status === "uploading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary" />}
              {item.status === "done" && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {item.status === "error" && <XCircle className="w-3.5 h-3.5 text-destructive" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IssuesManager() {
  const { toast } = useToast();
  const [singleUploading, setSingleUploading] = useState<string | null>(null); // "pdf-207" or "cover-207"
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<"covers" | "pdfs">("covers");

  const { data, isLoading } = useQuery<{ issues: any[] }>({
    queryKey: ["/api/issues"],
  });

  const issues = (data?.issues || []).sort((a, b) => b.number - a.number);

  const deletePdf = useMutation({
    mutationFn: async (num: number) => {
      const res = await fetch(`/api/issues/${num}/pdf`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/issues"] }); toast({ title: "PDF removed" }); },
    onError: () => toast({ title: "Failed to remove PDF", variant: "destructive" }),
  });

  async function uploadFile(issueNumber: number, file: File, type: "pdf" | "cover") {
    const key = `${type}-${issueNumber}`;
    setSingleUploading(key);
    try {
      const fd = new FormData();
      fd.append(type === "pdf" ? "pdf" : "cover", file);
      const res = await fetch(`/api/issues/${issueNumber}/${type}`, { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: `Issue #${issueNumber} ${type === "pdf" ? "PDF" : "cover"} uploaded` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setSingleUploading(null);
    }
  }

  async function syncFromR2(type: "pdfs" | "covers") {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/issues/sync-${type === "pdfs" ? "r2" : "covers"}`, { method: "POST" });
      const data = await res.json();
      await queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: `Synced ${data.synced ?? 0} ${type} from R2` });
    } catch {
      toast({ title: "Sync failed", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  }

  const coverCount = issues.filter(i => i.coverImage).length;
  const pdfCount = issues.filter(i => i.pdfUrl).length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 400 }}>Issue Archive</h2>
          <p className="mt-1" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "hsl(0 0% 55%)" }}>
            {coverCount} covers · {pdfCount} PDFs · {issues.length} total issues.{" "}
            <a href="/archive" target="_blank" className="text-secondary hover:underline">View archive →</a>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => syncFromR2(activeTab === "covers" ? "covers" : "pdfs")} disabled={isSyncing} className="shrink-0">
          {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Sync {activeTab === "covers" ? "covers" : "PDFs"} from R2
        </Button>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border">
        {(["covers", "pdfs"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 -mb-px border-b-2 transition-colors ${activeTab === tab ? "border-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            style={{ fontFamily: "Arial, sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            {tab === "covers" ? `Covers (${coverCount}/${issues.length})` : `PDFs (${pdfCount}/${issues.length})`}
          </button>
        ))}
      </div>

      {/* Bulk upload zone */}
      {activeTab === "covers" ? (
        <BulkZone
          accept="image/*,.jpg,.jpeg,.png,.webp"
          label="Select cover images"
          dragLabel="Drop all cover images here"
          hint="Name files gallery-181.jpg, gallery-207.jpg etc."
          fieldName="cover"
          endpoint="/api/issues"
        />
      ) : (
        <BulkZone
          accept=".pdf,application/pdf"
          label="Select PDFs"
          dragLabel="Drop all PDFs here"
          hint="Name files gallery-181.pdf, gallery-207.pdf etc."
          fieldName="pdf"
          endpoint="/api/issues"
        />
      )}

      {/* Per-issue table */}
      <div className="border border-border divide-y divide-border">
        {/* Header */}
        <div className="grid gap-3 px-4 py-2 bg-[hsl(0,0%,97%)]"
          style={{ gridTemplateColumns: "60px 80px 56px 1fr 1fr", fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
          <div>Issue</div>
          <div>Date</div>
          <div>Cover</div>
          <div>{activeTab === "covers" ? "Cover image" : "PDF"}</div>
          <div>Upload</div>
        </div>

        {issues.map((issue) => {
          const uploadKey = `${activeTab === "covers" ? "cover" : "pdf"}-${issue.number}`;
          const isUploading = singleUploading === uploadKey;
          return (
            <div key={issue.id} className="grid gap-3 px-4 py-3 items-center hover:bg-[hsl(0,0%,99%)]"
              style={{ gridTemplateColumns: "60px 80px 56px 1fr 1fr" }}>

              {/* Number */}
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: 700 }}>#{issue.number}</div>

              {/* Date */}
              <div style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 55%)" }}>
                {issue.publishedAt ? format(new Date(issue.publishedAt), "MMM yyyy") : "—"}
              </div>

              {/* Cover thumbnail */}
              <div>
                {issue.coverImage ? (
                  <img src={issue.coverImage} alt="" className="w-8 h-12 object-cover shadow-sm" />
                ) : (
                  <div className="w-8 h-12 bg-border flex items-center justify-center">
                    <ImageIcon className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Status */}
              <div>
                {activeTab === "covers" ? (
                  issue.coverImage ? (
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(182 55% 56%)" }}>✓ Cover set</span>
                  ) : (
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 70%)" }}>No cover</span>
                  )
                ) : (
                  issue.pdfUrl ? (
                    <a href={issue.pdfUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-secondary hover:underline"
                      style={{ fontFamily: "Arial, sans-serif", fontSize: 12 }}>
                      <Download className="w-3 h-3" />PDF
                    </a>
                  ) : (
                    <span style={{ fontFamily: "Arial, sans-serif", fontSize: 12, color: "hsl(0 0% 70%)" }}>No PDF</span>
                  )
                )}
              </div>

              {/* Upload action */}
              <div className="flex items-center gap-2">
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : (
                  <label className="cursor-pointer" data-testid={`upload-${activeTab === "covers" ? "cover" : "pdf"}-${issue.number}`}>
                    <input type="file"
                      accept={activeTab === "covers" ? "image/*,.jpg,.jpeg,.png,.webp" : ".pdf,application/pdf"}
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(issue.number, file, activeTab === "covers" ? "cover" : "pdf");
                        e.target.value = "";
                      }}
                    />
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 border border-border hover:border-foreground transition-colors cursor-pointer"
                      style={{ fontFamily: "Arial, sans-serif", fontSize: 11 }}>
                      <Upload className="w-3 h-3" />
                      {activeTab === "covers"
                        ? (issue.coverImage ? "Replace" : "Upload cover")
                        : (issue.pdfUrl ? "Replace" : "Upload PDF")}
                    </span>
                  </label>
                )}
                {activeTab === "pdfs" && issue.pdfUrl && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-6 px-1.5"
                    onClick={() => deletePdf.mutate(issue.number)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
