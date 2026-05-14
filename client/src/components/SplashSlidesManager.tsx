import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ArticleWithDetails } from "@shared/schema";

type Slot = ArticleWithDetails | null;

export function SplashSlidesManager() {
  const { toast } = useToast();
  const [pickerSlot, setPickerSlot] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [slots, setSlots] = useState<Slot[]>([null, null, null]);

  // Current persisted selection
  const { data, isLoading } = useQuery<{ slides: (ArticleWithDetails & { position: number })[] }>({
    queryKey: ["/api/splash-slides"],
  });

  // Initialise local slot state from the server payload (only once data lands)
  useEffect(() => {
    if (!data?.slides) return;
    const next: Slot[] = [null, null, null];
    for (const s of data.slides) {
      if (s.position >= 0 && s.position < 3) next[s.position] = s;
    }
    setSlots(next);
  }, [data]);

  // Article search for the picker
  const searchParams = new URLSearchParams({
    status: "published",
    withImage: "true",
    limit: "12",
    ...(search && { search }),
  });
  const { data: searchData, isLoading: searchLoading } = useQuery<{ articles: ArticleWithDetails[] }>({
    queryKey: [`/api/articles?${searchParams}`],
    enabled: pickerSlot !== null,
  });

  const saveMutation = useMutation({
    mutationFn: async (next: Slot[]) => {
      const articleIds = next.map((s) => s?.id ?? null);
      const res = await apiRequest("PUT", "/api/splash-slides", { articleIds });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/splash-slides"] });
      toast({ title: "Splash slides updated" });
    },
    onError: () => {
      toast({ title: "Save failed", description: "Could not save splash slides.", variant: "destructive" });
    },
  });

  const dirty = useMemo(() => {
    const current = (data?.slides ?? []).map((s) => ({ position: s.position, id: s.id }));
    const draft = slots
      .map((s, position) => (s ? { position, id: s.id } : null))
      .filter(Boolean) as { position: number; id: string }[];
    return JSON.stringify(current) !== JSON.stringify(draft);
  }, [data, slots]);

  function setSlot(i: number, article: Slot) {
    setSlots((prev) => {
      const next = [...prev];
      next[i] = article;
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold" style={{ fontFamily: "Georgia, serif" }}>
          Splash intro slides
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick three articles whose featured images play full-screen on the homepage intro.
          Leave a slot empty to let the splash fall back to the latest featured stories.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {slots.map((slot, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative bg-[hsl(0,0%,94%)]" style={{ aspectRatio: "16 / 9" }}>
                {slot?.featuredImage ? (
                  <img
                    src={slot.featuredImage}
                    alt={slot.title}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    Slot {i + 1} — empty
                  </div>
                )}
                {slot && (
                  <button
                    onClick={() => setSlot(i, null)}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
                    title="Clear slot"
                    data-testid={`splash-clear-${i}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="p-3 space-y-2">
                {slot ? (
                  <>
                    <div className="text-xs uppercase tracking-wider text-secondary">
                      {slot.category.name}
                    </div>
                    <div className="font-medium leading-tight line-clamp-2" style={{ fontFamily: "Georgia, serif" }}>
                      {slot.title}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted-foreground">Position {i + 1}</div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => { setPickerSlot(i); setSearch(""); }}
                  data-testid={`splash-pick-${i}`}
                >
                  {slot ? "Replace" : "Pick article"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => saveMutation.mutate(slots)}
          disabled={!dirty || saveMutation.isPending}
          data-testid="splash-save"
        >
          {saveMutation.isPending ? "Saving…" : "Save splash slides"}
        </Button>
        {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        {isLoading && <span className="text-sm text-muted-foreground">Loading current selection…</span>}
      </div>

      {/* Picker overlay */}
      {pickerSlot !== null && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setPickerSlot(null)}
        >
          <div
            className="bg-background rounded-lg w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex items-center gap-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search articles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
                data-testid="splash-picker-search"
              />
              <Button variant="ghost" size="sm" onClick={() => setPickerSlot(null)}>
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {searchLoading && <div className="text-sm text-muted-foreground">Searching…</div>}
              {(searchData?.articles ?? []).map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSlot(pickerSlot, a); setPickerSlot(null); }}
                  className="text-left flex gap-3 p-2 rounded hover:bg-accent transition-colors"
                  data-testid={`splash-picker-result-${a.slug}`}
                >
                  <div className="shrink-0 w-24 h-16 bg-[hsl(0,0%,94%)] overflow-hidden">
                    {a.featuredImage && (
                      <img
                        src={a.featuredImage}
                        alt={a.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wider text-secondary">{a.category.name}</div>
                    <div className="font-medium leading-tight line-clamp-2" style={{ fontFamily: "Georgia, serif" }}>
                      {a.title}
                    </div>
                  </div>
                </button>
              ))}
              {!searchLoading && (searchData?.articles?.length ?? 0) === 0 && (
                <div className="text-sm text-muted-foreground">No articles found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
