import sharp from 'sharp';
import path from 'path';
import { uploadToR2 } from './r2Client';

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

export async function processImageR2(
  buffer: Buffer,
  filename: string
): Promise<ProcessedImage> {
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const timestamp = Date.now();
  
  const image = sharp(buffer);
  const metadata = await image.metadata();
  
  const variants: ImageVariants = {
    thumbnail: '',
    medium: '',
    large: '',
    webp: '',
    original: '',
  };

  // Upload original to R2
  const originalKey = `uploads/${timestamp}-${baseName}${ext}`;
  const originalUrl = await uploadToR2(buffer, originalKey, `image/${ext.substring(1)}`);
  variants.original = originalUrl;

  // Generate and upload thumbnail (WebP)
  const thumbnailBuffer = await sharp(buffer)
    .resize(SIZES.thumbnail, null, { withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  
  const thumbnailKey = `uploads/${timestamp}-${baseName}-thumbnail.webp`;
  const thumbnailUrl = await uploadToR2(thumbnailBuffer, thumbnailKey, 'image/webp');
  variants.thumbnail = thumbnailUrl;

  // Generate and upload medium (WebP)
  const mediumBuffer = await sharp(buffer)
    .resize(SIZES.medium, null, { withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  
  const mediumKey = `uploads/${timestamp}-${baseName}-medium.webp`;
  const mediumUrl = await uploadToR2(mediumBuffer, mediumKey, 'image/webp');
  variants.medium = mediumUrl;

  // Generate and upload large (WebP)
  const largeBuffer = await sharp(buffer)
    .resize(SIZES.large, null, { withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();
  
  const largeKey = `uploads/${timestamp}-${baseName}-large.webp`;
  const largeUrl = await uploadToR2(largeBuffer, largeKey, 'image/webp');
  variants.large = largeUrl;
  variants.webp = largeUrl;

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
