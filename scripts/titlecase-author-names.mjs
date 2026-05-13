// One-off: normalise all authors.name to title case.
//   "JOHN SMITH"   → "John Smith"
//   "jane doe"     → "Jane Doe"
//   "mary-jane"    → "Mary-Jane"
//   "o'brien"      → "O'Brien"
//   "le quesne"    → "Le Quesne"
//
// Preserves hyphens, apostrophes, periods, and existing already-title-cased
// names (no-op for those). Run with --dry-run to preview without writing.
//
// Usage:
//   node --env-file=.env.local scripts/titlecase-author-names.mjs [--dry-run]
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

// Capitalise the first letter of each contiguous letter run while leaving
// the rest lower-cased. Splits on whitespace AND on -, ', ., so compound
// names stay correctly cased ("Mary-Jane", "O'Brien", "St. Helier").
function titleCase(input) {
  if (!input) return input;
  return input
    .toLowerCase()
    .replace(/(^|[\s\-'.])([a-zà-ÿ])/g, (_, sep, ch) => sep + ch.toUpperCase());
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows } = await db.query(`SELECT id, name FROM authors ORDER BY name ASC`);

let changed = 0, unchanged = 0;
for (const r of rows) {
  const next = titleCase(r.name).trim();
  if (next === r.name) { unchanged++; continue; }
  console.log(`  ${r.name.padEnd(40)} → ${next}`);
  if (!DRY_RUN) {
    await db.query(`UPDATE authors SET name = $1 WHERE id = $2`, [next, r.id]);
  }
  changed++;
}

console.log(
  `\n${DRY_RUN ? "[DRY RUN] Would update" : "Updated"} ${changed} author names, ${unchanged} already correct.`,
);
await db.end();
