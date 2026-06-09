// Convert the legacy text columns articles.photographer / articles.illustrator
// into proper rows in the contributors table + article_contributors join,
// so contributors become first-class people (with slugs / bios / future
// profile pages) rather than free-text strings.
//
// Per article:
//   1. For each non-empty photographer / illustrator value, find an existing
//      contributor row by case-insensitive name OR create a new one.
//   2. Insert an article_contributors row linking the article to the
//      contributor with the appropriate role ('photographer' / 'illustrator').
//   3. Leave the legacy text columns in place for now — they stay readable
//      as a fallback until everything is migrated and verified.
//
// Idempotent: skips article→contributor pairs that already exist (the
// UNIQUE constraint on (article_id, contributor_id, role) makes this safe).
//
// Flags:
//   --apply      write changes; dry-run otherwise
//   --limit=N    cap at N articles
//   --slug=foo   one article only
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0);
const SLUG = (process.argv.find((a) => a.startsWith("--slug=")) || "").split("=")[1] || "";

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "contributor";
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const conds = [`status = 'published'`];
const params = [];
if (SLUG) {
  conds.push(`slug = $${params.length + 1}`);
  params.push(SLUG);
} else {
  conds.push(`(photographer IS NOT NULL OR illustrator IS NOT NULL)`);
}
const limitClause = LIMIT > 0 ? `LIMIT ${LIMIT}` : "";

const { rows } = await db.query(
  `SELECT id, slug, photographer, illustrator
     FROM articles
    WHERE ${conds.join(" AND ")}
    ORDER BY published_at DESC NULLS LAST
    ${limitClause}`,
  params,
);

console.log(`Found ${rows.length} candidate article${rows.length === 1 ? "" : "s"}.`);

async function upsertContributor(name) {
  const trimmed = name.trim();
  // case-insensitive find
  const existing = await db.query(
    `SELECT id, name FROM contributors WHERE lower(name) = lower($1) LIMIT 1`,
    [trimmed],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  // Generate unique slug
  let base = slugify(trimmed);
  let slug = base;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const taken = await db.query(`SELECT 1 FROM contributors WHERE slug = $1 LIMIT 1`, [slug]);
    if (taken.rows.length === 0) break;
    slug = `${base}-${suffix++}`;
  }
  const inserted = await db.query(
    `INSERT INTO contributors (name, slug) VALUES ($1, $2) RETURNING id`,
    [trimmed, slug],
  );
  return inserted.rows[0].id;
}

async function linkCredit(articleId, contributorId, role) {
  // ON CONFLICT DO NOTHING on the (article_id, contributor_id, role) unique
  await db.query(
    `INSERT INTO article_contributors (article_id, contributor_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (article_id, contributor_id, role) DO NOTHING`,
    [articleId, contributorId, role],
  );
}

let createdContributors = 0;
let linkedCredits = 0;
const knownContribs = new Map(); // lower-name → id (cache within this run)

async function getContributor(name, role) {
  const key = name.trim().toLowerCase();
  if (knownContribs.has(key)) return knownContribs.get(key);
  if (!APPLY) {
    // In dry-run we still pretend we created — to give realistic numbers
    const existed = await db.query(
      `SELECT id FROM contributors WHERE lower(name) = lower($1) LIMIT 1`,
      [name.trim()],
    );
    if (!existed.rows[0]) createdContributors++;
    knownContribs.set(key, existed.rows[0]?.id || "__pending__");
    return knownContribs.get(key);
  }
  const id = await upsertContributor(name);
  // Detect if this was a fresh insert by comparing pre-count… simpler: track
  // separately if needed. For now we only count visible creates via the
  // first-time SELECT miss path.
  knownContribs.set(key, id);
  return id;
}

for (const article of rows) {
  for (const [field, role] of [
    [article.photographer, "photographer"],
    [article.illustrator, "illustrator"],
  ]) {
    if (!field || !field.trim()) continue;
    const id = await getContributor(field, role);
    if (APPLY && id && id !== "__pending__") {
      await linkCredit(article.id, id, role);
      linkedCredits++;
    } else if (!APPLY) {
      linkedCredits++;
    }
  }
}

// Get final contributor count for the report
const { rows: countRow } = await db.query(`SELECT count(*)::int AS n FROM contributors`);

console.log(`\n=== Result ===`);
console.log(`  Article credits ${APPLY ? "linked" : "would be linked"}: ${linkedCredits}`);
console.log(`  Contributors table now holds              : ${countRow[0].n} row${countRow[0].n === 1 ? "" : "s"}`);
if (!APPLY) console.log(`\n[DRY RUN] No changes written. Re-run with --apply.`);

await db.end();
