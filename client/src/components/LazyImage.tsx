import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  placeholderSrc?: string;
}

export default function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  srcSet,
  sizes,
  placeholderSrc,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasErrored, setHasErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current) return;

    // Fallback for browsers without IntersectionObserver
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Check if we're loading the real image (not the placeholder)
    // Use currentSrc to handle srcSet properly, or check if src doesn't match placeholder
    const currentSrc = e.currentTarget.currentSrc || e.currentTarget.src;
    const defaultPlaceholder = 'data:image/svg+xml';
    
    if (isInView && !currentSrc.startsWith(defaultPlaceholder)) {
      setIsLoaded(true);
    }
  };

  // Generate a tiny blur placeholder (base64 encoded 1x1 transparent pixel)
  const defaultPlaceholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3Crect fill="%23e5e7eb" width="1" height="1"/%3E%3C/svg%3E';

  if (hasErrored) {
    return (
      <div
        className={`${className} bg-[hsl(0,0%,92%)]`}
        data-testid="lazy-image-error"
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholderSrc || defaultPlaceholder}
      srcSet={isInView && srcSet ? srcSet : undefined}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      className={`lazy-image ${isLoaded ? 'loaded' : ''} ${className}`}
      onLoad={handleLoad}
      onError={() => setHasErrored(true)}
      loading="lazy" // Native lazy loading as fallback
      data-testid="lazy-image"
    />
  );
}
