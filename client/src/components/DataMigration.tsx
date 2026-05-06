import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DataMigration() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ stats: Record<string, number> } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("Content-Disposition") || "";
      const filename = cd.match(/filename="(.+?)"/)?.[1] ?? "gallery-export.json";
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded", description: "Import this file in your production admin." });
    } catch {
      toast({ title: "Export failed", description: "Could not generate export file.", variant: "destructive" });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/import", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Import failed");
      return json;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setImportError(null);
      toast({ title: "Import complete", description: `${data.stats.articles} articles imported.` });
    },
    onError: (err: Error) => {
      setImportError(err.message);
      setImportResult(null);
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportResult(null);
      setImportError(null);
      importMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-6" data-testid="data-migration">
      <div>
        <h2 className="text-xl font-bold mb-1">Data Migration</h2>
        <p className="text-sm text-muted-foreground">
          Export all content from this environment and import it into another (e.g. copy dev data into production).
          Images are stored on R2 and shared between environments — only the database records are transferred.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="w-4 h-4" />
              Step 1 — Export (run in dev)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Downloads a JSON file containing all authors, categories, tags, and articles. No image data — just URLs.
            </p>
            <Button onClick={handleExport} data-testid="button-export" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download Export File
            </Button>
          </CardContent>
        </Card>

        {/* Import */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="w-4 h-4" />
              Step 2 — Import (run in production)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload the export file here. Existing records are skipped — safe to run multiple times.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
              data-testid="import-file-input"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full"
              disabled={importMutation.isPending}
              data-testid="button-import"
            >
              {importMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing…</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Upload Export File</>
              )}
            </Button>

            {importResult && (
              <div className="rounded border border-green-200 bg-green-50 p-3 space-y-1" data-testid="import-success">
                <div className="flex items-center gap-2 text-green-700 font-medium text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Import complete
                </div>
                <ul className="text-xs text-green-600 space-y-0.5 ml-6">
                  <li>Authors: {importResult.stats.authors}</li>
                  <li>Categories: {importResult.stats.categories}</li>
                  <li>Tags: {importResult.stats.tags}</li>
                  <li>Articles: {importResult.stats.articles}</li>
                  <li>Tag links: {importResult.stats.articleTags}</li>
                </ul>
              </div>
            )}

            {importError && (
              <div className="rounded border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700" data-testid="import-error">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {importError}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-2">How to migrate content to production:</p>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Click <strong>Download Export File</strong> above (in your dev environment)</li>
            <li>Go to your published app's admin panel → Data Migration</li>
            <li>Upload the downloaded file using <strong>Upload Export File</strong></li>
            <li>Done — all articles will appear on the live site immediately</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
