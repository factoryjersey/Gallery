import { useMemo } from "react";
import GalleryCarousel from "@/components/GalleryCarousel";
import ArticleGallery from "@/components/ArticleGallery";
import VideoPlayer from "@/components/VideoPlayer";

interface Segment {
  type: "html" | "gallery" | "video";
  html?: string;
  images?: { url: string; caption?: string }[];
  video?: { url: string; caption?: string };
}

/**
 * Split the article HTML into a stream of "plain HTML" segments + inline
 * gallery / video blocks. Inline markers:
 *
 *   <div class="inline-gallery-block" data-images="…">
 *   <div class="inline-video-block"   data-url="…" data-caption="…">
 *
 * are authored via the TipTap editor's gallery/video buttons; everything
 * else stays as the original HTML (rendered through ArticleGallery,
 * which still handles image-lightbox and figure-grouping for legacy
 * content).
 */
function parseSegments(content: string): Segment[] {
  if (typeof window === "undefined" || !content) {
    return content ? [{ type: "html", html: content }] : [];
  }
  const doc = new DOMParser().parseFromString(
    `<div id="rc-root">${content}</div>`,
    "text/html",
  );
  const root = doc.getElementById("rc-root");
  if (!root) return [{ type: "html", html: content }];

  const segments: Segment[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const html = buffer.join("").trim();
    if (html) segments.push({ type: "html", html });
    buffer = [];
  };

  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === 1) {
      const el = node as Element;
      if (el.classList?.contains("inline-gallery-block")) {
        flush();
        const raw = el.getAttribute("data-images") || "[]";
        try {
          const images = JSON.parse(raw);
          if (Array.isArray(images) && images.length > 0) {
            segments.push({ type: "gallery", images });
          }
        } catch {
          /* malformed JSON — drop the placeholder silently */
        }
        continue;
      }
      if (el.classList?.contains("inline-video-block")) {
        flush();
        const url = el.getAttribute("data-url") || "";
        const caption = el.getAttribute("data-caption") || "";
        if (url) segments.push({ type: "video", video: { url, caption } });
        continue;
      }
      buffer.push((el as HTMLElement).outerHTML);
    } else if (node.nodeType === 3) {
      buffer.push(node.nodeValue || "");
    }
  }
  flush();
  return segments;
}

interface Props {
  content: string;
  className?: string;
}

export default function RichContent({ content, className }: Props) {
  const segments = useMemo(() => parseSegments(content), [content]);

  // Fast path: no inline galleries or videos — render straight through
  // ArticleGallery so legacy content is byte-identical to before this
  // component existed.
  if (
    segments.length <= 1 &&
    segments[0]?.type !== "gallery" &&
    segments[0]?.type !== "video"
  ) {
    return <ArticleGallery content={content} className={className} />;
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "gallery" && seg.images) {
          return (
            <div key={i} className="my-8 -mx-6 sm:mx-0">
              <GalleryCarousel images={seg.images} altPrefix="Inline gallery image" />
            </div>
          );
        }
        if (seg.type === "video" && seg.video) {
          return (
            <figure key={i} className="my-8 -mx-6 sm:mx-0">
              <VideoPlayer url={seg.video.url} title={seg.video.caption} />
              {seg.video.caption && (
                <figcaption
                  className="mt-2 px-6 sm:px-0"
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 14,
                    lineHeight: 1.5,
                    fontStyle: "italic",
                    color: "hsl(0 0% 40%)",
                  }}
                >
                  {seg.video.caption}
                </figcaption>
              )}
            </figure>
          );
        }
        return (
          <ArticleGallery key={i} content={seg.html || ""} className={className} />
        );
      })}
    </>
  );
}
