import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import LazyImage from "@/components/LazyImage";

export interface EventsGridImage {
  url: string;
  caption?: string;
}

interface Props {
  images: EventsGridImage[];
  altPrefix?: string;
}

/**
 * Event-coverage grid: 3-across square thumbnails with the caption
 * rendered directly below each photo.
 *
 * Used for the "events" category, where each picture is typically a
 * named group of attendees ("Mary Smith, John Brown, Anna Le Brun") —
 * the caption isn't decorative metadata, it's the *content*. Hiding it
 * in a lightbox defeats the purpose, so it sits visible under the tile.
 *
 * Contrast with siblings:
 *  - PhotoshootGrid: same rhythm, but black canvas + captions only in
 *    the lightbox (fashion-shoot mood pieces).
 *  - GalleryGrid: masonry (uncropped) + captions in lightbox only —
 *    for paparazzi and large editorial galleries where the photo
 *    composition matters more than the credit line.
 *
 * Clicking any tile opens the standard yet-another-react-lightbox with
 * the Captions plugin so the same caption is also visible at full size.
 */
export default function EventsGrid({ images, altPrefix = "Photo" }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  return (
    <div data-testid="events-grid">
      {/* 1 col mobile, 2 col md, 3 col lg. Generous gap so each tile
          reads as its own beat — caption + photo as a single unit. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {images.map((img, i) => (
          <figure key={`${img.url}-${i}`} className="flex flex-col gap-3">
            <button
              type="button"
              className="relative block w-full overflow-hidden bg-[hsl(0,0%,94%)] focus:outline-none focus:ring-2 focus:ring-secondary group"
              style={{ aspectRatio: "1 / 1" }}
              onClick={() => {
                setIndex(i);
                setOpen(true);
              }}
              aria-label={`${altPrefix} ${i + 1}${img.caption ? `: ${img.caption}` : ""}`}
              data-testid={`events-grid-tile-${i}`}
            >
              <LazyImage
                src={img.url}
                alt={img.caption || `${altPrefix} ${i + 1}`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
            </button>
            {img.caption && (
              <figcaption
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                  lineHeight: 1.45,
                  fontStyle: "italic",
                  color: "hsl(0 0% 35%)",
                  margin: 0,
                }}
              >
                {img.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
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
