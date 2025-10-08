import sharp from 'sharp';
import path from 'path';
import { Storage } from '@google-cloud/storage';

export interface ImageVariants {
  thumbnail: string;
  medium: string;
  large: string;
  webp: string;
  original: string;
}

export interface ProcessedImage {
  variants: ImageVariants;
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

const SIZES = {
  thumbnail: 300,
  medium: 800,
  large: 1200,
};

export async function processImage(
  buffer: Buffer,
  filename: string,
  bucketName: string,
  storage: Storage
): Promise<ProcessedImage> {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const timestamp = Date.now();
  
  // Get original image metadata
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  const variants: ImageVariants = {
    thumbnail: '',
    medium: '',
    large: '',
    webp: '',
    original: '',
  };

  const bucket = storage.bucket(bucketName);

  // Upload original
  const originalPath = `public/images/${timestamp}-${baseName}${ext}`;
  await bucket.file(originalPath).save(buffer, {
    metadata: {
      contentType: `image/${ext.substring(1)}`,
    },
  });
  variants.original = originalPath;

  // Generate thumbnail (WebP)
  const thumbnailBuffer = await sharp(buffer)
    .resize(SIZES.thumbnail, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  
  const thumbnailPath = `public/images/${timestamp}-${baseName}-thumbnail.webp`;
  await bucket.file(thumbnailPath).save(thumbnailBuffer, {
    metadata: { contentType: 'image/webp' },
  });
  variants.thumbnail = thumbnailPath;

  // Generate medium (WebP)
  const mediumBuffer = await sharp(buffer)
    .resize(SIZES.medium, null, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  
  const mediumPath = `public/images/${timestamp}-${baseName}-medium.webp`;
  await bucket.file(mediumPath).save(mediumBuffer, {
    metadata: { contentType: 'image/webp' },
  });
  variants.medium = mediumPath;

  // Generate large (WebP)
  const largeBuffer = await sharp(buffer)
    .resize(SIZES.large, null, { withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  
  const largePath = `public/images/${timestamp}-${baseName}-large.webp`;
  await bucket.file(largePath).save(largeBuffer, {
    metadata: { contentType: 'image/webp' },
  });
  variants.large = largePath;

  // Also keep the large WebP in the webp variant field for backwards compatibility
  variants.webp = largePath;

  return {
    variants,
    metadata: {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
    },
  };
}

export function getPublicUrl(bucketName: string, objectPath: string): string {
  return `https://storage.googleapis.com/${bucketName}/${objectPath}`;
}
