import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;

export const R2_PUBLIC_URL = (
  process.env.R2_PUBLIC_URL ||
  `https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev`
).replace(/\/$/, '');

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.warn('R2 credentials not configured. File uploads will not work.');
}

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
});

export const uploadToR2 = async (
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> => {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Cache-Control: 1 year, immutable. The R2 URL paths we generate
      // are effectively content-addressed (the article slug + a size
      // suffix for variants, or a timestamp-derived key for new
      // uploads) — overwriting is rare and explicit. Without this
      // header R2 serves objects with no Cache-Control at all, so the
      // browser revalidates every time and every Lighthouse run flags
      // "Use efficient cache lifetimes". Backfilling the existing
      // objects needs a separate one-off pass.
      CacheControl: "public, max-age=31536000, immutable",
    },
  });

  await upload.done();

  return getR2PublicUrl(key);
};

export const deleteFromR2 = async (key: string): Promise<void> => {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });

  await r2Client.send(command);
};

export const getR2PublicUrl = (key: string): string => {
  return `${R2_PUBLIC_URL}/${key}`;
};

/**
 * Returns a RegExp that matches any R2 URL for this bucket.
 * Handles both the configured public URL and the legacy r2.dev fallback.
 */
export const getR2UrlPattern = (flags = 'gi'): RegExp => {
  const escaped = R2_PUBLIC_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}/[^\\s"'<>)]+`, flags);
};

/**
 * Like getR2UrlPattern but restricts to image extensions.
 */
export const getR2ImagePattern = (flags = 'gi'): RegExp => {
  const escaped = R2_PUBLIC_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`${escaped}/[^\\s"'<>)]+\\.(?:jpg|jpeg|png|gif|webp)`, flags);
};

/**
 * Extracts the storage key (path after the domain) from any R2 URL.
 * Returns null if the URL is not a recognised R2 URL.
 */
export const extractR2Key = (url: string): string | null => {
  if (!url) return null;
  // Match configured public URL first
  if (url.startsWith(R2_PUBLIC_URL + '/')) {
    return url.slice(R2_PUBLIC_URL.length + 1);
  }
  // Fallback: any *.r2.dev URL
  const m = url.match(/https?:\/\/[^/]*\.r2\.dev\/(.+)/);
  return m ? m[1] : null;
};

/**
 * Returns true if the given string looks like an R2 URL for this bucket
 * or any r2.dev bucket.
 */
export const isR2Url = (url: string): boolean => {
  if (!url) return false;
  return url.startsWith(R2_PUBLIC_URL + '/') || url.includes('.r2.dev/');
};
