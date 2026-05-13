# Gallery — Jersey's life & style magazine

Public site + admin tooling for **Gallery Magazine** (Jersey, Channel
Islands). The print edition has been running since 2004; this app is the
unified web presence, replacing previous WordPress and Replit/Neon
iterations.

## Stack
- **Express** server + **Vite + React 18** client (single repo, single
  Node process; Vite is dev-server middleware in dev, static build in
  prod)
- **Drizzle ORM** against **Postgres on Railway** (formerly Supabase /
  Neon; current `DATABASE_URL` is the Railway managed Postgres)
- **Wouter** for routing (NOT React Router — `<Link>`/`<Switch>`/`<Route>`
  are wouter's)
- **TanStack Query** for data fetching
- **Tailwind v3** + **shadcn/ui** + Radix primitives. Brand fonts:
  Georgia (serif headings/copy) and Arial (sans for labels/UI).
- **Cloudflare R2** for image storage. Public CDN base:
  `https://pub-3b96f5fc8ba0456f9ffd861fc06e5e97.r2.dev/…`. Newly-uploaded
  images live under `/wp-content/YYYY/MM/…` (legacy WP path preserved);
  older migrated files are at `/YYYY/MM/…` without the `wp-content/`
  prefix.
- **Railway** for deploy. Auto-deploys on push to `main`. Use
  `railway run …` from a local shell to inject prod env vars (especially
  `DATABASE_URL`) into one-off scripts.

Package manager: **pnpm**. Node 20+.

## Key directories
- `client/src/pages/` — Wouter-routed top-level pages (`home`, `article`,
  `category`, `current-issue`, `archive`, `about`, `media-pack`,
  `authors`, `author`, `admin`, etc.)
- `client/src/components/` — shared UI; `Header`, `Footer`, `ArticleGrid`,
  `Sidebar`, `LazyImage`, plus admin pieces (`AdminDashboard`,
  `ArticleEditor`, `AuthorPicker`, `ContributorsManager`, etc.)
- `server/` — Express app; `routes.ts` (all REST endpoints), `storage.ts`
  (the IStorage Drizzle implementation), `db.ts`, image processors
  (`imageProcessor.ts`, `imageProcessorR2.ts`, `r2Client.ts`), `seeds/`
- `shared/` — types and schemas shared between client and server.
  `schema.ts` holds the Drizzle table definitions (don't edit table
  shape without running `pnpm db:push` afterwards). `slug.ts` is the
  canonical slugify helper.
- `scripts/` — one-off maintenance/migration scripts (see "Data
  toolkit" below)
- `public/media/` — static images used by marketing pages
  (`gallery-collage.jpg`, reader-profile illustrations, etc.)

## Data model essentials
- **`authors`** is the unified people table — used for article bylines
  AND issue contributors. Has `name`, optional `email`, `slug` (unique),
  `bio`, `avatar`, `photoUrl`, `defaultRole` (`Photographer`,
  `Editorial`, etc.). The `@imported.local` email suffix marks rows the
  WordPress import auto-generated — these are the duplicates targeted by
  `scripts/merge-imported-author-dupes.mjs`.
- **`articles`** — `authorId` references `authors.id`, single `categoryId`,
  many-to-many tags via `articleTags`. `wpData` JSON column preserves
  the raw WordPress payload (originalLink, postMeta, etc.) — useful when
  bulk-fixing migration glitches.
- **`categories`** support a parent/child hierarchy; the Header surfaces
  `PRIMARY_SLUGS` as the top-level nav, everything else falls under
  "More". `excludeFromHero` keeps a category out of the homepage hero
  rotation.
- **`issues`** — bimonthly print editions. `number` is the canonical
  reference; `displayLabel` is human copy ("Apr / May 2026").

## Commands
```bash
pnpm dev                # dev server on :5070 (frontend + API together)
pnpm build              # vite build + esbuild server bundle to dist/
pnpm start              # run the built server
pnpm check              # tsc --noEmit
pnpm db:push            # apply schema.ts changes to the DB (idempotent)
railway run node scripts/<name>.mjs --dry-run   # safe data-migration runs
```

## Data toolkit (`scripts/`)
Maintenance scripts for the legacy back-catalogue. All accept
`--dry-run`. HEAD-checks are parallel (`--concurrency=N`, default 16).

| Script | Purpose |
| --- | --- |
| `backfill-author-slugs.mjs` | Populates `authors.slug` from `name`. Self-healing — adds the column if `db:push` hasn't been run. |
| `titlecase-author-names.mjs` | Normalises ALL-CAPS / lowercase names to title case (handles hyphens, apostrophes, prefixes). |
| `merge-imported-author-dupes.mjs` | Merges `Benrobertson @imported.local` placeholders into the real `Ben Robertson` row; transactional. |
| `repair-featured-images.mjs` | Per-article: HEAD-checks current `featured_image`; if dead, swaps in the first alive body image, or rescues via R2 variants (strips `-WIDTHxHEIGHT` suffix). |
| `sanitise-dead-body-images.mjs` | Walks article content, rewrites/strips dead `<img>` and Elementor lightbox elements, cleans up empty `<figure>` wrappers. |
| `force-repair-one.mjs` | Verbose single-article repair; prints every decision. Use to debug a row that the bulk script didn't update. |
| `inspect-one-article.mjs` | Diagnostic — dumps `featured_image`, body URLs, `wp_data.postMeta`, HEAD-checks every candidate. |
| `diagnose-featured-images.mjs` | Funnel report: which storage formats hold which images across the back-catalogue. |
| `check-featured-image-format.mjs` | Shows the most common `featured_image` URL prefixes — handy when reverse-engineering migration patterns. |

Older / superseded:
`backfill-featured-from-body.mjs`,
`backfill-featured-from-wpdata.mjs` — earlier iterations of the repair
pipeline, kept for reference.

## Things to know before editing
- **Drizzle types are strict in `shared/schema.ts` but loose at call
  sites.** Many existing `useQuery` calls are untyped — don't propagate
  that to new code; type your responses.
- **`wp_data` JSON is sometimes returned as a string** by `pg` depending
  on how the JSON type-parser is registered. Scripts that touch it should
  `JSON.parse` if `typeof === 'string'`.
- **`updated_at` is your audit trail.** Every script that touches a row
  sets `updated_at = NOW()`. Use it to find what changed.
- **InsertAuthor auto-generates slugs** — `storage.createAuthor()` fills
  a unique slug from the name if you don't supply one.
- **Header nav structure**: primary nav = top-level categories listed in
  `PRIMARY_SLUGS`; everything else goes in a "More" dropdown. Utility
  pages (`/about`, `/media-pack`, `/authors`, `/archive`) live in the
  Footer, not the header.

## Brand styling notes
- Hero banners on `/about` and `/media-pack` use a purple-tinted
  linear-gradient over `public/media/gallery-collage.jpg`. Same recipe
  on both for visual consistency.
- Primary accent colour: `hsl(182 55% 56%)` (teal). Used for
  superhead labels, theme tags, and CTA hover states.
- Body copy is Georgia at 17px; UI labels are Arial uppercase with
  letter-spacing. Inline styles dominate over Tailwind classes for
  typography (legacy decision; keep consistent within a component).
