import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useState } from "react";
import { Video, Trash2, Upload } from "lucide-react";
import { parseVideoUrl } from "@/lib/videoUrl";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineVideo: {
      /** Insert an inline video block at the current cursor position. */
      insertInlineVideo: (attrs: { url?: string; caption?: string }) => ReturnType;
    };
  }
}

// Marker class — also used by RichContent on the public article page
// to find these blocks and replace them with a real <VideoPlayer>.
export const INLINE_VIDEO_CLASS = "inline-video-block";

/**
 * TipTap block for an inline video. Stores the URL + optional caption
 * on data attributes; serialises to
 *
 *   <div class="inline-video-block" data-url="..." data-caption="..."></div>
 *
 * so the public RichContent renderer can swap it out for a real player.
 * In-editor node view shows a compact card with a URL input, an MP4
 * upload button, a caption field and a delete button — mirrors the
 * inline-gallery block's UX so editors don't have to learn a new
 * pattern.
 */
export const InlineVideoNode = Node.create({
  name: "inlineVideo",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-url") || "",
        renderHTML: (attrs) => ({ "data-url": attrs.url || "" }),
      },
      caption: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-caption") || "",
        renderHTML: (attrs) => ({ "data-caption": attrs.caption || "" }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div.${INLINE_VIDEO_CLASS}`,
        getAttrs: (el) => {
          const node = el as HTMLElement;
          if (!node.classList?.contains(INLINE_VIDEO_CLASS)) return false;
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: INLINE_VIDEO_CLASS })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineVideoNodeView);
  },

  addCommands() {
    return {
      insertInlineVideo:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { url: attrs.url || "", caption: attrs.caption || "" },
          }),
    };
  },
});

function InlineVideoNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const url: string = node.attrs.url || "";
  const caption: string = node.attrs.caption || "";
  const [uploading, setUploading] = useState(false);
  const parsed = url ? parseVideoUrl(url) : null;

  async function uploadFile(file: File) {
    setUploading(true);
    try {
      if (file.size > 200 * 1024 * 1024) {
        alert("Video is over the 200MB upload cap. Use YouTube/Vimeo for larger files.");
        return;
      }
      const fd = new FormData();
      fd.append("video", file);
      const res = await fetch("/api/media/upload-video", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.text()) || "Upload failed");
      const data = await res.json();
      if (data?.url) updateAttributes({ url: data.url });
    } catch (err: any) {
      console.error("inline video upload failed", err);
      alert(err?.message || "Video upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <NodeViewWrapper
      className="inline-video-editor"
      data-testid="inline-video-node"
      contentEditable={false}
    >
      <div className="border border-dashed border-border bg-muted/40 p-3 my-4 rounded space-y-2">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4" />
          <span
            style={{
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "hsl(0 0% 35%)",
            }}
          >
            Inline video
            {parsed && parsed.type !== "unknown"
              ? ` — ${parsed.type === "mp4" ? "MP4" : parsed.type}`
              : url
                ? " — unrecognised URL"
                : ""}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            className="text-xs flex items-center gap-1 px-2 py-1 border border-border hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => deleteNode()}
            data-testid="inline-video-delete"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        </div>

        <input
          type="url"
          placeholder="Paste a YouTube or Vimeo URL, or upload below"
          value={url}
          onChange={(e) => updateAttributes({ url: e.target.value })}
          className="w-full text-sm px-2 py-1.5 border border-border rounded bg-background"
          data-testid="inline-video-url"
        />

        <div className="flex items-center gap-2">
          <label
            className={`text-xs flex items-center gap-1 px-2 py-1 border border-border cursor-pointer ${
              uploading ? "opacity-60 pointer-events-none" : "hover:bg-background"
            }`}
          >
            <Upload className="w-3 h-3" />
            {uploading ? "Uploading…" : "Upload MP4"}
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile(f);
                e.target.value = "";
              }}
              data-testid="inline-video-file"
            />
          </label>
          <input
            type="text"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
            className="flex-1 text-sm px-2 py-1 border border-border rounded bg-background"
            data-testid="inline-video-caption"
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
