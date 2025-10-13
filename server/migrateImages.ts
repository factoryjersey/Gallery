import { db } from './db';
import { articles } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Migration script to replace WordPress image URLs with local paths
 * 
 * Usage: tsx server/migrateImages.ts
 */

const OLD_WP_URLS = [
  'https://www.gallery.je/wp-content/uploads/',
  'http://www.gallery.je/wp-content/uploads/',
  '//www.gallery.je/wp-content/uploads/',
];

// Cloudflare R2 Configuration
const R2_BASE_URL = process.env.R2_PUBLIC_URL || 'https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev';
const NEW_CLOUD_PATH = `${R2_BASE_URL}/uploads/`;

async function migrateImageUrls() {
  console.log('Starting image URL migration...');
  console.log(`R2 Base URL: ${R2_BASE_URL}`);
  console.log(`Replacing WordPress URLs with: ${NEW_CLOUD_PATH}`);
  console.log('---');

  try {
    let totalUpdated = 0;

    // Replace each variant of the WordPress URL
    for (const oldUrl of OLD_WP_URLS) {
      console.log(`Processing: ${oldUrl}`);

      // Update content field
      const contentResult = await db.execute(sql`
        UPDATE articles 
        SET content = REPLACE(content, ${oldUrl}, ${NEW_CLOUD_PATH})
        WHERE content LIKE ${`%${oldUrl}%`}
      `);
      
      // Update excerpt field
      const excerptResult = await db.execute(sql`
        UPDATE articles 
        SET excerpt = REPLACE(excerpt, ${oldUrl}, ${NEW_CLOUD_PATH})
        WHERE excerpt LIKE ${`%${oldUrl}%`}
      `);
      
      // Update featured_image field
      const featuredResult = await db.execute(sql`
        UPDATE articles 
        SET featured_image = REPLACE(featured_image, ${oldUrl}, ${NEW_CLOUD_PATH})
        WHERE featured_image LIKE ${`%${oldUrl}%`}
      `);

      const updated = (contentResult.rowCount || 0) + (excerptResult.rowCount || 0) + (featuredResult.rowCount || 0);
      console.log(`  ✓ Updated ${updated} fields`);
      totalUpdated += updated;
    }

    // Verification query - check all variants
    const remaining = await db.execute(sql`
      SELECT COUNT(*) as count FROM articles 
      WHERE content LIKE '%www.gallery.je/wp-content/uploads/%'
      OR excerpt LIKE '%www.gallery.je/wp-content/uploads/%'
      OR featured_image LIKE '%www.gallery.je/wp-content/uploads/%'
    `);
    
    console.log('---');
    console.log(`Total fields updated: ${totalUpdated}`);
    console.log(`Remaining WordPress URLs: ${remaining.rows[0].count}`);
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateImageUrls();
