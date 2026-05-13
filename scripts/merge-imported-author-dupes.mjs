// Merge duplicate authors created by the WordPress import.
//
// Pattern: the import made entries like "Benrobertson" with an
// "@imported.local" placeholder email; a properly-cased "Ben Robertson"
// also exists in the table. Same person, two rows.
//
// What this does, per duplicate group:
//   1. Pick the "canonical" row = the one WITHOUT an @imported.local email.
//   2. Reassign every article from the import row to the canonical row.
//   3. Delete the import row.
//
// Safety rails:
//   - Only acts when there's exactly one canonical + one import in the group
//     (so we don't merge two real people who happen to share a name).
//   - Refuses to merge a group of 3+ — those need a human eye.
//   - Wraps each merge in a transaction so the article reassignment and the
//     delete commit together (or roll back together).
//
// Flags:
//   --dry-run     preview only, no writes
//
// Usage:
//   railway run node scripts/merge-imported-author-dupes.mjs --dry-run
//   railway run node scripts/merge-imported-author-dupes.mjs
import pg from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

// Normalise a name for matching — lowercase, strip everything that isn't a
// letter, so "Ben Robertson", "Benrobertson", "ben.robertson" all collapse
// to the same key.
const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z]/g, "");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: authors } = await db.query(
  `SELECT id, name, slug, email, bio, photo_url, avatar, default_role, created_at
     FROM authors ORDER BY created_at ASC`,
);

// Article counts so we can show "merging N articles" in the dry-run.
const { rows: counts } = await db.query(
  `SELECT author_id, count(*)::int AS n FROM articles GROUP BY author_id`,
);
const articleCount = new Map(counts.map((r) => [r.author_id, r.n]));

// Bucket authors by their normalised name.
const groups = new Map();
for (const a of authors) {
  const key = norm(a.name);
  if (!key) continue;
  (groups.get(key) || groups.set(key, []).get(key)).push(a);
}

let mergeable = 0, skippedSingleton = 0, skippedAmbiguous = 0, skippedNoImport = 0;
const planned = [];
const ambiguous = [];

for (const [key, list] of groups) {
  if (list.length === 1) { skippedSingleton++; continue; }
  const imports = list.filter((a) => /@imported\.local$/i.test(a.email || ""));
  const canon   = list.filter((a) => !/@imported\.local$/i.test(a.email || ""));
  if (imports.length === 0)             { skippedNoImport++; continue; }
  if (imports.length !== 1 || canon.length !== 1) {
    ambiguous.push({ key, list });
    skippedAmbiguous++;
    continue;
  }
  planned.push({ canonical: canon[0], imported: imports[0] });
  mergeable++;
}

console.log(`\n=== Audit ===`);
console.log(`  Distinct name buckets             : ${groups.size}`);
console.log(`  Singletons (no dupe)              : ${skippedSingleton}`);
console.log(`  Groups with no @imported.local row: ${skippedNoImport}`);
console.log(`  Groups too ambiguous to auto-merge: ${skippedAmbiguous}`);
console.log(`  Mergeable duplicate pairs         : ${mergeable}`);

console.log(`\n=== Planned merges (first 12) ===`);
for (const p of planned.slice(0, 12)) {
  const c = p.canonical, i = p.imported;
  console.log(`  ${c.name.padEnd(28)}  ←  ${i.name.padEnd(28)}  ` +
    `(${articleCount.get(i.id) || 0} articles to reassign)`);
  console.log(`    canonical id=${c.id}  email=${c.email || "—"}  role=${c.default_role || "—"}`);
  console.log(`    imported  id=${i.id}  email=${i.email || "—"}`);
}

if (ambiguous.length) {
  console.log(`\n=== Ambiguous groups (need human triage) ===`);
  for (const g of ambiguous.slice(0, 8)) {
    console.log(`  "${g.key}" — ${g.list.length} rows:`);
    for (const a of g.list) {
      console.log(`    ${a.name.padEnd(28)}  email=${a.email || "—"}  articles=${articleCount.get(a.id) || 0}`);
    }
  }
}

if (DRY_RUN) {
  console.log(`\n[DRY RUN] No changes written.`);
  await db.end();
  process.exit(0);
}

// Real run — each merge wraps reassignment + delete in a transaction so
// we never end up with orphaned articles if the delete fails.
console.log(`\nApplying ${mergeable} merges…`);
let applied = 0, reassigned = 0;
for (const p of planned) {
  try {
    await db.query("BEGIN");
    const r = await db.query(
      `UPDATE articles SET author_id = $1 WHERE author_id = $2`,
      [p.canonical.id, p.imported.id],
    );
    await db.query(`DELETE FROM authors WHERE id = $1`, [p.imported.id]);
    await db.query("COMMIT");
    applied++;
    reassigned += r.rowCount || 0;
  } catch (e) {
    await db.query("ROLLBACK");
    console.error(`! failed to merge ${p.imported.name} → ${p.canonical.name}: ${e.message}`);
  }
}

console.log(`\nMerged ${applied} duplicate pairs.`);
console.log(`Reassigned ${reassigned} articles.`);

await db.end();
