#!/usr/bin/env node
/**
 * Backfill `Cache-Control: public, max-age=31536000, immutable` onto
 * every object in the R2 bucket. New uploads after the r2Client.ts
 * change get this header automatically; this is the one-off catch-up
 * for the ~2,900 legacy objects that were uploaded before the header
 * was set on the upload path.
 *
 * Strategy: ListObjectsV2 paginates the bucket; for each key we issue a
 * CopyObjectCommand back onto itself with `MetadataDirective: "REPLACE"`
 * and the new `CacheControl`. Cloudflare R2 supports the S3 in-place
 * copy semantics, so this is a no-bytes-transferred metadata rewrite
 * (the object body stays at rest in R2 — only the headers change).
 *
 * Usage:
 *   railway run node scripts/backfill-r2-cache-headers.mjs --dry-run
 *   railway run node scripts/backfill-r2-cache-headers.mjs --concurrency=12
 *
 * Pass --prefix=covers/ to scope to just one prefix (handy for a
 * sanity-check rehearsal).
 */
import {
  S3Client,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const has = (name) => args.includes(`--${name}`);

const DRY_RUN = has("dry-run");
const CONCURRENCY = parseInt(flag("concurrency", "12"), 10);
const PREFIX = flag("prefix", "");
const TARGET_HEADER = "public, max-age=31536000, immutable";

// Match the env vars the running app already uses (server/r2Client.ts):
// the endpoint is derived from R2_ACCOUNT_ID, not a standalone
// R2_ENDPOINT. Falling back to R2_ENDPOINT if someone wants to override
// it directly (e.g. running against a custom S3-compatible endpoint).
const requiredEnv = ["R2_BUCKET_NAME", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
for (const k of requiredEnv) {
  if (!process.env[k]) {
    console.error(`Missing env: ${k}. Run with \`railway run\` so prod env vars are injected.`);
    process.exit(1);
  }
}
if (!process.env.R2_ENDPOINT && !process.env.R2_ACCOUNT_ID) {
  console.error("Missing env: need either R2_ENDPOINT or R2_ACCOUNT_ID. Run with `railway run`.");
  process.exit(1);
}

const endpoint =
  process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const s3 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.R2_BUCKET_NAME;

async function* listAllKeys(prefix) {
  let ContinuationToken;
  do {
    const resp = await s3.send(
      new ListObjectsV2Command({ Bucket, Prefix: prefix || undefined, ContinuationToken }),
    );
    for (const obj of resp.Contents || []) {
      if (obj.Key) yield obj.Key;
    }
    ContinuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (ContinuationToken);
}

async function needsBackfill(Key) {
  // Skip already-conforming objects so re-running is cheap.
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
    return head.CacheControl !== TARGET_HEADER;
  } catch (e) {
    // If HEAD fails, try the copy anyway and surface the error there.
    return true;
  }
}

async function rewrite(Key) {
  await s3.send(
    new CopyObjectCommand({
      Bucket,
      Key,
      // S3 / R2 wants the CopySource as "bucket/key" URL-encoded.
      CopySource: `/${Bucket}/${encodeURIComponent(Key).replace(/%2F/g, "/")}`,
      MetadataDirective: "REPLACE",
      CacheControl: TARGET_HEADER,
      // Preserve the existing content type — the source object knows it,
      // we just need to read it back. HeadObject would tell us; cheaper
      // path is to let S3 default-detect by extension, but R2 keeps
      // whatever we send. Look it up:
    }),
  );
}

async function rewriteWithContentType(Key) {
  const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
  await s3.send(
    new CopyObjectCommand({
      Bucket,
      Key,
      CopySource: `/${Bucket}/${encodeURIComponent(Key).replace(/%2F/g, "/")}`,
      MetadataDirective: "REPLACE",
      CacheControl: TARGET_HEADER,
      ContentType: head.ContentType,
    }),
  );
}

async function pool(workers, generator, work) {
  const iter = generator[Symbol.asyncIterator]();
  let active = 0;
  let done = false;
  let resolveAll;
  const allDone = new Promise((r) => (resolveAll = r));
  const pump = async () => {
    if (done) return;
    const next = await iter.next();
    if (next.done) {
      done = true;
      if (active === 0) resolveAll();
      return;
    }
    active++;
    work(next.value)
      .catch((e) => console.error(`fail ${next.value}: ${e.message}`))
      .finally(() => {
        active--;
        pump();
      });
    if (active < workers) pump();
  };
  for (let i = 0; i < workers; i++) pump();
  await allDone;
}

let scanned = 0;
let updated = 0;
let skipped = 0;
const start = Date.now();

await pool(CONCURRENCY, listAllKeys(PREFIX), async (Key) => {
  scanned++;
  if (await needsBackfill(Key)) {
    if (DRY_RUN) {
      console.log(`[dry] would update ${Key}`);
    } else {
      await rewriteWithContentType(Key);
      console.log(`updated ${Key}`);
    }
    updated++;
  } else {
    skipped++;
  }
  if (scanned % 100 === 0) {
    const rate = scanned / ((Date.now() - start) / 1000);
    console.log(
      `progress: scanned=${scanned} updated=${updated} skipped=${skipped} ${rate.toFixed(1)}/s`,
    );
  }
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
console.log(
  `\nDone in ${elapsed}s. scanned=${scanned} updated=${updated} skipped=${skipped}${DRY_RUN ? " (dry run)" : ""}.`,
);
