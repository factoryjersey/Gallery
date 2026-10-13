#!/usr/bin/env tsx
/**
 * Find articles whose galleryImages have a healthy mix of portrait
 * and landscape frames — the ones where the full-width-masonry
 * layout earns its keep.
 *
 * Dimensions are read from the first few KB of each image via a
 * Range request. Works for JPEG, PNG, WebP, GIF without decoding the
 * whole file. Legacy articles' images rarely appear in the media
 * table, so we can't rely on that join alone — probing bytes handles
 * every URL identically.
 *
 * Usage:
 *   railway run npx tsx scripts/find-mixed-orientation-galleries.ts \
 *     [--category=events] [--limit=10] [--min-images=10] [--concurrency=8]
 */

const categoryArg =
  process.argv.find((a) => a.startsWith("--category="))?.split("=")[1] ||
  "events";
const limitArg = parseInt(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] || "15",
  10,
);
const minImagesArg = parseInt(
  process.argv.find((a) => a.startsWith("--min-images="))?.split("=")[1] || "10",
  10,
);
const concurrencyArg = parseInt(
  process.argv.find((a) => a.startsWith("--concurrency="))?.split("=")[1] ||
    "8",
  10,
);

import pg from "pg";

function localFriendlyDatabaseUrl(raw: string): string {
  const isSupabase = /supabase\.(com|co)/i.test(raw);
  let parsed: URL | null = null;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }
  if (isSupabase && parsed.port === "5432") {
    parsed.port = "6543";
    return parsed.toString();
  }
  return raw;
}

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL — run with `railway run`.");
  process.exit(1);
}

/** Parse JPEG/PNG/WebP/GIF header bytes to pull width + height. Returns
 *  null when the format isn't one we recognise or the buffer is too
 *  small / corrupted. Based on the published header specs — enough to
 *  cover the common web-image formats on the site. */
function probeDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A, then IHDR with w (4) + h (4) at offset 16.
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  ) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // GIF: 'GIF87a' / 'GIF89a', then w (2 LE) + h (2 LE) at offset 6.
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // WebP: 'RIFF'....'WEBP' + VP8/VP8L/VP8X chunk.
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) {
    const chunk = buf.slice(12, 16).toString("ascii");
    if (chunk === "VP8 ") {
      // Lossy — dimensions at offset 26 (3-byte sync + 2 bytes w LE + 2 h LE).
      return {
        w: buf.readUInt16LE(26) & 0x3fff,
        h: buf.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      // Lossless — compact dimensions in bits.
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      // Extended — 24-bit LE dims at offset 24.
      const w = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
      const h = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
      return { w, h };
    }
    return null;
  }
  // JPEG: scan the markers until the SOF (0xC0..0xC3, 0xC5..0xC7,
  // 0xC9..0xCB, 0xCD..0xCF) which carries h (2) + w (2).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      // Fillers / stand-alone markers (0xFF, 0xD0..0xD9) carry no length.
      let marker = buf[i + 1];
      i += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (marker >= 0xd0 && marker <= 0xd7) continue;
      const segLen = buf.readUInt16BE(i);
      // SOF markers carry [precision(1)][h(2)][w(2)][components(1)] right
      // after the length field — i+2..i+6 for h, i+5..i+7 for w (using
      // segment data starting at i+2, +1 for precision).
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        if (i + 7 >= buf.length) return null;
        return {
          h: buf.readUInt16BE(i + 3),
          w: buf.readUInt16BE(i + 5),
        };
      }
      i += segLen;
    }
    return null;
  }
  return null;
}

async function probeUrl(
  url: string,
): Promise<{ w: number; h: number } | null> {
  try {
    const res = await fetch(url, {
      headers: { Range: "bytes=0-65535" },
      // 10s timeout — any longer and R2 is misbehaving, skip this image.
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok && res.status !== 206) return null;
    const ab = await res.arrayBuffer();
    return probeDimensions(Buffer.from(ab));
  } catch {
    return null;
  }
}

async function parallel<T, U>(
  items: T[],
  n: number,
  worker: (t: T) => Promise<U>,
): Promise<U[]> {
  const out: U[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await worker(items[idx]);
      }
    }),
  );
  return out;
}

const pool = new pg.Pool({
  connectionString: localFriendlyDatabaseUrl(process.env.DATABASE_URL),
  idleTimeoutMillis: 10_000,
  max: 2,
});

const articlesRes = await pool.query<{
  slug: string;
  title: string;
  gallery_images: Array<{ url: string }>;
  gallery_layout: string | null;
  published_at: Date | null;
}>(
  `
  SELECT a.slug, a.title, a.gallery_images, a.gallery_layout, a.published_at
    FROM articles a
    JOIN categories c ON c.id = a.category_id
   WHERE c.slug = $1
     AND a.status = 'published'
     AND jsonb_array_length(COALESCE(a.gallery_images, '[]'::jsonb)) >= $2
   ORDER BY a.published_at DESC NULLS LAST
`,
  [categoryArg, minImagesArg],
);

console.log(
  `\nProbing ${articlesRes.rows.length} ${categoryArg} article(s) with ≥${minImagesArg} gallery images each. This can take a bit — fetching the first 64KB of every image to read its header.\n`,
);

type Row = {
  slug: string;
  title: string;
  layout: string | null;
  total: number;
  portrait: number;
  landscape: number;
  square: number;
  unknown: number;
};

const results: Row[] = [];
let done = 0;
for (const art of articlesRes.rows) {
  const urls = (art.gallery_images || []).map((g) => g.url).filter(Boolean);
  if (urls.length === 0) continue;
  const dims = await parallel(urls, concurrencyArg, probeUrl);
  let portrait = 0,
    landscape = 0,
    square = 0,
    unknown = 0;
  for (const d of dims) {
    if (!d || !d.w || !d.h) {
      unknown++;
      continue;
    }
    const ratio = d.w / d.h;
    if (ratio < 0.9) portrait++;
    else if (ratio > 1.1) landscape++;
    else square++;
  }
  results.push({
    slug: art.slug,
    title: art.title,
    layout: art.gallery_layout,
    total: urls.length,
    portrait,
    landscape,
    square,
    unknown,
  });
  done++;
  if (done % 5 === 0) {
    process.stderr.write(`  …${done}/${articlesRes.rows.length} articles probed\n`);
  }
}

// Rank by min(portrait, landscape) — the "most mixed" galleries first.
results.sort(
  (a, b) =>
    Math.min(b.portrait, b.landscape) - Math.min(a.portrait, a.landscape),
);

console.log(`\nTop ${limitArg} by mixed-orientation balance:\n`);
console.log(
  "mix  port  land  sqr  unk  total  layout             slug",
);
console.log(
  "----------------------------------------------------------------",
);
for (const r of results.slice(0, limitArg)) {
  const mix = Math.min(r.portrait, r.landscape);
  const layout = (r.layout || "default").padEnd(18);
  console.log(
    `${String(mix).padStart(3)}  ${String(r.portrait).padStart(4)}  ${String(r.landscape).padStart(4)}  ${String(r.square).padStart(3)}  ${String(r.unknown).padStart(3)}  ${String(r.total).padStart(5)}  ${layout} /${r.slug}`,
  );
}
console.log("");

await pool.end();
