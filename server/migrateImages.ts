import { db } from './db';
import { articles } from '../shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Migration script to replace WordPress image URLs with local paths
 * 
 * Usage: tsx server/migrateImages.ts
 */

const OLD_WP_URL = 'https://www.gallery.je/wp-content/uploads/';
const NEW_LOCAL_PATH = '/uploads/'; // Adjust this to match where you placed the uploads folder

async function migrateImageUrls() {
  console.log('Starting image URL migration...');
  console.log(`Replacing: ${OLD_WP_URL}`);
  console.log(`With: ${NEW_LOCAL_PATH}`);
  console.log('---');

  try {
    // Update content field
    const contentResult = await db.execute(sql`
      UPDATE articles 
      SET content = REPLACE(content, ${OLD_WP_URL}, ${NEW_LOCAL_PATH})
      WHERE content LIKE ${`%${OLD_WP_URL}%`}
    `);
    console.log(`✓ Updated content in ${contentResult.rowCount} articles`);

    // Update excerpt field
    const excerptResult = await db.execute(sql`
      UPDATE articles 
      SET excerpt = REPLACE(excerpt, ${OLD_WP_URL}, ${NEW_LOCAL_PATH})
      WHERE excerpt LIKE ${`%${OLD_WP_URL}%`}
    `);
    console.log(`✓ Updated excerpt in ${excerptResult.rowCount} articles`);

    // Update featured_image field
    const featuredResult = await db.execute(sql`
      UPDATE articles 
      SET featured_image = REPLACE(featured_image, ${OLD_WP_URL}, ${NEW_LOCAL_PATH})
      WHERE featured_image LIKE ${`%${OLD_WP_URL}%`}
    `);
    console.log(`✓ Updated featured_image in ${featuredResult.rowCount} articles`);

    // Verification query
    const remaining = await db.execute(sql`
      SELECT COUNT(*) as count FROM articles 
      WHERE content LIKE ${`%${OLD_WP_URL}%`} 
      OR excerpt LIKE ${`%${OLD_WP_URL}%`} 
      OR featured_image LIKE ${`%${OLD_WP_URL}%`}
    `);
    
    console.log('---');
    console.log(`Remaining WordPress URLs: ${remaining.rows[0].count}`);
    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateImageUrls();
