/**
 * Fetches original gallery.je/wp-content images in paparazzi articles,
 * re-uploads to R2 under paparazzi/<filename>, and rewrites article content.
 * Only fetches the original full-size image (not WP size variants like -720x480).
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import pg from 'pg';

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = 'https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
});

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: articles } = await db.query(`
  SELECT id, title, content, featured_image FROM articles
  WHERE category_id IN (SELECT id FROM categories WHERE slug = 'paparazzi')
  AND content LIKE '%gallery.je/wp-content%'
`);

console.log(`Found ${articles.length} paparazzi article(s) with WP images\n`);

// Regex to match WP size variants like -720x480, -1068x712 etc.
const sizeVariantRe = /-\d+x\d+\.(jpg|jpeg|png|webp)$/i;

for (const article of articles) {
  console.log(`Processing: "${article.title}"`);
  let content = article.content;

  // Strip srcset and sizes attributes first — we won't keep WP variants
  content = content
    .replace(/\s+srcset="[^"]*"/g, '')
    .replace(/\s+sizes="[^"]*"/g, '');

  // Extract remaining unique WP image src URLs (originals only — skip size variants)
  const allSrcs = [...content.matchAll(/src="(https:\/\/www\.gallery\.je\/wp-content\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi)]
    .map(m => m[1])
    .filter(url => !sizeVariantRe.test(url));

  const uniqueOriginals = [...new Set(allSrcs)];
  console.log(`  ${uniqueOriginals.length} original images to migrate`);

  const urlMap = new Map();

  for (const wpUrl of uniqueOriginals) {
    const filename = wpUrl.split('/').pop().split('?')[0];
    const r2Key = `paparazzi/${filename}`;
    const r2Url = `${R2_PUBLIC_URL}/${r2Key}`;

    try {
      process.stdout.write(`  Fetching: ${filename} ... `);
      const resp = await fetch(wpUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GalleryBot/1.0)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) { console.log(`SKIP (${resp.status})`); continue; }

      const buffer = Buffer.from(await resp.arrayBuffer());
      const contentType = resp.headers.get('content-type') || 'image/jpeg';

      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET_NAME, Key: r2Key, Body: buffer, ContentType: contentType,
      }));
      urlMap.set(wpUrl, r2Url);
      console.log(`✓`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
    }
  }

  // Rewrite content src URLs
  let newContent = content;
  for (const [wpUrl, r2Url] of urlMap) {
    newContent = newContent.replaceAll(wpUrl, r2Url);
  }

  // Update featured_image if it was a WP URL
  let newFeaturedImage = article.featured_image || '';
  for (const [wpUrl, r2Url] of urlMap) {
    newFeaturedImage = newFeaturedImage.replaceAll(wpUrl, r2Url);
  }

  await db.query(
    `UPDATE articles SET content = $1, featured_image = $2, content_type = 'gallery' WHERE id = $3`,
    [newContent, newFeaturedImage || null, article.id]
  );
  console.log(`  ✓ Saved — ${urlMap.size} images migrated\n`);
}

await db.end();
console.log('Done!');
