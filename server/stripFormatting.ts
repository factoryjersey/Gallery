import { db } from './db';
import { articles } from '@shared/schema';
import { sql } from 'drizzle-orm';

/**
 * Strip font formatting from article content while preserving alignment
 * Removes: font-family, font-size, color, font-weight, font-style
 * Keeps: text-align, margin, padding, etc.
 */
async function stripFormatting() {
  console.log('Starting formatting cleanup...');

  // Get all articles
  const allArticles = await db.select().from(articles);
  console.log(`Processing ${allArticles.length} articles...`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const article of allArticles) {
    try {
      let content = article.content;
      const originalContent = content;

      // Remove font-related inline styles while preserving other styles
      content = content.replace(/style="([^"]*)"/g, (match, styleContent) => {
        // Remove font-family, font-size, color, font-weight, font-style
        let cleanedStyle = styleContent
          .replace(/font-family:\s*[^;]+;?/gi, '')
          .replace(/font-size:\s*[^;]+;?/gi, '')
          .replace(/color:\s*[^;]+;?/gi, '')
          .replace(/font-weight:\s*[^;]+;?/gi, '')
          .replace(/font-style:\s*[^;]+;?/gi, '')
          .trim();

        // Clean up extra semicolons and whitespace
        cleanedStyle = cleanedStyle
          .replace(/;+/g, ';')
          .replace(/;\s*$/, '')
          .trim();

        // If no styles remain, remove the attribute entirely
        if (!cleanedStyle) {
          return '';
        }

        return `style="${cleanedStyle}"`;
      });

      // Remove empty style attributes
      content = content.replace(/\s+style=""\s*/g, ' ');

      // Clean up extra spaces
      content = content.replace(/\s{2,}/g, ' ');

      // Only update if content changed
      if (content !== originalContent) {
        await db.update(articles)
          .set({ content })
          .where(sql`${articles.id} = ${article.id}`);
        
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          console.log(`Progress: ${updatedCount} articles updated...`);
        }
      }
    } catch (error) {
      errorCount++;
      console.error(`Error processing article ${article.id} (${article.slug}):`, error);
    }
  }

  console.log('\n=== Formatting Cleanup Complete ===');
  console.log(`Total articles: ${allArticles.length}`);
  console.log(`Updated: ${updatedCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Unchanged: ${allArticles.length - updatedCount - errorCount}`);

  process.exit(0);
}

stripFormatting().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
