// Feature-image import: helpers for browsing the InDesign packaged folders
// on Google Drive and attaching their images to existing articles.
//
// Filesystem access required (Google Drive must be mounted), so this is a
// local-dev workflow. Production won't have the Drive paths mounted.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import {
  PutObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { r2Client, uploadToR2 } from "./r2Client";

const ARCHIVE_ROOT =
  process.env.GALLERY_ARCHIVE_ROOT ||
  "/Users/minchin/Library/CloudStorage/GoogleDrive-ben@factory.je/My Drive/publications/gallery archive";

const R2_BUCKET = process.env.R2_BUCKET_NAME || "gallery-media";
const R2_PUBLIC =
  (process.env.R2_PUBLIC_URL || "https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev").replace(
    /\/$/,
    "",
  );

const IMAGE_RE = /\.(jpe?g|png|tiff?|psd)$/i;

// Output sizes for the web. Anything wider than DISPLAY_MAX gets scaled down.
// THUMB is just for the admin grid.
const DISPLAY_MAX = 1600;
const THUMB_MAX = 400;
const DISPLAY_QUALITY = 85;
const THUMB_QUALITY = 75;

function stableSlug(filename: string): string {
  // Strip extension, normalise spaces & punctuation. Used as the R2 key
  // basename so we can predict URLs without re-listing.
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export function archiveAvailable(): boolean {
  return existsSync(ARCHIVE_ROOT);
}

/** Find the packaged folder for an issue number. */
export async function packagedFolderForIssue(num: number): Promise<string | null> {
  if (!archiveAvailable()) return null;
  const entries = await readdir(ARCHIVE_ROOT);
  const m = entries.find((n) => new RegExp(`gallery ${num}\\b.*packaged`, "i").test(n));
  return m ? path.join(ARCHIVE_ROOT, m) : null;
}

/** List all issues that have packaged folders. */
export async function listPackagedIssues(): Promise<number[]> {
  if (!archiveAvailable()) return [];
  const entries = await readdir(ARCHIVE_ROOT);
  const nums = new Set<number>();
  for (const e of entries) {
    const m = e.match(/gallery\s+(\d+)\b.*packaged/i);
    if (m) nums.add(parseInt(m[1], 10));
  }
  return [...nums].sort((a, b) => a - b);
}

type IssueImage = {
  filename: string;        // original filename in Links/
  sourceSize: number;      // bytes on disk
  displayKey: string;      // R2 key for 1600px WebP
  thumbKey: string;        // R2 key for 400px WebP
  displayUrl: string;
  thumbUrl: string;
};

/** List images in the Links/ subfolder, with predicted R2 keys for variants. */
export async function listIssueImages(num: number): Promise<IssueImage[]> {
  const pkg = await packagedFolderForIssue(num);
  if (!pkg) return [];
  const linksDir = path.join(pkg, "Links");
  if (!existsSync(linksDir)) return [];

  let names: string[] = [];
  try { names = await readdir(linksDir); } catch { return []; }
  const out: IssueImage[] = [];
  for (const f of names.sort()) {
    if (!IMAGE_RE.test(f)) continue;
    if (/\.psd$/i.test(f)) continue;  // PSDs aren't web-renderable; skip
    let size = 0;
    try { size = (await stat(path.join(linksDir, f))).size; } catch {}
    const slug = stableSlug(f);
    const displayKey = `features/gj${num}/${slug}.webp`;
    const thumbKey = `features/gj${num}/${slug}.thumb.webp`;
    out.push({
      filename: f,
      sourceSize: size,
      displayKey,
      thumbKey,
      displayUrl: `${R2_PUBLIC}/${displayKey}`,
      thumbUrl: `${R2_PUBLIC}/${thumbKey}`,
    });
  }
  return out;
}

/**
 * Process every Links/ image for an issue with Sharp and upload two WebP
 * variants per source image to R2:
 *   features/gj{N}/{slug}.webp        — 1600px display
 *   features/gj{N}/{slug}.thumb.webp  — 400px admin thumbnail
 *
 * Original source files (TIFF/JPG/PSD) are NOT uploaded — Google Drive is the
 * canonical source for those. Skipping PSDs entirely (not web-renderable).
 *
 * Idempotent — skips a file if BOTH variants already exist on R2.
 */
export async function syncIssueImagesToR2(num: number): Promise<{ processed: number; skipped: number; failed: number; total: number; bytesUploaded: number }> {
  const pkg = await packagedFolderForIssue(num);
  if (!pkg) throw new Error(`No packaged folder for issue ${num}`);
  const linksDir = path.join(pkg, "Links");
  if (!existsSync(linksDir)) throw new Error(`Links folder missing for issue ${num}`);

  // Pre-fetch existing keys to avoid round-trip per file
  const existing = new Set<string>();
  let token: string | undefined;
  do {
    const r = await r2Client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: `features/gj${num}/`,
        ContinuationToken: token,
      }),
    );
    for (const o of r.Contents || []) if (o.Key) existing.add(o.Key);
    token = r.NextContinuationToken;
  } while (token);

  const allFiles = (await readdir(linksDir)).filter((f) => IMAGE_RE.test(f) && !/\.psd$/i.test(f));
  const total = allFiles.length;
  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let bytesUploaded = 0;
  let started = 0;

  console.log(`[feature-import] gj${num}: ${total} images to consider, syncing with concurrency=4`);
  const t0 = Date.now();

  const CONCURRENCY = 4;

  async function processOne(f: string) {
    const slug = stableSlug(f);
    const displayKey = `features/gj${num}/${slug}.webp`;
    const thumbKey = `features/gj${num}/${slug}.thumb.webp`;
    if (existing.has(displayKey) && existing.has(thumbKey)) {
      skipped++;
      return;
    }
    try {
      const buf = await readFile(path.join(linksDir, f));
      const pipeline = sharp(buf, { failOn: "none" }).rotate(); // auto-orient
      const [display, thumb] = await Promise.all([
        pipeline.clone().resize({ width: DISPLAY_MAX, withoutEnlargement: true }).webp({ quality: DISPLAY_QUALITY }).toBuffer(),
        pipeline.clone().resize({ width: THUMB_MAX, withoutEnlargement: true }).webp({ quality: THUMB_QUALITY }).toBuffer(),
      ]);
      const uploads: Promise<unknown>[] = [];
      if (!existing.has(displayKey)) {
        uploads.push(uploadToR2(display, displayKey, "image/webp"));
        bytesUploaded += display.length;
      }
      if (!existing.has(thumbKey)) {
        uploads.push(uploadToR2(thumb, thumbKey, "image/webp"));
        bytesUploaded += thumb.length;
      }
      await Promise.all(uploads);
      processed++;
    } catch (err: any) {
      console.warn(`[feature-import] gj${num}: failed ${f}: ${err.message}`);
      failed++;
    }
  }

  // Process with a concurrency pool — simple Promise.all on slices.
  for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
    const batch = allFiles.slice(i, i + CONCURRENCY);
    started += batch.length;
    await Promise.all(batch.map(processOne));
    const done = processed + skipped + failed;
    if (done % 40 === 0 || done === total) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`[feature-import] gj${num}: ${done}/${total} (${processed} new, ${skipped} skip, ${failed} fail) in ${elapsed}s`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[feature-import] gj${num}: DONE in ${elapsed}s. ${processed} processed, ${skipped} skipped, ${failed} failed, ${(bytesUploaded / 1024 / 1024).toFixed(1)} MB`);

  return { processed, skipped, failed, total, bytesUploaded };
}

/** Build the gallery HTML block to append to article content. */
export function buildGalleryHtml(imageUrls: string[]): string {
  if (imageUrls.length === 0) return "";
  const figs = imageUrls
    .map((u) => `<figure class="wp-block-image"><img src="${u}" alt="" loading="lazy" /></figure>`)
    .join("\n");
  return `\n\n<h2>Gallery</h2>\n${figs}\n`;
}

/** Public URL for the display variant of an issue image. */
export function publicUrlForIssueImage(num: number, filename: string): string {
  return `${R2_PUBLIC}/features/gj${num}/${stableSlug(filename)}.webp`;
}

// ===========================================================================
// Layout-grouped image discovery
//
// For each .idml/.indd in the packaged folder, return the set of Links/ images
// it references. Lets the admin UI show images grouped by feature spread
// rather than as a flat list of hundreds.
// ===========================================================================

const SKIP_LAYOUT = /\b(IFC|IBC|cover|contents|back ?cover|inside ?back|directory|numbers|edito|brand ?news|advert|DPS|misc|finishing|template|fonts|background|placeholder|toc|sample|gallery_cover|cover_top)\b/i;

async function imagesFromIDMLFile(file: string): Promise<{ pages: number[]; refs: string[] }> {
  const tmp = `/tmp/idml-images-${Math.random().toString(36).slice(2)}`;
  spawnSync("unzip", ["-q", "-o", file, "-d", tmp]);
  try {
    const refs = new Set<string>();
    const pages = new Set<number>();
    const xmls: string[] = [];
    async function walk(d: string) {
      let entries;
      try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.name.endsWith(".xml")) xmls.push(p);
      }
    }
    await walk(tmp);
    for (const x of xmls) {
      const t = await readFile(x, "utf8");
      for (const m of t.matchAll(/(?:Links\/|file:|file:\/\/[^"<>]*\/)([^"<>\s]+?\.(?:jpe?g|png|tiff?|psd))/gi)) {
        const name = m[1].replace(/\\/g, "/").split("/").pop()!;
        try { refs.add(decodeURIComponent(name)); } catch { refs.add(name); }
      }
      // Page numbers
      for (const m of t.matchAll(/<Page\b[^>]*Name="(\d+)"/g)) {
        pages.add(parseInt(m[1], 10));
      }
    }
    return { pages: [...pages].sort((a, b) => a - b), refs: [...refs] };
  } finally {
    spawnSync("rm", ["-rf", tmp]);
  }
}

function imagesFromINDDFile(file: string): { pages: number[]; refs: string[] } {
  const out = spawnSync("strings", [file], { encoding: "utf8" }).stdout || "";
  const refs = new Set<string>();
  for (const m of out.matchAll(/[A-Za-z0-9_.%() -]+?\.(?:jpe?g|png|tiff?|psd)/gi)) {
    let f = m[0].trim();
    try { f = decodeURIComponent(f); } catch {}
    if (f.length < 6) continue;
    refs.add(f);
  }
  return { pages: [], refs: [...refs] };
}

export type LayoutGroup = {
  layoutName: string;
  source: "idml" | "indd";
  pages: number[];
  /** Filenames in Links/ that this layout uses. Only ones that resolve to an actual file. */
  images: string[];
};

/** Group an issue's images by layout (.idml/.indd) file. */
export async function listLayoutsForIssue(num: number): Promise<{ groups: LayoutGroup[]; unmatched: string[] }> {
  const pkg = await packagedFolderForIssue(num);
  if (!pkg) return { groups: [], unmatched: [] };
  const linksDir = path.join(pkg, "Links");
  if (!existsSync(linksDir)) return { groups: [], unmatched: [] };

  // Build a lower-case → original-cased map of files in Links/
  const linksFiles = (await readdir(linksDir)).filter((f) => IMAGE_RE.test(f) && !/\.psd$/i.test(f));
  const linksLower = new Map(linksFiles.map((f) => [f.toLowerCase(), f]));

  const entries = await readdir(pkg);
  const idmls = entries.filter((e) => e.toLowerCase().endsWith(".idml"));
  const indds = entries.filter((e) => e.toLowerCase().endsWith(".indd"));
  const useIdml = idmls.length > 0;
  const layoutFiles = (useIdml ? idmls : indds).filter((f) => !SKIP_LAYOUT.test(f));

  const groups: LayoutGroup[] = [];
  const usedFiles = new Set<string>();

  for (const f of layoutFiles.sort()) {
    const filePath = path.join(pkg, f);
    const { pages, refs } = useIdml
      ? await imagesFromIDMLFile(filePath)
      : imagesFromINDDFile(filePath);

    // Resolve refs against actual Links/ filenames
    const resolved: string[] = [];
    for (const r of refs) {
      const actual = linksLower.get(r.toLowerCase());
      if (actual) {
        resolved.push(actual);
        usedFiles.add(actual);
      }
    }
    if (resolved.length === 0) continue;

    groups.push({
      layoutName: path.basename(f, path.extname(f)),
      source: useIdml ? "idml" : "indd",
      pages,
      images: resolved.sort(),
    });
  }

  // Anything in Links/ that no layout referenced
  const unmatched = linksFiles.filter((f) => !usedFiles.has(f)).sort();
  return { groups, unmatched };
}
