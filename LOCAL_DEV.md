# Running Gallery locally

For working on the site with instant preview of your changes. The Express
server runs Vite as dev middleware, so one command serves the API and the
frontend together with hot module reload — save a file, the browser updates.

## One-time setup

```bash
git clone https://github.com/factoryjersey/Gallery.git
cd Gallery
pnpm install
cp .env.local.example .env.local
```

Then fill in `.env.local` — see "Environment variables" below.

**Node 20+** (the Dockerfile pins 20.19.3). **pnpm** is the package
manager — don't use `npm install`, it will fight the `pnpm-lock.yaml`.

> Paste these one line at a time. Interactive zsh does not treat `#` as a
> comment, so pasting a command with a trailing `# note (like this)`
> fails with `unknown file attribute` and the command never runs.

## Day to day

```bash
pnpm dev
pnpm check
```

`pnpm dev` serves the frontend and API together on
http://localhost:5070 with hot reload. `pnpm check` is `tsc --noEmit` —
run it before you push.

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

## Working against a local copy of the database

Rather than pointing `DATABASE_URL` at production, clone it once into a
local Postgres. Then you can edit articles, upload images and break
things in `/admin` without any of it being real.

You need Postgres running locally plus the client tools:

```bash
brew install postgresql@16
brew services start postgresql@16
```

Then, with the production URL from the Railway variables tab:

```bash
export PROD_DATABASE_URL='postgres://...'
./scripts/clone-db-local.sh --dry-run
pnpm db:clone-local
```

It drops and recreates `gallery_dev` on localhost, dumps production into
it, and prints row counts. Set `LOCAL_DATABASE_URL` to use a different
local database. Re-run it whenever you want fresh content.

Afterwards point `.env.local` at the copy:

```
DATABASE_URL=postgres://localhost:5432/gallery_dev
```

**Two tables arrive empty, by design** — schema but no rows:

| Table | Why |
| --- | --- |
| `users` | Admin usernames and password hashes. Nothing needs them: `/admin` authenticates against the `ADMIN_PASSWORD` env var (`server/adminAuth.ts`), not this table. |
| `subscribers` | The newsletter list — real email addresses, names and unsubscribe tokens. It has no bearing on anything you can see in the UI, so there is no reason for a copy to exist on a laptop. |

Everything the site renders — articles, authors, categories, tags,
issues, media, splash slides, site settings — comes across in full.

Three caveats:

- `authors.email` **does** come across, and holds contributor email
  addresses. Treat the local copy as real data: don't commit a dump,
  don't paste rows into a ticket.
- Images are **not** copied. They load from the public R2 CDN, so they
  render fine, but uploading locally writes to the real R2 bucket unless
  you point the `R2_*` variables at a scratch bucket.
- `pg_dump` must be the same major version as the server or newer. If
  you get a "server version mismatch" error, your Homebrew Postgres is
  older than Railway's.

## How deploys work

Railway auto-deploys on every push to `main`. There is no build or test
pipeline in between — whatever lands on `main` goes to gallery.je. So work
on a branch, open a PR, and merge when you're happy with the local preview.
