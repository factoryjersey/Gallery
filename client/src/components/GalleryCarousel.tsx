import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import LazyImage from "@/components/LazyImage";

export interface GalleryImage {
  url: string;
  caption?: string;
}

interface Props {
  images: GalleryImage[];
  altPrefix?: string;
}

/**
 * Sliding image gallery for articles. Images live on the article record as a
 * JSON array (`article.galleryImages`) — authored via the article editor,
 * rendered here. Keyboard ← / → navigate; arrow buttons + dot indicator
 * provide click affordances.
 */
export default function GalleryCarousel({ images, altPrefix = "Gallery image" }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") emblaApi.scrollPrev();
      if (e.key === "ArrowRight") emblaApi.scrollNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emblaApi]);

  if (!images || images.length === 0) return null;

  return (
    <div className="relative" data-testid="gallery-carousel">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((img, i) => (
            <div key={i} className="relative shrink-0 w-full" style={{ minWidth: 0 }}>
              <div className="bg-black" style={{ aspectRatio: "3 / 2" }}>
                <LazyImage
                  src={img.url}
                  alt={img.caption || `${altPrefix} ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              {img.caption && (
                <div
                  className="mt-2 px-4"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 13,
                    fontStyle: "italic",
                    color: "hsl(0 0% 35%)",
                  }}
                >
                  {img.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={scrollPrev}
            disabled={index === 0}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            data-testid="gallery-prev"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollNext}
            disabled={index === images.length - 1}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            data-testid="gallery-next"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                aria-label={`Jump to image ${i + 1}`}
                className={`w-2 h-2 rounded-full transition-colors ${i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"}`}
                data-testid={`gallery-dot-${i}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
