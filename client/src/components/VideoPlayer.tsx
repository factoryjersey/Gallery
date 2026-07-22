import { parseVideoUrl } from "@/lib/videoUrl";

interface Props {
  /** The URL as stored on the article — YouTube/Vimeo watch URL, or a
   *  direct video-file URL. */
  url: string;
  /** Optional poster image for MP4 playback. YouTube/Vimeo use their
   *  own thumbnails; the poster is only wired to native <video>. */
  poster?: string;
  /** Accessible label — usually the article title or a caption. */
  title?: string;
  /** Optional inline styling override for the container. */
  className?: string;
}

/**
 * Universal video renderer. Picks the right delivery mechanism from
 * the URL:
 *
 *   - YouTube  → nocookie iframe with modest branding + suggested-video
 *                suppression once the visitor's stopped.
 *   - Vimeo    → player iframe with DNT flag set.
 *   - MP4/webm → native <video controls playsinline> with the
 *                supplied poster.
 *   - Unknown  → renders a plain link so we never silently swallow a
 *                video the editor added.
 *
 * All variants sit inside a 16:9 aspect-ratio box so the row height is
 * predictable (matches how the featured image slot behaves) and layout
 * doesn't shift when the video loads.
 */
export default function VideoPlayer({ url, poster, title, className = "" }: Props) {
  const parsed = parseVideoUrl(url);

  if (parsed.type === "unknown") {
    return (
      <div
        className={`bg-[hsl(0,0%,94%)] border border-border p-4 text-sm ${className}`}
        role="alert"
      >
        <p className="mb-1 font-semibold">Couldn't recognise this video URL.</p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline text-secondary break-all"
        >
          {url}
        </a>
      </div>
    );
  }

  if (parsed.type === "youtube" || parsed.type === "vimeo") {
    // rel=0 suppresses "suggested videos from other channels" at the
    // end; modestbranding=1 drops the YouTube watermark from the play
    // bar. Vimeo already applies its dnt param from the parser.
    const src =
      parsed.type === "youtube"
        ? `${parsed.embedUrl}?rel=0&modestbranding=1`
        : parsed.embedUrl!;
    return (
      <div
        className={`relative w-full overflow-hidden bg-black ${className}`}
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          src={src}
          title={title || "Video"}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    );
  }

  // Native mp4/webm/mov playback. controls attribute exposes the
  // standard browser UI (play/pause, seek, volume, fullscreen);
  // playsinline stops iOS Safari from hijacking the page into
  // fullscreen when the visitor hits play.
  return (
    <video
      className={`w-full h-auto bg-black ${className}`}
      controls
      playsInline
      preload="metadata"
      poster={poster}
      style={{ aspectRatio: "16 / 9", objectFit: "contain" }}
    >
      <source src={parsed.url} />
      Sorry, your browser doesn't support embedded video.
    </video>
  );
}
