import { useEffect, useRef, useState, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface PaparazziGalleryProps {
  content: string;
}

function extractImages(html: string): { src: string; alt: string }[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const imgs = Array.from(doc.querySelectorAll("img"));
  return imgs
    .map(img => ({ src: img.getAttribute("src") || "", alt: img.getAttribute("alt") || "" }))
    .filter(img => img.src && !img.src.startsWith("data:"));
}

export default function PaparazziGallery({ content }: PaparazziGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const images = useMemo(() => extractImages(content), [content]);
  const slides = images.map(img => ({ src: img.src, alt: img.alt }));

  if (images.length === 0) return null;

  return (
    <>
      {/* Full-bleed photo grid */}
      <div className="-mx-6 mt-2">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
          {images.map((img, i) => (
            <button
              key={i}
              className="block w-full overflow-hidden bg-[hsl(0,0%,10%)] focus:outline-none group"
              style={{ aspectRatio: "3/2" }}
              onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
              data-testid={`gallery-img-${i}`}
            >
              <img
                src={img.src}
                alt={img.alt}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
            </button>
          ))}
        </div>

        {/* Photo count label */}
        <p className="mt-3 px-6 text-right" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "hsl(0 0% 55%)" }}>
          {images.length} photos — click to open
        </p>
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        carousel={{ finite: false }}
      />
    </>
  );
}
