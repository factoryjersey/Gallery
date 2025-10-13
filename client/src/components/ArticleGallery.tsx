import { useEffect, useRef, useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface ArticleGalleryProps {
  content: string;
  className?: string;
}

export default function ArticleGallery({ content, className }: ArticleGalleryProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [slides, setSlides] = useState<{ src: string; alt?: string }[]>([]);

  useEffect(() => {
    if (!contentRef.current) return;

    const container = contentRef.current;
    const images = container.querySelectorAll('img');
    
    // Extract all images for lightbox
    const imageSlides: { src: string; alt?: string }[] = [];
    const imageMap = new Map<HTMLImageElement, number>();

    images.forEach((img, index) => {
      const src = img.getAttribute('src');
      if (src && !src.includes('data:image')) {
        imageSlides.push({
          src: src,
          alt: img.getAttribute('alt') || undefined
        });
        imageMap.set(img, imageSlides.length - 1);
      }
    });

    setSlides(imageSlides);

    // Add click handlers to images
    images.forEach((img) => {
      const index = imageMap.get(img);
      if (index !== undefined) {
        img.style.cursor = 'pointer';
        img.classList.add('hover:opacity-90', 'transition-opacity');
        
        const clickHandler = () => {
          setLightboxIndex(index);
          setLightboxOpen(true);
        };
        
        img.addEventListener('click', clickHandler);
        
        // Store the handler for cleanup
        (img as any)._clickHandler = clickHandler;
      }
    });

    // Detect consecutive images and wrap them in gallery grid
    const figures = container.querySelectorAll('figure.wp-block-image');
    let galleryGroup: HTMLElement[] = [];

    const wrapGallery = (group: HTMLElement[]) => {
      if (group.length < 3) return; // Only create galleries for 3+ consecutive images
      
      const galleryWrapper = document.createElement('div');
      galleryWrapper.className = 'gallery-grid grid grid-cols-2 md:grid-cols-3 gap-4 my-8';
      
      const firstFigure = group[0];
      firstFigure.parentNode?.insertBefore(galleryWrapper, firstFigure);
      
      group.forEach(figure => {
        galleryWrapper.appendChild(figure);
        figure.classList.add('m-0');
      });
    };

    figures.forEach((figure, index) => {
      const prevSibling = figure.previousElementSibling;
      const isConsecutive = prevSibling?.classList.contains('wp-block-image') || 
                           prevSibling?.classList.contains('gallery-grid');

      if (isConsecutive) {
        // Add to current gallery group if consecutive
        galleryGroup.push(figure as HTMLElement);
      } else {
        // Not consecutive - wrap current group if it exists, then start new group
        if (galleryGroup.length > 0) {
          wrapGallery(galleryGroup);
        }
        galleryGroup = [figure as HTMLElement];
      }

      // Handle last group
      if (index === figures.length - 1 && galleryGroup.length > 0) {
        wrapGallery(galleryGroup);
      }
    });

    // Cleanup on unmount
    return () => {
      images.forEach((img) => {
        const handler = (img as any)._clickHandler;
        if (handler) {
          img.removeEventListener('click', handler);
          delete (img as any)._clickHandler;
        }
      });
    };
  }, [content]);

  return (
    <>
      <div
        ref={contentRef}
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
        data-testid="article-content"
      />
      
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={slides}
        carousel={{ finite: false }}
        render={{
          buttonPrev: slides.length <= 1 ? () => null : undefined,
          buttonNext: slides.length <= 1 ? () => null : undefined,
        }}
      />
    </>
  );
}
