import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useRef } from "react";
import { Images, Plus, Trash2 } from "lucide-react";

// Per-image shape stored on the node attribute and serialized as JSON in
// the HTML output (`data-images`).
export interface InlineGalleryImage {
  url: string;
  caption?: string;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    inlineGallery: {
      /** Insert an inline gallery block at the current cursor position. */
      insertInlineGallery: (images: InlineGalleryImage[]) => ReturnType;
    };
  }
}

// Marker class — also used by the public article page to find these blocks
// and replace them with a real <GalleryCarousel>.
export const INLINE_GALLERY_CLASS = "inline-gallery-block";

/**
 * TipTap node for an inline image gallery (Wordpress-style gutenberg gallery).
 * Renders in-editor as a thumbnail strip with "Add more" / "Remove" controls;
 * serialises to HTML as `<div class="inline-gallery-block" data-images="…">`
 * so the public article page can swap it for a sliding <GalleryCarousel>.
 */
export const InlineGalleryNode = Node.create({
  name: "inlineGallery",
  group: "block",
  atom: true,                 // Single unit — the user can't move cursor inside
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [] as InlineGalleryImage[],
        parseHTML: (el) => {
          const raw = (el as HTMLElement).getAttribute("data-images") || "[]";
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          "data-images": JSON.stringify(attrs.images || []),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div.${INLINE_GALLERY_CLASS}`,
        getAttrs: (el) => {
          const node = el as HTMLElement;
          if (!node.classList?.contains(INLINE_GALLERY_CLASS)) return false;
          return null;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { class: INLINE_GALLERY_CLASS })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InlineGalleryNodeView);
  },

  addCommands() {
    return {
      insertInlineGallery:
        (images) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { images },
          }),
    };
  },
});

function InlineGalleryNodeView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  const images = (node.attrs.images || []) as InlineGalleryImage[];
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadAndAppend(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    const added: InlineGalleryImage[] = [];
    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        if (!res.ok) continue;
        const data = await res.json();
        const url =
          data.media?.urls?.original || data.media?.variants?.original || data.media?.objectPath;
        if (url) added.push({ url });
      } catch (err) {
        console.error("inline gallery upload failed", err);
      }
    }
    if (added.length > 0) {
      updateAttributes({ images: [...images, ...added] });
    }
  }

  function removeAt(i: number) {
    const next = images.filter((_, idx) => idx !== i);
    updateAttributes({ images: next });
  }

  return (
    <NodeViewWrapper
      className="inline-gallery-editor"
      data-testid="inline-gallery-node"
      contentEditable={false}
    >
      <div className="border border-dashed border-border bg-muted/40 p-3 my-4 rounded">
        <div className="flex items-center gap-2 mb-2">
          <Images className="w-4 h-4" />
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
            Inline gallery — {images.length} image{images.length === 1 ? "" : "s"}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            className="text-xs flex items-center gap-1 px-2 py-1 border border-border hover:bg-background"
            onClick={() => fileRef.current?.click()}
            data-testid="inline-gallery-add"
          >
            <Plus className="w-3 h-3" />
            Add images
          </button>
          <button
            type="button"
            className="text-xs flex items-center gap-1 px-2 py-1 border border-border hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => deleteNode()}
            data-testid="inline-gallery-delete"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        </div>

        {images.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            No images yet — click "Add images" to upload.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {images.map((img, i) => (
              <div key={`${img.url}-${i}`} className="relative group">
                <img
                  src={img.url}
                  alt={img.caption || ""}
                  className="w-full h-20 object-cover border border-border"
                />
                <button
                  type="button"
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAt(i)}
                  title="Remove image"
                  data-testid={`inline-gallery-remove-${i}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) uploadAndAppend(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </NodeViewWrapper>
  );
}
