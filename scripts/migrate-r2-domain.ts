#!/usr/bin/env tsx
/**
 * Migrate all stored R2 URLs in the database from the old r2.dev domain
 * to a new custom domain (e.g. cdn.gallery.je).
 *
 * Usage:
 *   OLD_URL=https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev \
 *   NEW_URL=https://cdn.gallery.je \
 *   tsx scripts/migrate-r2-domain.ts
 *
 * Add --dry-run to preview counts without making changes.
 * Add --apply to actually run the migration.
 */

import pg from 'pg';
const { Pool } = pg;

const OLD_URL = (process.env.OLD_URL || 'https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev').replace(/\/$/, '');
const NEW_URL = (process.env.NEW_URL || '').replace(/\/$/, '');
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  if (!NEW_URL) {
    console.error('❌  NEW_URL env var is required. Set it to your custom domain, e.g. https://cdn.gallery.je');
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('🔍  DRY RUN — pass --apply to execute changes\n');
  } else {
    console.log('🚀  APPLY MODE — changes will be written to the database\n');
  }

  console.log(`  OLD: ${OLD_URL}`);
  console.log(`  NEW: ${NEW_URL}\n`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const migrations: Array<{ label: string; table: string; column: string; isJson?: boolean }> = [
      { label: 'articles.content',        table: 'articles', column: 'content' },
      { label: 'articles.featured_image', table: 'articles', column: 'featured_image' },
      { label: 'media.object_path',       table: 'media',    column: 'object_path' },
      { label: 'media.variants (JSON)',   table: 'media',    column: 'variants', isJson: true },
      { label: 'issues.pdf_url',          table: 'issues',   column: 'pdf_url' },
    ];

    let grandTotal = 0;

    for (const { label, table, column, isJson } of migrations) {
      const countRes = await client.query(
        `SELECT COUNT(*) FROM ${table} WHERE ${column}::text LIKE $1`,
        [`%${OLD_URL}%`]
      );
      const count = parseInt(countRes.rows[0].count, 10);
      grandTotal += count;

      if (count === 0) {
        console.log(`  ✓  ${label}: no rows to update`);
        continue;
      }

      console.log(`  ⚠  ${label}: ${count} row(s) contain old URL`);

      if (!DRY_RUN) {
        if (isJson) {
          // For JSON/JSONB columns, do a text replace then cast back
          await client.query(
            `UPDATE ${table}
             SET ${column} = REPLACE(${column}::text, $1, $2)::jsonb
             WHERE ${column}::text LIKE $3`,
            [OLD_URL, NEW_URL, `%${OLD_URL}%`]
          );
        } else {
          await client.query(
            `UPDATE ${table}
             SET ${column} = REPLACE(${column}, $1, $2)
             WHERE ${column} LIKE $3`,
            [OLD_URL, NEW_URL, `%${OLD_URL}%`]
          );
        }
        console.log(`     → updated ${count} row(s)`);
      }
    }

    console.log(`\n${DRY_RUN ? '📋  Total rows that would be updated' : '✅  Total rows updated'}: ${grandTotal}`);

    if (DRY_RUN && grandTotal > 0) {
      console.log('\nRun with --apply to execute the migration:');
      console.log(`  OLD_URL="${OLD_URL}" NEW_URL="${NEW_URL}" tsx scripts/migrate-r2-domain.ts --apply`);
    }

    if (!DRY_RUN) {
      console.log('\n✅  Migration complete.');
      console.log(`\nNext step: set the R2_PUBLIC_URL environment variable to "${NEW_URL}" and restart the server.`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
