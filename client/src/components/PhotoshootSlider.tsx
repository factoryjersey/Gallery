import { useEffect, useMemo, useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { ChevronLeft, ChevronRight } from "lucide-react";

function extractImages(html: string): { src: string; alt: string }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));
  return imgs
    .map((img) => ({ src: img.getAttribute("src") || "", alt: img.getAttribute("alt") || "" }))
    .filter((img) => img.src && !img.src.startsWith("data:"));
}

interface Props {
  /** Article featured_image (prepended to gallery). */
  hero?: string | null;
  /** Article body HTML — additional images extracted from <img> tags. */
  content: string;
  altPrefix?: string;
}

export default function PhotoshootSlider({ hero, content, altPrefix = "Photo" }: Props) {
  const images = useMemo(() => {
    const fromBody = extractImages(content || "");
    const all: { src: string; alt: string }[] = [];
    if (hero && !fromBody.some((i) => i.src === hero)) all.push({ src: hero, alt: altPrefix });
    all.push(...fromBody);
    return all;
  }, [hero, content, altPrefix]);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onKey = (e: KeyboardEvent) => {
      if (lightboxOpen) return;
      if (e.key === "ArrowLeft") scrollPrev();
      else if (e.key === "ArrowRight") scrollNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [emblaApi, lightboxOpen, scrollPrev, scrollNext]);

  if (images.length === 0) return null;

  const slides = images.map((img) => ({ src: img.src, alt: img.alt }));

  return (
    <div className="w-full bg-[hsl(0,0%,4%)]" data-testid="photoshoot-slider">
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {images.map((img, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0">
                <button
                  onClick={() => setLightboxOpen(true)}
                  className="block w-full bg-[hsl(0,0%,4%)] focus:outline-none cursor-zoom-in"
                  style={{ height: "min(85vh, 900px)" }}
                  data-testid={`slide-${i}`}
                  aria-label={`Open ${img.alt || "image"} fullscreen`}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="w-full h-full object-contain"
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Prev / next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={scrollPrev}
              aria-label="Previous"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-foreground p-2 rounded-full shadow-lg transition-colors disabled:opacity-30"
              disabled={index === 0}
              data-testid="slider-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={scrollNext}
              aria-label="Next"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-foreground p-2 rounded-full shadow-lg transition-colors disabled:opacity-30"
              disabled={index === images.length - 1}
              data-testid="slider-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Counter pill */}
        {images.length > 1 && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 px-3 py-1 rounded-full"
            style={{ fontFamily: "Arial, sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "hsl(0 0% 4%)" }}
            data-testid="slider-counter"
          >
            {index + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="max-w-[1296px] mx-auto px-6 py-4">
          <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "thin" }}>
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`shrink-0 transition-all ${
                  i === index ? "ring-2 ring-[hsl(182_55%_56%)] opacity-100" : "opacity-60 hover:opacity-100"
                }`}
                style={{ width: 60, height: 60 }}
                aria-label={`Go to image ${i + 1}`}
                data-testid={`thumb-${i}`}
              >
                <img src={img.src} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={slides}
        index={index}
        on={{ view: ({ index: i }) => setIndex(i) }}
      />
    </div>
  );
}
