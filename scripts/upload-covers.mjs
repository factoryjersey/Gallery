import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import AdmZip from "adm-zip";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL_BASE = `https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev`;

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

// Get the R2 public URL base from an existing cover URL in DB
const existing = await db.query("SELECT cover_image FROM issues WHERE cover_image IS NOT NULL LIMIT 1");
let baseUrl = PUBLIC_URL_BASE;
if (existing.rows[0]?.cover_image) {
  const url = new URL(existing.rows[0].cover_image);
  baseUrl = `${url.protocol}//${url.host}`;
  console.log("Using base URL from DB:", baseUrl);
}

const ZIP_PATH = path.join(__dirname, "../attached_assets/Archive_1778088896381.zip");
const zip = new AdmZip(ZIP_PATH);
const entries = zip.getEntries();

const imageEntries = entries.filter(e =>
  /\.(jpg|jpeg|png|webp)$/i.test(e.name) &&
  !e.isDirectory &&
  !e.entryName.startsWith("__MACOSX") &&
  !e.name.startsWith("._")
);

function parseFilename(name) {
  // gj01_0409_cover.jpg → issue 1, YYMM=0409 → Sep 2004
  const m1 = name.match(/^gj(\d+)_(\d{2})(\d{2})_cover\.(jpg|jpeg|png|webp)$/i);
  if (m1) {
    const num = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10);   // MM first
    const year = 2000 + parseInt(m1[3], 10); // then YY
    return { num, date: new Date(Date.UTC(year, month - 1, 1)), ext: m1[4].toLowerCase() };
  }
  // gj100_cover.jpg → issue 100, no date
  const m2 = name.match(/^gj(\d+)_cover\.(jpg|jpeg|png|webp)$/i);
  if (m2) return { num: parseInt(m2[1], 10), date: null, ext: m2[2].toLowerCase() };
  return null;
}

const parsed = [];
for (const e of imageEntries) {
  const info = parseFilename(e.name);
  if (info) parsed.push({ ...info, entry: e });
}
parsed.sort((a, b) => a.num - b.num);
console.log(`Found ${parsed.length} covers, issues ${parsed[0].num}–${parsed[parsed.length - 1].num}`);

let uploaded = 0, errors = 0;
const CONCURRENCY = 15;

async function uploadOne(item) {
  const ext = item.ext === "jpeg" ? "jpg" : item.ext;
  const key = `covers/gallery-${item.num}.${ext}`;
  const coverImage = `${baseUrl}/${key}`;
  const buf = item.entry.getData();
  try {
    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    }));
    const dateParam = item.date ? item.date.toISOString() : null;
    await db.query(`
      INSERT INTO issues (number, title, cover_image, published_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (number) DO UPDATE SET
        cover_image = EXCLUDED.cover_image
        ${dateParam ? ", published_at = COALESCE(issues.published_at, EXCLUDED.published_at)" : ""}
    `, [item.num, `Gallery #${item.num}`, coverImage, dateParam]);
    uploaded++;
    process.stdout.write(`  ${uploaded}/${parsed.length} done (issue #${item.num})\r`);
  } catch (err) {
    console.error(`\nError on issue ${item.num}:`, err.message);
    errors++;
  }
}

// Run with concurrency pool
let idx = 0;
async function worker() {
  while (idx < parsed.length) {
    const item = parsed[idx++];
    await uploadOne(item);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

await db.end();
console.log(`\nDone: ${uploaded} uploaded, ${errors} errors`);
