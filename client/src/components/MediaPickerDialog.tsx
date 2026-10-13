import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Check, ChevronLeft, ChevronRight, X } from "lucide-react";

/** Minimal shape of a media row — only the fields the picker renders. */
interface MediaRow {
  id: string;
  filename: string;
  originalName: string;
  objectPath: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  variants?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    webp?: string;
  } | null;
}

interface MediaResponse {
  media: MediaRow[];
  total: number;
  page: number;
  totalPages: number;
}

/** Mirrors MediaManager.getImageUrl — pick the best-available URL for a
 *  media row. External CDN/R2 URLs are used as-is; local storage paths
 *  get the /objects/ prefix. */
function getImageUrl(m: MediaRow, prefer: "thumbnail" | "medium" = "medium"): string {
  if (m.objectPath.startsWith("http")) return m.objectPath;
  const v = m.variants?.[prefer] ?? m.variants?.medium ?? m.variants?.thumbnail;
  if (v && v.startsWith("http")) return v;
  if (v) return `/objects/${v}`;
  return `/objects/${m.objectPath}`;
}

/** The URL to send back when the user confirms a selection. Prefers the
 *  large / medium variant over the thumbnail so the gallery renders at
 *  a usable resolution; falls back to objectPath if no variants exist. */
function getSelectUrl(m: MediaRow): string {
  if (m.objectPath.startsWith("http")) return m.objectPath;
  const v = m.variants?.large ?? m.variants?.medium ?? m.variants?.webp;
  if (v && v.startsWith("http")) return v;
  if (v) return `/objects/${v}`;
  return `/objects/${m.objectPath}`;
}

interface MediaPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen URLs when the user confirms. */
  onPick: (urls: string[]) => void;
  /** URLs already in the gallery — picker hides them from selection and
   *  shows a small "In gallery" badge so the editor doesn't re-add
   *  duplicates by accident. */
  excludeUrls?: string[];
  /** Dialog title (lets callers reuse this for featured-image pickers
   *  too). Default suits the gallery use-case. */
  title?: string;
}

/**
 * Modal media-library picker. Shows the admin's uploaded media as a
 * paginated searchable grid; clicking a tile toggles selection, "Add N
 * images" returns the chosen URLs via onPick.
 *
 * Fetches /api/media directly (same endpoint MediaManager uses) so the
 * same uploads surface in both places. No upload UI here — if the
 * editor wants to upload new images, that stays in the surrounding
 * component (the picker is read-only).
 */
export default function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  excludeUrls = [],
  title = "Pick images from the library",
}: MediaPickerDialogProps) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Debounce the search box so every keystroke doesn't refetch /api/media.
  // 250ms feels responsive but spares the server a dozen pointless hits
  // when the editor types "august paparazzi".
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  // Reset to page 1 whenever the search changes so a filter switch
  // doesn't land the editor on an empty "page 7".
  useEffect(() => { setPage(1); }, [search]);

  // Track selection as a Map so toggling is O(1) and we preserve pick
  // order (useful if the editor wants to insert into galleryImages in
  // the sequence they clicked rather than the DB's default sort).
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  // Reset selection whenever the dialog opens/closes so a cancelled
  // session doesn't leak into the next one.
  useEffect(() => {
    if (!open) setSelected(new Map());
  }, [open]);

  const { data, isLoading, isFetching } = useQuery<MediaResponse>({
    queryKey: ["/api/media", page, search],
    enabled: open,
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "24",
        ...(search ? { search } : {}),
      });
      const res = await fetch(`/api/media?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load media");
      return res.json();
    },
  });

  const excludeSet = useMemo(() => new Set(excludeUrls), [excludeUrls]);
  const totalPages = data?.totalPages ?? 1;

  function toggle(m: MediaRow) {
    const url = getSelectUrl(m);
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(m.id)) next.delete(m.id);
      else next.set(m.id, url);
      return next;
    });
  }

  function handleConfirm() {
    const urls = Array.from(selected.values());
    if (urls.length > 0) onPick(urls);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        data-testid="media-picker-dialog"
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="Search by filename…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            data-testid="media-picker-search"
          />
          {search && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchInput("")}
              data-testid="media-picker-clear"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Grid area — scrollable so pagination controls stay visible. */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading media…
            </div>
          ) : (data?.media ?? []).length === 0 ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              {search
                ? `No media matching "${search}".`
                : "No media uploaded yet."}
            </div>
          ) : (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
              data-testid="media-picker-grid"
            >
              {data!.media.map((m) => {
                const url = getSelectUrl(m);
                const already = excludeSet.has(url);
                const isSelected = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => !already && toggle(m)}
                    disabled={already}
                    className={`relative block aspect-square overflow-hidden bg-muted border-2 transition-colors ${
                      already
                        ? "opacity-50 cursor-not-allowed border-transparent"
                        : isSelected
                          ? "border-primary"
                          : "border-transparent hover:border-border"
                    }`}
                    data-testid={`media-picker-tile-${m.id}`}
                    title={m.originalName}
                  >
                    <img
                      src={getImageUrl(m, "thumbnail")}
                      alt={m.alt ?? m.originalName}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    {already && (
                      <span className="absolute bottom-1 left-1 right-1 text-[10px] bg-black/70 text-white px-1 py-0.5 text-center">
                        In gallery
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-primary text-primary-foreground rounded-full shadow">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination — only shown when there's more than one page.
            isFetching keeps the Prev/Next disabled during background
            refetches so a rapid click doesn't double-skip. */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
            <span>
              Page {data?.page ?? 1} of {totalPages}
              {data?.total != null && ` · ${data.total} total`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                data-testid="media-picker-prev"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                data-testid="media-picker-next"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row justify-between items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="media-picker-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              data-testid="media-picker-confirm"
            >
              Add {selected.size || ""} image{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
