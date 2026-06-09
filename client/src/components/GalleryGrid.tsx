import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import LazyImage from "@/components/LazyImage";

export interface GalleryGridImage {
  url: string;
  caption?: string;
}

interface Props {
  images: GalleryGridImage[];
  altPrefix?: string;
  /** Tile columns at the lg breakpoint. Defaults to 4. */
  largeCols?: 3 | 4 | 5 | 6;
}

/**
 * Tiled grid of gallery images for paparazzi-style spreads (lots of small
 * thumbnails on the page; click any tile to open a lightbox). Designed for
 * gallery-type articles where a horizontal carousel would feel cramped
 * against 50+ photos.
 */
export default function GalleryGrid({ images, altPrefix = "Image", largeCols = 4 }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const lgClass =
    largeCols === 3
      ? "lg:grid-cols-3"
      : largeCols === 5
      ? "lg:grid-cols-5"
      : largeCols === 6
      ? "lg:grid-cols-6"
      : "lg:grid-cols-4";

  return (
    <div data-testid="gallery-grid">
      <div className={`grid grid-cols-2 sm:grid-cols-3 ${lgClass} gap-2 sm:gap-3`}>
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            className="relative block w-full overflow-hidden bg-[hsl(0,0%,8%)] focus:outline-none focus:ring-2 focus:ring-secondary"
            style={{ aspectRatio: "1 / 1" }}
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            aria-label={`${altPrefix} ${i + 1}${img.caption ? `: ${img.caption}` : ""}`}
            data-testid={`gallery-grid-tile-${i}`}
          >
            <LazyImage
              src={img.url}
              alt={img.caption || `${altPrefix} ${i + 1}`}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out hover:scale-[1.04]"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        slides={images.map((img, i) => ({
          src: img.url,
          alt: img.caption || `${altPrefix} ${i + 1}`,
          description: img.caption,
        }))}
        carousel={{ finite: false }}
      />
    </div>
  );
}
