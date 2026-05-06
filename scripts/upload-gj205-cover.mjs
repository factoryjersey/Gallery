import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = 'https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const key = 'covers/gallery-205.jpg';
const filePath = join(__dirname, '../attached_assets/gj205_cover_1778101933425.jpg');
const buffer = readFileSync(filePath);

console.log(`Uploading ${filePath} (${buffer.length} bytes) → ${key}`);

await r2.send(new PutObjectCommand({
  Bucket: R2_BUCKET_NAME,
  Key: key,
  Body: buffer,
  ContentType: 'image/jpeg',
}));

const publicUrl = `${R2_PUBLIC_URL}/${key}`;
console.log('Uploaded:', publicUrl);

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const result = await db.query(
  `UPDATE issues SET cover_image = $1 WHERE number = 205 RETURNING number, cover_image`,
  [publicUrl]
);
console.log('DB updated:', result.rows[0]);
await db.end();
