# Running Gallery locally

For working on the site with instant preview of your changes. The Express
server runs Vite as dev middleware, so one command serves the API and the
frontend together with hot module reload — save a file, the browser updates.

## One-time setup

```bash
git clone https://github.com/factoryjersey/Gallery.git
cd Gallery
pnpm install
cp .env.local.example .env.local   # then fill in the values — see below
```

**Node 20+** (the Dockerfile pins 20.19.3). **pnpm** is the package
manager — don't use `npm install`, it will fight the `pnpm-lock.yaml`.

## Day to day

```bash
pnpm dev     # http://localhost:5070 — frontend + API, hot reload
pnpm check   # tsc --noEmit; run this before you push
```

`pnpm dev` loads `.env.local` automatically
(`tsx --env-file-if-exists=.env.local`). That file is gitignored — your
secrets never get committed.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill it in. Ask Ben for the
real values, or pull them from the Railway project's variables tab.

| Variable | Needed for |
| --- | --- |
| `DATABASE_URL` | Everything. The app won't boot without it. |
| `PORT` | Optional; defaults to 5000. Set `5070` to match the rest of the team. |
| `ADMIN_PASSWORD`, `ADMIN_COOKIE_SECRET` | Signing in to `/admin`. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL` | Uploading or processing images. Existing images load from the public CDN without these. |
| `ANTHROPIC_API_KEY` | The AI-assisted bits of the article editor. |

## Three things to know before you start

1. **`DATABASE_URL` points at production Postgres.** There is no separate
   dev database. Previewing layout and styling is harmless, but anything
   you do in `/admin` locally — editing an article, uploading an image —
   writes to the live data. If you're going to be clicking around admin,
   get a copy or branch of the database first.
2. **Don't run `pnpm db:push` locally** unless you are deliberately
   changing the table definitions in `shared/schema.ts`. It applies the
   schema straight to that same production database.
3. **Run `pnpm check` before pushing.** There is no CI on this repo, so a
   type error won't surface until Railway's build fails after your push.

## How deploys work

Railway auto-deploys on every push to `main`. There is no build or test
pipeline in between — whatever lands on `main` goes to gallery.je. So work
on a branch, open a PR, and merge when you're happy with the local preview.
