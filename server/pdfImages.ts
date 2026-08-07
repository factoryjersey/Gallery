import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import os from "os";
import sharp from "sharp";
import { uploadToR2 } from "./r2Client";

const execFileP = promisify(execFile);

/**
 * Fetch a PDF from an R2 URL to a fresh temp directory and return its
 * on-disk path. The caller is responsible for `rm`-ing the directory
 * afterwards. Kept in tmp because pdfimages only knows how to read
 * from disk.
 */
async function fetchPdfToTmp(pdfUrl: string): Promise<{ dir: string; pdfPath: string }> {
  const res = await fetch(pdfUrl);
  if (!res.ok) throw new Error(`PDF fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const dir = await mkdtemp(path.join(os.tmpdir(), "gallery-pdf-"));
  const pdfPath = path.join(dir, "input.pdf");
  await writeFile(pdfPath, buf);
  return { dir, pdfPath };
}

/** Result of one extracted image after upload. */
export interface ExtractedPdfImage {
  /** Absolute R2 URL. */
  url: string;
  /** 1-indexed PDF page the image was extracted from. */
  page: number;
  /** Ordinal within the page (0-based). Two images on the same page keep
   *  their original ordering, which matches visual reading order for
   *  most magazine layouts. */
  seq: number;
  width: number;
  height: number;
  /** Serialized size in bytes (post-encoding, pre-R2). */
  bytes: number;
}

interface ExtractOptions {
  /** Skip images smaller than this on either axis. Filters out decorative
   *  icons / rules / spacer graphics that pdfimages happily includes but
   *  the editor doesn't want. */
  minWidth?: number;
  minHeight?: number;
  /** Skip images below this final byte size. Backstop for images that
   *  pass the pixel filter but are still tiny (blurred low-res PDF
   *  thumbnails, for example). */
  minBytes?: number;
  /** Optional issue number — used to scope the R2 key so extracts group
   *  together in the bucket (`pdf-extracts/issue-8/...`). */
  issueNumber?: number | null;
  /** When true, drop the aggressive dimension / byte filters and pull
   *  effectively everything raster. Use for photo sections
   *  (fashion shoots, paparazzi, events) where the whole point is
   *  visual and even small crops matter — editor prunes decorative
   *  junk from the thumbnail grid. */
  loose?: boolean;
}

// Loosened after real-world use: 400×400 was catching too many
// legitimate small photos (crop-outs, sidebar portraits, product
// shots). 250×250 still filters obvious decorative icons and rule
// graphics but lets more real content through — the editor can
// untick any decorative junk with one click in the thumbnail grid.
const DEFAULT_MIN_WIDTH = 250;
const DEFAULT_MIN_HEIGHT = 250;
const DEFAULT_MIN_BYTES = 15 * 1024;

// Photo-section extraction (fashion shoots, paparazzi, events) pulls
// everything visual — filters are only there to reject obvious 1px
// separators and near-empty images. Editor prunes junk from the
// thumbnail grid.
const LOOSE_MIN_WIDTH = 100;
const LOOSE_MIN_HEIGHT = 100;
const LOOSE_MIN_BYTES = 4 * 1024;

/**
 * Extract every embedded image from a PDF page range, upload each to
 * R2, and return the list in page + reading order. Runs `pdfimages`
 * once per page so we can attribute images to pages accurately — the
 * bulk `pdfimages -f X -l Y` doesn't emit per-file page metadata that
 * we could parse.
 *
 * Small / decorative images are filtered out via the min-dimension +
 * min-bytes thresholds; magazines carry a lot of vector-based rule
 * lines and pull-quote quotemarks that pdfimages happily reports as
 * standalone JPEGs of ~150x30, none of which we want.
 *
 * All uploaded objects use the standard R2 uploadToR2 helper, so the
 * cache-control header and content-type flow through the same way as
 * every other upload.
 */
export async function extractImagesFromPageRange(
  pdfUrl: string,
  pageRange: [number, number],
  opts: ExtractOptions = {},
): Promise<ExtractedPdfImage[]> {
  const [startPage, endPage] = pageRange;
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) {
    throw new Error("pageRange must be [start, end] with 1-indexed integer pages, start <= end");
  }
  if (endPage - startPage > 40) {
    // Sanity guard — a magazine article probably isn't 40 pages, and
    // this stops a runaway request pulling hundreds of images.
    throw new Error("pageRange too wide — extract at most 40 pages at once");
  }

  // Loose mode swaps in the photo-section defaults. Explicit
  // opts.min* still wins so callers can force specific thresholds.
  const minWidth = opts.minWidth ?? (opts.loose ? LOOSE_MIN_WIDTH : DEFAULT_MIN_WIDTH);
  const minHeight = opts.minHeight ?? (opts.loose ? LOOSE_MIN_HEIGHT : DEFAULT_MIN_HEIGHT);
  const minBytes = opts.minBytes ?? (opts.loose ? LOOSE_MIN_BYTES : DEFAULT_MIN_BYTES);
  const issueSlug = opts.issueNumber
    ? `issue-${opts.issueNumber}`
    : "unassigned";
  const stamp = Date.now();

  const { dir, pdfPath } = await fetchPdfToTmp(pdfUrl);
  const uploaded: ExtractedPdfImage[] = [];
  try {
    for (let page = startPage; page <= endPage; page++) {
      const pagePrefix = path.join(dir, `p${page}`);
      // -all: emit each embedded image in its native format when known
      //       (JPEG → .jpg, PNG → .png, otherwise .ppm/.pbm/.tif).
      // -f/-l on the same page number: single-page scope, so filenames
      //       like `p12-000.jpg` are unambiguously from that page.
      try {
        await execFileP("pdfimages", [
          "-all",
          "-f", String(page),
          "-l", String(page),
          pdfPath,
          pagePrefix,
        ]);
      } catch (err: any) {
        // A page with no extractable images makes pdfimages exit
        // silently in most cases, but if it errors we'd rather skip
        // the page than abort the whole range.
        console.warn(`pdfimages page ${page} failed:`, err?.message || err);
        continue;
      }

      const files = (await readdir(dir))
        .filter((f) => f.startsWith(`p${page}-`))
        .sort();
      let seq = 0;
      for (const file of files) {
        const filePath = path.join(dir, file);
        const original = await readFile(filePath);
        // Re-encode non-JPEG formats to JPEG so the delivered gallery is
        // predictably-sized and browser-cheap. sharp also gives us
        // dimension filtering without a second dependency.
        let out: Buffer;
        let contentType = "image/jpeg";
        let ext = "jpg";
        try {
          const meta = await sharp(original).metadata();
          if (!meta.width || !meta.height) continue;
          if (meta.width < minWidth && meta.height < minHeight) {
            // Small on both axes → decorative rule / icon / etc. Drop.
            continue;
          }
          if (file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg")) {
            // Already JPEG — keep bytes as-is (better fidelity than a
            // re-encode; pdfimages emits the original stream verbatim).
            out = original;
          } else {
            // PNG / PPM / TIF → JPEG at quality 88 with mozjpeg.
            out = await sharp(original).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
            ext = "jpg";
          }
          if (out.length < minBytes) continue;
          const key = `pdf-extracts/${issueSlug}/${stamp}-p${page}-${seq}.${ext}`;
          const url = await uploadToR2(out, key, contentType);
          uploaded.push({
            url,
            page,
            seq,
            width: meta.width,
            height: meta.height,
            bytes: out.length,
          });
          seq++;
        } catch (err: any) {
          console.warn(`Skipping ${file}: ${err?.message || err}`);
          continue;
        }
      }
    }
    return uploaded;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
