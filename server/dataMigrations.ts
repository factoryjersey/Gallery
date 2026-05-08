import { db } from "./db";
import { categories } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'active-wellbeing': 'Health, fitness and wellbeing on the island',
  'advice': 'Expert guidance for modern island life',
  'agenda_business': "The business agenda shaping Jersey's economy",
  'appetite-1': 'Food, drink and dining across the island',
  'art': 'The art world through a Jersey lens',
  'beauty-and-wellbeing': 'Looking and feeling your best on the island',
  'business': "The latest from Jersey's business community",
  'cool-beans': "The coolest finds, places and people in Jersey",
  'culture': 'The cultural life of the island',
  'culture-club': 'Art, music and culture through a Jersey lens',
  'direction': "Charting the course for Jersey's future",
  'edito': "The editor's view on island life",
  'events': "What's happening across Jersey",
  'fashion': 'Style and beauty from Jersey and beyond',
  'fashion-shoots': 'Editorial fashion shot on location across the island',
  'features': 'In-depth stories from across the island',
  'genuine-articles': 'Long reads and investigations from around the island',
  'give-1': 'Charity, community and giving in Jersey',
  'gradu8': "Celebrating Jersey's graduating class",
  'hardware-1': 'Tech, gadgets and gear worth knowing about',
  'iod': "Jersey's Institute of Directors — leadership in action",
  'interiors': "Inside the island's most beautiful spaces",
  'islander': 'Stories from the heart of island life',
  'misc': 'Everything else worth knowing in Jersey',
  'music': "The sounds shaping Jersey's cultural scene",
  'my-jersey': 'Personal stories from islanders who call Jersey home',
  'ntjp': 'Not The Jersey Post — news with a Jersey twist',
  'news': 'The latest news from across the island',
  'potm': "Place of the Month — Jersey's unmissable spots",
  'people': 'The faces and stories that define the island',
  'places': 'Discovering the best of Jersey and beyond',
  'relative-values': 'Family life, love and relationships in Jersey',
  'rock-it-features': "Jersey's rock and live music scene",
  'spotm': 'Style Person of the Month — setting the bar in Jersey',
  'satire': 'Seeing the funny side of island life',
  'style-stalker': 'Tracking the best-dressed on the island',
  'tech': 'Technology, digital life and innovation on the island',
  'travel-1': "Exploring the world from Jersey's shores",
  'uncategorized': 'Posts without a category',
  'wealth': 'Finance, investment and wealth management in Jersey',
  'whats-on': "Your guide to what's on across Jersey",
  'women-in-busines': "Celebrating the women shaping Jersey's business world",
  'bridal-bible': 'Everything you need for your perfect Jersey wedding',
  'meet-the-charity': "Spotlighting Jersey's remarkable charitable organisations",
  'movers-and-shakers': 'The people making things happen in Jersey',
  'news-in-numbers': "The figures behind Jersey's biggest stories",
  'paparazzi': "Jersey's social scene, captured",
  'property-review': 'The finest homes and property on the island',
};

export async function fixCategoryDescriptions() {
  try {
    const rows = await db.select({ id: categories.id, slug: categories.slug, description: categories.description }).from(categories);
    let updated = 0;
    for (const row of rows) {
      const isPlaceholder = row.description?.toLowerCase().trim() === 'imported from wordpress';
      const correctDescription = CATEGORY_DESCRIPTIONS[row.slug];
      if (isPlaceholder && correctDescription) {
        await db.update(categories).set({ description: correctDescription }).where(eq(categories.id, row.id));
        updated++;
      }
    }
    if (updated > 0) {
      console.log(`[migrations] Fixed ${updated} category descriptions (replaced "Imported from WordPress" placeholders)`);
    }
  } catch (err) {
    console.error('[migrations] fixCategoryDescriptions failed:', err);
  }
}
