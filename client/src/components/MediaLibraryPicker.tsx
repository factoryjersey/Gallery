import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Upload, Check, X, Loader2 } from "lucide-react";

interface MediaItem {
  id: string;
  filename: string;
  alt: string | null;
  objectPath: string;
  variants?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen image URLs (full-size — `original` when available,
   *  otherwise `objectPath`). Receives an array so the caller can decide
   *  whether to insert individual images or an inline gallery block. */
  onInsert: (urls: string[]) => void;
  /** Optional restriction on max selectable images per insert. */
  maxSelection?: number;
}

function fullUrl(m: MediaItem): string {
  return m.variants?.original || m.objectPath;
}

function thumbUrl(m: MediaItem): string {
  return m.variants?.thumbnail || m.variants?.medium || m.objectPath;
}

/**
 * Modal that lists the media library, supports search + batch upload,
 * and returns a multi-selection back to the caller. Used by the TipTap
 * editor to drop existing library images (or a gallery of them) into the
 * article body without re-uploading.
 */
export default function MediaLibraryPicker({ open, onClose, onInsert, maxSelection }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);  // ordered ids
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const params = new URLSearchParams({
    limit: "60",
    page: String(page),
    ...(search ? { search } : {}),
  });
  const { data, isLoading, isFetching } = useQuery<{
    media: MediaItem[];
    total: number;
    page: number;
    totalPages: number;
  }>({
    queryKey: [`/api/media?${params.toString()}`],
    enabled: open,
  });

  // Append new pages to the running list when paginating; reset when the
  // search changes.
  useEffect(() => {
    if (!data) return;
    if (page === 1) setAccumulated(data.media);
    else {
      setAccumulated((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = data.media.filter((m) => !seen.has(m.id));
        return [...prev, ...fresh];
      });
    }
  }, [data, page]);

  // Reset accumulated list when search/open changes
  useEffect(() => {
    setPage(1);
    setAccumulated([]);
  }, [search]);
  useEffect(() => {
    if (!open) {
      setSelected([]);
      setSearch("");
      setPage(1);
    }
  }, [open]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (maxSelection && prev.length >= maxSelection) return prev;
      return [...prev, id];
    });
  }

  async function handleBatchUpload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });
    let added: string[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        const fd = new FormData();
        fd.append("image", list[i]);
        const res = await fetch("/api/media/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.media?.id) added.push(data.media.id);
        }
      } catch (err) {
        console.error("Library upload failed:", err);
      }
      setUploadProgress({ done: i + 1, total: list.length });
    }
    // Refetch and auto-select the freshly uploaded items
    await queryClient.invalidateQueries({ queryKey: [`/api/media?${params.toString()}`] });
    await queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/media") });
    setPage(1);
    setSelected((prev) => Array.from(new Set([...prev, ...added])));
    setUploading(false);
    setUploadProgress(null);
  }

  function confirmInsert() {
    // Preserve user's click order when emitting URLs
    const byId = new Map(accumulated.map((m) => [m.id, m]));
    const urls = selected.map((id) => byId.get(id)).filter(Boolean).map((m) => fullUrl(m as MediaItem));
    if (urls.length > 0) onInsert(urls);
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="media-library-modal"
    >
      <div
        className="bg-background w-full max-w-5xl max-h-[90vh] flex flex-col rounded shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <h2 className="text-lg" style={{ fontFamily: "Georgia, serif" }}>Media library</h2>
          <span className="text-sm text-muted-foreground">
            {data?.total ?? 0} images
          </span>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search library…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-64"
              data-testid="library-search"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="library-upload"
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            {uploading && uploadProgress
              ? `Uploading ${uploadProgress.done}/${uploadProgress.total}`
              : "Upload"}
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
            data-testid="library-close"
          >
            <X className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleBatchUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && accumulated.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">Loading…</div>
          ) : accumulated.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-12">
              No images. {search ? "Try a different search." : "Use Upload to add some."}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {accumulated.map((m) => {
                const isSelected = selected.includes(m.id);
                const order = selected.indexOf(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleSelect(m.id)}
                    className={`relative aspect-square overflow-hidden bg-[hsl(0,0%,94%)] border-2 transition-colors focus:outline-none ${
                      isSelected ? "border-secondary" : "border-transparent hover:border-border"
                    }`}
                    title={m.filename}
                    data-testid={`library-item-${m.id}`}
                  >
                    <img
                      src={thumbUrl(m)}
                      alt={m.alt || m.filename}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-secondary text-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-semibold">
                        {order + 1}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {data && data.page < data.totalPages && (
            <div className="flex justify-center mt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isFetching}
                onClick={() => setPage((p) => p + 1)}
                data-testid="library-load-more"
              >
                {isFetching ? "Loading…" : `Load more (${data.total - accumulated.length} remaining)`}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <div className="text-sm text-muted-foreground">
            {selected.length === 0
              ? "Click images to select. Pick one to insert inline, or several to insert as a gallery."
              : selected.length === 1
                ? "1 image selected — will insert as a single image."
                : `${selected.length} images selected — will insert as an inline gallery.`}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={selected.length === 0}
              onClick={confirmInsert}
              data-testid="library-insert"
            >
              <Check className="w-4 h-4 mr-1" />
              Insert {selected.length || ""}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
