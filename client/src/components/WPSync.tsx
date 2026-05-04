import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, SkipForward, Loader2, RefreshCw, Download } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface PostEvent {
  index: number;
  total: number;
  title: string;
  status: "processing" | "done" | "skipped" | "error";
  error?: string;
}

interface SyncResults {
  imported: number;
  skipped: number;
  imagesUploaded: number;
  errors: string[];
}

interface LogEntry {
  type: "progress" | "post" | "total" | "complete" | "error";
  message?: string;
  post?: PostEvent;
  results?: SyncResults;
  total?: number;
}

export function WPSync() {
  const [afterDate, setAfterDate] = useState("2025-10-08T00:00:00");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [totalPosts, setTotalPosts] = useState(0);
  const [results, setResults] = useState<SyncResults | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const appendLog = useCallback((entry: LogEntry) => {
    setLog(prev => [...prev, entry]);
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  const startSync = () => {
    if (running) return;
    setRunning(true);
    setLog([]);
    setProgress(0);
    setTotalPosts(0);
    setResults(null);

    const url = `/api/wp-sync/stream?after=${encodeURIComponent(afterDate)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.type === "progress") {
          appendLog({ type: "progress", message: data.message });
        } else if (data.type === "total") {
          setTotalPosts(data.total);
          appendLog({ type: "total", total: data.total, message: data.message });
        } else if (data.type === "post") {
          appendLog({ type: "post", post: data });
          if (data.total > 0) setProgress(Math.round((data.index / data.total) * 100));
        } else if (data.type === "complete") {
          setResults(data.results);
          setProgress(100);
          appendLog({ type: "complete", results: data.results });
          queryClient.invalidateQueries({ queryKey: ['/api/articles'] });
          queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
          es.close();
          setRunning(false);
        } else if (data.type === "error") {
          appendLog({ type: "error", message: data.message });
          es.close();
          setRunning(false);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      appendLog({ type: "error", message: "Connection lost. The sync may have completed — check your article count." });
      es.close();
      setRunning(false);
    };
  };

  const stopSync = () => {
    esRef.current?.close();
    setRunning(false);
    appendLog({ type: "error", message: "Sync cancelled by user." });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Sync from gallery.je
          </CardTitle>
          <CardDescription>
            Pulls new articles published on your live WordPress site since a given date,
            downloads all images, uploads them to R2, and imports the articles into this CMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="after-date">Import articles published after</Label>
              <Input
                id="after-date"
                data-testid="input-after-date"
                value={afterDate}
                onChange={e => setAfterDate(e.target.value)}
                placeholder="2025-10-08T00:00:00"
                disabled={running}
              />
              <p className="text-xs text-muted-foreground">
                ISO 8601 format. Articles already in the database (by WordPress ID) will be skipped automatically.
              </p>
            </div>
            <div className="flex gap-2">
              {!running ? (
                <Button
                  data-testid="button-start-sync"
                  onClick={startSync}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Start Sync
                </Button>
              ) : (
                <Button
                  data-testid="button-stop-sync"
                  variant="destructive"
                  onClick={stopSync}
                  className="gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Stop
                </Button>
              )}
            </div>
          </div>

          {(running || results) && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{running ? "Syncing…" : "Complete"}</span>
                {totalPosts > 0 && <span>{progress}%</span>}
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {results && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{results.imported}</p>
              <p className="text-sm text-muted-foreground mt-1">Articles imported</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-blue-600">{results.skipped}</p>
              <p className="text-sm text-muted-foreground mt-1">Already in CMS</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-purple-600">{results.imagesUploaded}</p>
              <p className="text-sm text-muted-foreground mt-1">Images uploaded to R2</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{results.errors.length}</p>
              <p className="text-sm text-muted-foreground mt-1">Errors</p>
            </CardContent>
          </Card>
        </div>
      )}

      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Sync Log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80">
              <div ref={scrollRef} className="space-y-1 font-mono text-xs pr-4">
                {log.map((entry, i) => {
                  if (entry.type === "progress") {
                    return (
                      <div key={i} className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                        {entry.message}
                      </div>
                    );
                  }
                  if (entry.type === "total") {
                    return (
                      <div key={i} className="flex items-center gap-2 font-semibold text-foreground py-1">
                        <Download className="w-3 h-3 shrink-0" />
                        {entry.message}
                      </div>
                    );
                  }
                  if (entry.type === "post" && entry.post) {
                    const p = entry.post;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        {p.status === "done" && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                        {p.status === "skipped" && <SkipForward className="w-3 h-3 text-blue-400 shrink-0" />}
                        {p.status === "error" && <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                        {p.status === "processing" && <Loader2 className="w-3 h-3 text-yellow-500 animate-spin shrink-0" />}
                        <span className="text-muted-foreground">[{p.index}/{p.total}]</span>
                        <span className={
                          p.status === "done" ? "text-foreground" :
                          p.status === "skipped" ? "text-muted-foreground" :
                          p.status === "error" ? "text-red-500" : "text-yellow-600"
                        }>
                          {p.title}
                        </span>
                        {p.status === "skipped" && <Badge variant="secondary" className="text-[10px] py-0">already imported</Badge>}
                        {p.error && <span className="text-red-400 truncate">— {p.error}</span>}
                      </div>
                    );
                  }
                  if (entry.type === "complete") {
                    return (
                      <div key={i} className="flex items-center gap-2 text-green-600 font-semibold py-1">
                        <CheckCircle className="w-3 h-3 shrink-0" />
                        Sync complete — {entry.results?.imported} imported, {entry.results?.imagesUploaded} images uploaded to R2
                      </div>
                    );
                  }
                  if (entry.type === "error") {
                    return (
                      <div key={i} className="flex items-center gap-2 text-red-500">
                        <XCircle className="w-3 h-3 shrink-0" />
                        {entry.message}
                      </div>
                    );
                  }
                  return null;
                })}
                {running && (
                  <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    Working…
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
