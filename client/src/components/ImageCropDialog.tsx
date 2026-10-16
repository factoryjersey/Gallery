import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Props {
  /** The file the user just picked. Read into a data URL for the crop preview.
   *  When null, the dialog stays closed. */
  file: File | null;
  /** Called with the cropped PNG/JPEG Blob ready to upload. */
  onCropped: (blob: Blob, originalName: string) => void;
  /** Cancel / dismiss — discards the chosen file. */
  onCancel: () => void;
  /** Aspect the crop box opens at (null = Free). Defaults to 5:4. Set per
   *  image slot so the guide matches where the image will be shown. */
  defaultAspect?: number | null;
  /** Optional heading + one-line note naming the slot being cropped,
   *  e.g. "Homepage tile — square". */
  title?: string;
  hint?: string;
  /** Position in a multi-crop sequence (one upload → several slot crops).
   *  Shows "Step n of total" and labels Apply as "Apply & next". */
  step?: { index: number; total: number };
  /** When set, shows a Skip button that moves past this crop without
   *  producing an image. */
  onSkip?: () => void;
  skipLabel?: string;
}

// Aspect ratio presets. 5:4 landscape is the default per editorial brief
// (cropping portraits to a slightly-wider-than-square ratio so featured
// thumbnails sit consistently). "Free" disables the lock for unusual
// pictures where none of the presets fit.
const PRESETS: Array<{ label: string; value: number | null; hint: string }> = [
  { label: "5 × 4", value: 5 / 4, hint: "Landscape — default for portraits" },
  { label: "4 × 5", value: 4 / 5, hint: "Tall portrait crop" },
  { label: "1 × 1", value: 1, hint: "Square — homepage tiles" },
  { label: "3 × 2", value: 3 / 2, hint: "Current-issue cards" },
  { label: "16 × 9", value: 16 / 9, hint: "Wide / banner" },
  { label: "21 × 9", value: 21 / 9, hint: "Homepage slideshow band" },
  { label: "Free", value: null, hint: "Any aspect ratio" },
];

const DEFAULT_ASPECT = 5 / 4;

/**
 * Centred initial crop spanning ~90% of the smaller axis at the desired
 * aspect, so the user lands on a sensible starting region rather than a
 * tiny corner box.
 */
function makeInitialCrop(width: number, height: number, aspect: number | null): Crop {
  if (aspect == null) {
    return centerCrop(
      { unit: "%" as const, width: 90, height: 90, x: 5, y: 5 },
      width,
      height,
    );
  }
  return centerCrop(
    makeAspectCrop({ unit: "%" as const, width: 90 }, aspect, width, height),
    width,
    height,
  );
}

/**
 * Modal cropping tool used by the article editor's image inputs. Wraps
 * react-image-crop with a small set of aspect-ratio presets and a
 * canvas-based renderer that converts the chosen region into a JPEG
 * Blob, ready to drop straight into the existing /api/media/upload
 * pipeline.
 *
 * Why client-side: gives the editor immediate feedback (slider, drag,
 * presets) without uploading the full original first. The server still
 * receives the cropped JPEG as a normal file upload, so all the existing
 * sharp-based variant generation continues to apply to the cropped
 * result.
 */
export default function ImageCropDialog({
  file,
  onCropped,
  onCancel,
  defaultAspect = DEFAULT_ASPECT,
  title = "Crop image",
  hint = "Drag the handles to set the crop, switch aspect ratio below.",
  step,
  onSkip,
  skipLabel = "Skip",
}: Props) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop | undefined>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [aspect, setAspect] = useState<number | null>(defaultAspect);
  const [processing, setProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load the file as a data URL for the crop preview. Cleanup when the
  // dialog closes so we don't leak object URLs across opens.
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      setCrop(undefined);
      setCompletedCrop(null);
      return;
    }
    // Each open starts on the slot's own guide, not whatever ratio the
    // previous crop was left on.
    setAspect(defaultAspect);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }, [file, defaultAspect]);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const initial = makeInitialCrop(width, height, aspect);
      setCrop(initial);
      // Seed completedCrop too, so the starting box can be applied
      // without having to nudge a handle first.
      setCompletedCrop(convertToPixelCrop(initial, width, height));
    },
    [aspect],
  );

  // Switching aspect — re-seed the crop to a centred 90% box at the new
  // ratio so the user doesn't end up with a tiny leftover selection.
  const handleAspectChange = (value: number | null) => {
    setAspect(value);
    const img = imgRef.current;
    if (img) {
      const next = makeInitialCrop(img.width, img.height, value);
      setCrop(next);
      setCompletedCrop(convertToPixelCrop(next, img.width, img.height));
    }
  };

  const handleApply = async () => {
    if (!completedCrop || !imgRef.current || !file) return;
    setProcessing(true);
    try {
      // Render the cropped region to a canvas at the image's natural
      // resolution (not the display resolution) so we don't downscale
      // the result. JPEG quality 0.92 mirrors typical magazine-export
      // settings — a fair compromise between size and quality.
      const img = imgRef.current;
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const sx = completedCrop.x * scaleX;
      const sy = completedCrop.y * scaleY;
      const sw = completedCrop.width * scaleX;
      const sh = completedCrop.height * scaleY;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(sw);
      canvas.height = Math.round(sh);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Couldn't get a 2D canvas context");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("Couldn't encode the cropped image");
      onCropped(blob, file.name);
    } finally {
      setProcessing(false);
    }
  };

  if (!file || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      data-testid="image-crop-dialog"
    >
      <div className="bg-background rounded-md shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        <header className="px-5 py-3 border-b border-border flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold leading-tight">{title}</h3>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map((p) => {
              const active = aspect === p.value;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleAspectChange(p.value)}
                  title={p.hint}
                  className={`px-2.5 py-1 text-xs font-medium border rounded transition-colors ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background hover:bg-accent border-border"
                  }`}
                  data-testid={`crop-aspect-${p.label.replace(/\s/g, "")}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </header>

        <div className="flex-1 overflow-auto p-5 bg-[hsl(0,0%,12%)] flex items-center justify-center min-h-0">
          <ReactCrop
            crop={crop}
            onChange={(_, percent) => setCrop(percent)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={aspect ?? undefined}
            keepSelection
            className="max-h-[65vh]"
          >
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
              ref={imgRef}
              src={imageSrc}
              onLoad={onImageLoad}
              alt=""
              style={{ maxHeight: "65vh", maxWidth: "100%" }}
            />
          </ReactCrop>
        </div>

        <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
          {step && step.total > 1 && (
            <span className="mr-auto text-xs text-muted-foreground" data-testid="crop-step">
              Step {step.index} of {step.total}
            </span>
          )}
          <Button type="button" variant="ghost" onClick={onCancel} disabled={processing}>
            Cancel
          </Button>
          {onSkip && (
            <Button
              type="button"
              variant="outline"
              onClick={onSkip}
              disabled={processing}
              data-testid="crop-skip"
            >
              {skipLabel}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleApply}
            disabled={!completedCrop || processing}
            data-testid="crop-apply"
          >
            {processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cropping…
              </>
            ) : (
              step && step.index < step.total ? "Apply & next" : "Apply crop"
            )}
          </Button>
        </footer>
      </div>
    </div>
  );
}
