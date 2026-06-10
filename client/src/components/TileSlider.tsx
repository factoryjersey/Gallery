import { useCallback, useEffect, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props<T> {
  items: T[];
  renderTile: (item: T) => ReactNode;
  keyFor: (item: T) => string;
}

/**
 * 3-up tile row that auto-promotes to an Embla carousel when there are
 * more items than fit on screen.
 *
 * Layout:
 *  - ≤ 3 items → plain CSS grid (no slider chrome).
 *  - > 3 items → horizontal Embla slider with prev/next chevrons floating
 *    over the image band. Mobile shows 1, md 2, lg 3.
 *
 * Lazy loading: each tile owns its own LazyImage (via HighlightTile), so
 * off-screen slides don't fetch their photographs until they're scrolled
 * into view.
 */
export default function TileSlider<T>({ items, renderTile, keyFor }: Props<T>) {
  const overflow = items.length > 3;

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || !overflow) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect, overflow]);

  if (!overflow) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {items.map((item) => (
          <div key={keyFor(item)} className="min-w-0">
            {renderTile(item)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        {/* The flex children's widths use the same gap math as the grid
            path: mobile = 100% (1 per view), md = 50% minus half-of-1.5rem
            gap (2 per view), lg = third minus two-thirds of 2rem gap
            (3 per view). */}
        <div className="flex gap-6 lg:gap-8">
          {items.map((item) => (
            <div
              key={keyFor(item)}
              className="min-w-0 flex-[0_0_100%] md:flex-[0_0_calc(50%-12px)] lg:flex-[0_0_calc((100%-4rem)/3)]"
            >
              {renderTile(item)}
            </div>
          ))}
        </div>
      </div>

      {/* Floating chevrons sit roughly at the vertical centre of the image
          band (image is 1:1; total tile height is image + text, so ~28%
          lands inside the photograph on most viewports). */}
      <button
        type="button"
        onClick={() => emblaApi?.scrollPrev()}
        disabled={!canPrev}
        aria-label="Previous"
        className={`absolute left-2 sm:-left-4 top-[28%] z-10 h-10 w-10 rounded-full bg-white shadow-md border border-border flex items-center justify-center transition-opacity ${
          canPrev ? "opacity-100 hover:bg-accent" : "opacity-0 pointer-events-none"
        }`}
        data-testid="tile-slider-prev"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => emblaApi?.scrollNext()}
        disabled={!canNext}
        aria-label="Next"
        className={`absolute right-2 sm:-right-4 top-[28%] z-10 h-10 w-10 rounded-full bg-white shadow-md border border-border flex items-center justify-center transition-opacity ${
          canNext ? "opacity-100 hover:bg-accent" : "opacity-0 pointer-events-none"
        }`}
        data-testid="tile-slider-next"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
