import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import LazyImage from "@/components/LazyImage";

export interface PhotoshootGridImage {
  url: string;
  caption?: string;
}

interface Props {
  images: PhotoshootGridImage[];
  altPrefix?: string;
}

/**
 * Full-bleed 3-across image grid on a black background, intended for the
 * "photoshoot" article content type. Distinct from GalleryGrid in two
 * ways:
 *
 *  - Uses CSS grid (not columns) with square crops, so images sit on a
 *    consistent baseline instead of flowing masonry-style. The dramatic
 *    uniform rhythm is the whole point of the layout — a magazine spread,
 *    not a Pinterest board.
 *  - Background is hard black, gap is hairline (1px), and the grid runs
 *    to the viewport edge. The caller is responsible for putting this in
 *    a full-bleed parent (escape the article's max-width container).
 *
 * Click any tile to open a lightbox showing the original, uncropped
 * image. The crop is purely a layout-rhythm device.
 */
export default function PhotoshootGrid({ images, altPrefix = "Photo" }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  return (
    <div className="bg-black" data-testid="photoshoot-grid">
      {/* 1 col mobile, 2 col md, 3 col lg. 1px gap so each image gets a
          thin black hairline of separation without ever showing the
          canvas through it. */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px">
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            className="relative block w-full overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-white/40 group"
            style={{ aspectRatio: "1 / 1" }}
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            aria-label={`${altPrefix} ${i + 1}${img.caption ? `: ${img.caption}` : ""}`}
            data-testid={`photoshoot-grid-tile-${i}`}
          >
            <LazyImage
              src={img.url}
              alt={img.caption || `${altPrefix} ${i + 1}`}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        // For photoshoots the caption IS the value — it lists what's in
        // the picture (clothing credits, brands, prices). Show it as the
        // slide title so it sits prominently at the bottom of the lightbox
        // rather than vanishing as a debug-only description.
        slides={images.map((img, i) => ({
          src: img.url,
          alt: img.caption || `${altPrefix} ${i + 1}`,
          title: img.caption,
        }))}
        plugins={[Captions]}
        captions={{ descriptionTextAlign: "center" }}
        carousel={{ finite: false }}
      />
    </div>
  );
}
