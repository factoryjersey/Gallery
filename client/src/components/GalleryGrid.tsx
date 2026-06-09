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
}

/**
 * Masonry-style image grid for paparazzi / events / large article galleries.
 * Three columns on desktop, two on tablet, one on mobile. Images keep their
 * natural aspect ratio — no cropping — laid out via CSS `columns` so taller
 * portrait shots don't force their row to letterbox. Click any tile to open
 * the lightbox.
 */
export default function GalleryGrid({ images, altPrefix = "Image" }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  return (
    <div data-testid="gallery-grid">
      {/* CSS columns give masonry flow at zero JS cost. Each child must be
          inline-block (or block + break-inside: avoid) so it doesn't get
          split across columns. */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 sm:gap-4">
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            className="block w-full overflow-hidden bg-[hsl(0,0%,8%)] focus:outline-none focus:ring-2 focus:ring-secondary mb-3 sm:mb-4 group"
            style={{ breakInside: "avoid" }}
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
              className="block w-full h-auto transition-transform duration-500 ease-out group-hover:scale-[1.02]"
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
