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
  /** Skip the IntersectionObserver gate, mark fetchpriority="high",
   *  and disable native lazy-loading. Use for LCP candidates that
   *  must paint as fast as possible (homepage hero, splash slide). */
  priority?: boolean;
  /** Optional onLoad escape hatch — wraps over the internal loaded
   *  handler so callers can layer their own behaviour (e.g. swap a
   *  blur-up placeholder) without losing the .loaded class. */
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
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
  priority = false,
  onLoad,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  // Priority images skip the IntersectionObserver gate entirely — start
  // downloading on first paint.
  const [isInView, setIsInView] = useState(priority);
  const [hasErrored, setHasErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) return;
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
  }, [priority]);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    // Check if we're loading the real image (not the placeholder)
    // Use currentSrc to handle srcSet properly, or check if src doesn't match placeholder
    const currentSrc = e.currentTarget.currentSrc || e.currentTarget.src;
    const defaultPlaceholder = 'data:image/svg+xml';

    if (isInView && !currentSrc.startsWith(defaultPlaceholder)) {
      setIsLoaded(true);
    }
    onLoad?.(e);
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
      // Priority images opt out of native lazy-loading and ask the
      // browser to bump their fetch priority.
      loading={priority ? 'eager' : 'lazy'}
      // The fetchPriority React prop landed in 18.3; fall back to the
      // lowercase HTML attribute on older typings via JSX spread.
      {...({ fetchpriority: priority ? 'high' : 'auto' } as any)}
      decoding={priority ? 'sync' : 'async'}
      data-testid="lazy-image"
    />
  );
}
