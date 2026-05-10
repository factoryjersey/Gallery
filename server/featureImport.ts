// Feature-image import: helpers for browsing the InDesign packaged folders
// on Google Drive and attaching their images to existing articles.
//
// Filesystem access required (Google Drive must be mounted), so this is a
// local-dev workflow. Production won't have the Drive paths mounted.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
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

/** List images in the Links/ subfolder. */
export async function listIssueImages(num: number): Promise<{ filename: string; size: number; r2Key: string; r2Url: string }[]> {
  const pkg = await packagedFolderForIssue(num);
  if (!pkg) return [];
  const linksDir = path.join(pkg, "Links");
  if (!existsSync(linksDir)) return [];

  let names: string[] = [];
  try { names = await readdir(linksDir); } catch { return []; }
  const out = [];
  for (const f of names.sort()) {
    if (!IMAGE_RE.test(f)) continue;
    let size = 0;
    try { size = (await stat(path.join(linksDir, f))).size; } catch {}
    const r2Key = `features/gj${num}/_all/${f}`;
    out.push({
      filename: f,
      size,
      r2Key,
      r2Url: `${R2_PUBLIC}/${r2Key}`,
    });
  }
  return out;
}

/**
 * Upload (or skip-if-exists) every Links/ image for an issue to R2 under
 * features/gj{N}/_all/. Idempotent. Returns the count uploaded vs skipped.
 */
export async function syncIssueImagesToR2(num: number): Promise<{ uploaded: number; skipped: number; total: number }> {
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
        Prefix: `features/gj${num}/_all/`,
        ContinuationToken: token,
      }),
    );
    for (const o of r.Contents || []) if (o.Key) existing.add(o.Key);
    token = r.NextContinuationToken;
  } while (token);

  const files = (await readdir(linksDir)).filter((f) => IMAGE_RE.test(f));
  let uploaded = 0;
  let skipped = 0;
  for (const f of files) {
    const key = `features/gj${num}/_all/${f}`;
    if (existing.has(key)) { skipped++; continue; }
    const buf = await readFile(path.join(linksDir, f));
    const ext = path.extname(f).toLowerCase();
    const ct =
      ext === ".png" ? "image/png" :
      ext === ".tif" || ext === ".tiff" ? "image/tiff" :
      ext === ".psd" ? "image/vnd.adobe.photoshop" :
      "image/jpeg";
    await uploadToR2(buf, key, ct);
    uploaded++;
  }
  return { uploaded, skipped, total: files.length };
}

/** Build the gallery HTML block to append to article content. */
export function buildGalleryHtml(imageUrls: string[]): string {
  if (imageUrls.length === 0) return "";
  const figs = imageUrls
    .map((u) => `<figure class="wp-block-image"><img src="${u}" alt="" loading="lazy" /></figure>`)
    .join("\n");
  return `\n\n<h2>Gallery</h2>\n${figs}\n`;
}

/** Public URL for an issue image. */
export function publicUrlForIssueImage(num: number, filename: string): string {
  return `${R2_PUBLIC}/features/gj${num}/_all/${encodeURIComponent(filename)}`;
}
