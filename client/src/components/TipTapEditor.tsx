import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Image as ImageIcon,
  Images as ImagesIcon,
  FolderOpen,
  Undo,
  Redo,
} from "lucide-react";
import { InlineGalleryNode } from "@/components/InlineGalleryNode";
import MediaLibraryPicker from "@/components/MediaLibraryPicker";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Returns the uploaded image URL or null on failure. Reused for inline image insertion. */
  onUpload: (file: File) => Promise<string | null>;
}

/**
 * WYSIWYG block editor backed by TipTap/ProseMirror.
 *
 * Output is HTML so it drops straight into the existing `articles.content`
 * column — no migration needed for old WordPress-imported content; the
 * editor parses `<img>`, `<h2>`, `<blockquote>`, etc. natively.
 *
 * Inline image insertion uploads via the same /api/media/upload pipeline
 * the rest of the editor uses, then inserts an <img> node at the cursor.
 */
export default function TipTapEditor({ value, onChange, placeholder, onUpload }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Keep the StarterKit history; everything else default.
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: { class: "tiptap-image" },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer" },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start writing — use the toolbar to add headings, images, links…",
      }),
      InlineGalleryNode,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "tiptap-prose focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep editor content in sync when `value` changes externally (e.g.
  // when loading a different article). Avoid clobbering during normal typing
  // by only resetting when the incoming value differs from current HTML.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const insertImages = useCallback(async (files: FileList | File[]) => {
    if (!editor) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    // Upload sequentially and insert each at the current cursor position,
    // stacking them in selection order. Sequential keeps the inserted
    // order stable; parallel uploads can interleave when network varies.
    for (const file of list) {
      const url = await onUpload(file);
      if (!url) continue;
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    }
  }, [editor, onUpload]);

  const insertGalleryFromFiles = useCallback(async (files: FileList | File[]) => {
    if (!editor) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    const uploaded: { url: string }[] = [];
    for (const f of list) {
      const url = await onUpload(f);
      if (url) uploaded.push({ url });
    }
    if (uploaded.length === 0) return;
    editor.chain().focus().insertInlineGallery(uploaded).run();
  }, [editor, onUpload]);

  // Insert images selected from the media library — single image goes in as
  // <img>, multiple become an inline gallery block.
  const insertFromLibrary = useCallback((urls: string[]) => {
    if (!editor || urls.length === 0) return;
    if (urls.length === 1) {
      editor.chain().focus().setImage({ src: urls[0], alt: "" }).run();
    } else {
      editor.chain().focus().insertInlineGallery(urls.map((url) => ({ url }))).run();
    }
  }, [editor]);

  const promptForLink = useCallback(() => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", previous);
    if (url === null) return; // cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) return null;

  const btnBase =
    "h-8 w-8 inline-flex items-center justify-center hover:bg-accent rounded transition-colors";
  const active = (key: string, opts?: Record<string, unknown>) =>
    editor.isActive(key, opts) ? "bg-accent text-accent-foreground" : "";

  return (
    <div className="border border-input rounded-lg overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="bg-muted border-b border-border px-2 py-1.5 flex items-center gap-0.5 flex-wrap sticky top-0 z-10">
        <button type="button" className={`${btnBase} ${active("bold")}`} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (⌘B)" data-testid="tiptap-bold">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" className={`${btnBase} ${active("italic")}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (⌘I)" data-testid="tiptap-italic">
          <Italic className="h-4 w-4" />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button type="button" className={`${btnBase} ${active("heading", { level: 1 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Heading 1" data-testid="tiptap-h1">
          <Heading1 className="h-4 w-4" />
        </button>
        <button type="button" className={`${btnBase} ${active("heading", { level: 2 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" data-testid="tiptap-h2">
          <Heading2 className="h-4 w-4" />
        </button>
        <button type="button" className={`${btnBase} ${active("heading", { level: 3 })}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3" data-testid="tiptap-h3">
          <Heading3 className="h-4 w-4" />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button type="button" className={`${btnBase} ${active("bulletList")}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list" data-testid="tiptap-ul">
          <List className="h-4 w-4" />
        </button>
        <button type="button" className={`${btnBase} ${active("orderedList")}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list" data-testid="tiptap-ol">
          <ListOrdered className="h-4 w-4" />
        </button>
        <button type="button" className={`${btnBase} ${active("blockquote")}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote" data-testid="tiptap-quote">
          <Quote className="h-4 w-4" />
        </button>

        <span className="w-px h-5 bg-border mx-1" />

        <button type="button" className={`${btnBase} ${active("link")}`} onClick={promptForLink} title="Link" data-testid="tiptap-link">
          <LinkIcon className="h-4 w-4" />
        </button>
        <button type="button" className={btnBase} onClick={() => fileInputRef.current?.click()} title="Insert image(s) at cursor — pick one or more" data-testid="tiptap-image">
          <ImageIcon className="h-4 w-4" />
        </button>
        <button type="button" className={btnBase} onClick={() => galleryInputRef.current?.click()} title="Insert gallery at cursor" data-testid="tiptap-gallery">
          <ImagesIcon className="h-4 w-4" />
        </button>
        <button type="button" className={btnBase} onClick={() => setLibraryOpen(true)} title="Insert from media library" data-testid="tiptap-library">
          <FolderOpen className="h-4 w-4" />
        </button>

        <span className="flex-1" />

        <button type="button" className={btnBase} onClick={() => editor.chain().focus().undo().run()} title="Undo (⌘Z)" disabled={!editor.can().undo()}>
          <Undo className="h-4 w-4" />
        </button>
        <button type="button" className={btnBase} onClick={() => editor.chain().focus().redo().run()} title="Redo (⌘⇧Z)" disabled={!editor.can().redo()}>
          <Redo className="h-4 w-4" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              insertImages(e.target.files);
            }
            e.target.value = "";
          }}
          data-testid="tiptap-image-input"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              insertGalleryFromFiles(e.target.files);
            }
            e.target.value = "";
          }}
          data-testid="tiptap-gallery-input"
        />
      </div>

      {/* Editor surface */}
      <div className="px-4 py-3 min-h-[400px] max-h-[70vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Media library picker — opens via the library button in the toolbar */}
      <MediaLibraryPicker
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onInsert={insertFromLibrary}
      />
    </div>
  );
}
