/**
 * Video URL parsing for the article editor + public player.
 *
 * We accept three flavours:
 *   - YouTube: any watch/short/embed URL — extract the 11-char ID.
 *   - Vimeo:   any watch URL — extract the numeric ID.
 *   - Direct:  a URL ending in .mp4 / .webm / .mov (hosted on R2 or
 *              anywhere with a Content-Type video/*).
 *
 * A URL that matches none of the above is still returned as
 * type: "unknown" so callers can render a friendly error or fall back
 * to a plain link — we don't want to *lose* content just because the
 * URL shape is unusual.
 */

export type VideoType = "youtube" | "vimeo" | "mp4" | "unknown";

export interface ParsedVideo {
  type: VideoType;
  /** The original URL, verbatim. */
  url: string;
  /** Provider-specific video ID (YouTube 11-char slug, Vimeo digits).
   *  Undefined for direct-file URLs. */
  id?: string;
  /** Embed URL you can drop into an <iframe src>. Undefined for
   *  direct-file URLs (use a <video> element for those). */
  embedUrl?: string;
}

const YOUTUBE_PATTERNS = [
  // youtube.com/watch?v=ID (also youtu.be/ID)
  /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  // youtube.com/embed/ID
  /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,
  // youtube.com/shorts/ID
  /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,
  // youtube.com/v/ID (legacy)
  /youtube\.com\/v\/([A-Za-z0-9_-]{11})/i,
];

const VIMEO_PATTERN =
  // vimeo.com/12345678 or player.vimeo.com/video/12345678
  /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/i;

const DIRECT_FILE_EXT = /\.(mp4|webm|mov|m4v)(?:\?|#|$)/i;

export function parseVideoUrl(rawUrl: string): ParsedVideo {
  const url = rawUrl.trim();
  if (!url) return { type: "unknown", url };

  for (const pat of YOUTUBE_PATTERNS) {
    const m = url.match(pat);
    if (m) {
      const id = m[1];
      return {
        type: "youtube",
        url,
        id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      };
    }
  }

  const vm = url.match(VIMEO_PATTERN);
  if (vm) {
    const id = vm[1];
    return {
      type: "vimeo",
      url,
      id,
      // dnt=1 asks Vimeo not to track the viewer with third-party
      // cookies; Vimeo honours this flag on their own player.
      embedUrl: `https://player.vimeo.com/video/${id}?dnt=1`,
    };
  }

  if (DIRECT_FILE_EXT.test(url)) {
    return { type: "mp4", url };
  }

  return { type: "unknown", url };
}

/**
 * Provider-native thumbnail derived from the video ID. Used as the
 * poster for an <iframe>-embedded player until the visitor hits play.
 * Falls back to null for direct MP4s (use featuredImage instead).
 */
export function videoThumbnail(parsed: ParsedVideo): string | null {
  if (parsed.type === "youtube" && parsed.id) {
    // maxresdefault isn't always populated for older videos; hqdefault
    // is guaranteed. If the editor wants a sharper poster, they can
    // set featuredImage explicitly.
    return `https://i.ytimg.com/vi/${parsed.id}/hqdefault.jpg`;
  }
  return null;
}
