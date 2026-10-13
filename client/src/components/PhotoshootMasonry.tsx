import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import LazyImage from "@/components/LazyImage";

export interface PhotoshootMasonryImage {
  url: string;
  caption?: string;
}

interface Props {
  images: PhotoshootMasonryImage[];
  altPrefix?: string;
}

/**
 * Full-bleed masonry sibling to PhotoshootGrid. Same black-background
 * magazine-spread aesthetic (1px hairline gap, lightbox-on-click,
 * caption plugin for garment credits) but images render at their
 * natural aspect ratio via CSS columns — no square crop — so a shoot
 * mixing portrait and landscape frames flows naturally instead of
 * truncating one or both axes.
 *
 * Pick this when a photoshoot has mixed orientations and the uniform
 * square rhythm of PhotoshootGrid would hurt both the portraits
 * (cropped at ankles) AND the landscapes (cropped at the sides).
 * Reach for PhotoshootGrid when you've got a single orientation and
 * want the deliberate grid march.
 */
export default function PhotoshootMasonry({ images, altPrefix = "Photo" }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!images || images.length === 0) return null;

  return (
    <div className="bg-black" data-testid="photoshoot-masonry">
      {/* CSS columns give masonry flow at zero JS cost. Each child must
          be block-level with break-inside: avoid so a tall portrait
          doesn't get sliced across a column boundary. 1px gap matches
          PhotoshootGrid's hairline rhythm — the black background shows
          through the gap, no canvas colour leaks. */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-px">
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            type="button"
            className="block w-full relative overflow-hidden bg-black focus:outline-none focus:ring-2 focus:ring-white/40 group mb-px"
            style={{ breakInside: "avoid" }}
            onClick={() => {
              setIndex(i);
              setOpen(true);
            }}
            aria-label={`${altPrefix} ${i + 1}${img.caption ? `: ${img.caption}` : ""}`}
            data-testid={`photoshoot-masonry-tile-${i}`}
          >
            <LazyImage
              src={img.url}
              alt={img.caption || `${altPrefix} ${i + 1}`}
              className="block w-full h-auto object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
            />
          </button>
        ))}
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        // Caption is editorially-meaningful (garment credits + prices),
        // same reasoning as PhotoshootGrid — surface it as slide title
        // so it anchors to the bottom of the lightbox.
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
