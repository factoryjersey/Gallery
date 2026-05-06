/**
 * For edito articles with no excerpt, extracts the first meaningful paragraph
 * from the article content and saves it as the excerpt.
 */
import pg from 'pg';

function extractExcerpt(html, maxLen = 300) {
  if (!html) return '';

  // Strip wp block comments, shortcodes, script/style tags
  let text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[[\w_-]+[^\]]*\]/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Get paragraphs (p tags or block-level text)
  const paras = [];
  const pMatches = text.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
  for (const m of pMatches) {
    const inner = m[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#8211;/g, '–').replace(/&#8212;/g, '—')
      .replace(/&#8216;/g, '\u2018').replace(/&#8217;/g, '\u2019')
      .replace(/&#8220;/g, '\u201C').replace(/&#8221;/g, '\u201D')
      .replace(/&#8230;/g, '…').replace(/&hellip;/g, '…')
      .replace(/&amp;/g, '&').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
      .replace(/\s+/g, ' ').trim();
    if (inner.length > 30) paras.push(inner);
  }

  // Fallback: strip all HTML if no paragraphs found
  if (paras.length === 0) {
    const stripped = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return stripped.slice(0, maxLen) + (stripped.length > maxLen ? '…' : '');
  }

  // Join paragraphs until we hit maxLen
  let excerpt = '';
  for (const p of paras) {
    if (excerpt.length + p.length > maxLen) {
      const remaining = maxLen - excerpt.length;
      if (remaining > 60 && excerpt.length === 0) {
        excerpt = p.slice(0, remaining) + '…';
      }
      break;
    }
    excerpt += (excerpt ? ' ' : '') + p;
  }

  return excerpt;
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: editoCatRows } = await db.query(`SELECT id FROM categories WHERE slug = 'edito' LIMIT 1`);
if (!editoCatRows.length) { console.error('No edito category found'); await db.end(); process.exit(1); }
const editoCatId = editoCatRows[0].id;

const { rows: articles } = await db.query(`
  SELECT id, title, content FROM articles
  WHERE category_id = $1
    AND (excerpt IS NULL OR trim(excerpt) = '')
    AND content IS NOT NULL AND trim(content) != ''
`, [editoCatId]);

console.log(`Found ${articles.length} edito articles missing excerpts`);

let updated = 0;
for (const article of articles) {
  const excerpt = extractExcerpt(article.content);
  if (!excerpt) { console.log(`  SKIP (no extractable text): ${article.title}`); continue; }
  await db.query(`UPDATE articles SET excerpt = $1 WHERE id = $2`, [excerpt, article.id]);
  console.log(`  ✓ ${article.title.slice(0, 60)} → "${excerpt.slice(0, 80)}…"`);
  updated++;
}

console.log(`\nDone — updated ${updated}/${articles.length} edito articles`);
await db.end();
