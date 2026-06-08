import { useMemo } from "react";
import GalleryCarousel from "@/components/GalleryCarousel";
import ArticleGallery from "@/components/ArticleGallery";

interface Segment {
  type: "html" | "gallery";
  html?: string;
  images?: { url: string; caption?: string }[];
}

/**
 * Split the article HTML into a stream of "plain HTML" segments + inline
 * gallery blocks. Inline gallery markers are top-level
 * `<div class="inline-gallery-block" data-images="…">` placeholders
 * authored via the TipTap editor's gallery button; everything else stays
 * as the original HTML (rendered through ArticleGallery, which still
 * handles image-lightbox and figure-grouping for legacy content).
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

  // Fast path: no inline galleries — render straight through ArticleGallery
  // so legacy content is byte-identical to before this component existed.
  if (segments.length <= 1 && segments[0]?.type !== "gallery") {
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
        return (
          <ArticleGallery key={i} content={seg.html || ""} className={className} />
        );
      })}
    </>
  );
}
