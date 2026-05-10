#!/usr/bin/env node
// Extracts every feature .idml in a packaged folder to JSON proposals.
//
// Usage:
//   node scripts/feature-parser/extract-issue.mjs 173 174 175
//
// Outputs to proposals/gj{N}/{layout-slug}.json — these are NOT applied to the
// DB; this is a review artefact so we can validate the parser's output before
// committing to a schema migration.

import { readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseIDML, shapeArticle } from "./parse-idml.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const ARCHIVE =
  "/Users/minchin/Library/CloudStorage/GoogleDrive-ben@factory.je/My Drive/publications/gallery archive";

const SKIP_LAYOUT = /\b(IFC|IBC|cover|contents|back ?cover|inside ?back|directory|numbers|edito|brand ?news|advert|DPS|misc|finishing|template|fonts|background|placeholder|toc|sample)\b/i;

function slug(s) {
  return s
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

async function findPackagedDir(num) {
  const entries = await readdir(ARCHIVE);
  const m = entries.find((n) => new RegExp(`gallery ${num}\\b.*packaged`, "i").test(n));
  return m ? path.join(ARCHIVE, m) : null;
}

const issues = process.argv.slice(2).map(Number).filter(Boolean);
if (issues.length === 0) {
  console.error("usage: node extract-issue.mjs <issue-number> [issue-number…]");
  process.exit(2);
}

let totalFeatures = 0;
let totalSkipped = 0;

for (const num of issues) {
  const dir = await findPackagedDir(num);
  if (!dir) { console.log(`[${num}] no packaged folder`); continue; }

  const entries = await readdir(dir);
  const idmls = entries.filter((e) => e.toLowerCase().endsWith(".idml"));
  if (idmls.length === 0) { console.log(`[${num}] no .idml files (binary-only — needs different path)`); continue; }

  const outDir = path.join(REPO_ROOT, "proposals", `gj${num}`);
  await mkdir(outDir, { recursive: true });

  console.log(`\n[${num}] ${idmls.length} .idml files → proposals/gj${num}/`);

  for (const f of idmls.sort()) {
    if (SKIP_LAYOUT.test(f)) { totalSkipped++; continue; }
    try {
      const parsed = await parseIDML(path.join(dir, f));
      const shaped = shapeArticle(parsed);
      const outPath = path.join(outDir, `${slug(f)}.json`);
      await writeFile(outPath, JSON.stringify(shaped, null, 2), "utf8");
      const hasText = shaped.title || shaped.content;
      const wc = shaped.word_count || 0;
      console.log(
        `  ${hasText ? "✓" : "·"} ${f}  → ${slug(f)}.json  (${wc} words, ${shaped.images?.length ?? shaped.inline_images.length + (shaped.hero ? 1 : 0)} images, pages ${shaped.pages[0] || "?"}-${shaped.pages.at(-1) || "?"})`,
      );
      totalFeatures++;
    } catch (err) {
      console.error(`  ✗ ${f}: ${err.message}`);
    }
  }
}

console.log(`\n--- ${totalFeatures} JSON proposals written, ${totalSkipped} layout files skipped (chrome/ads) ---`);
