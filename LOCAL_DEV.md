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
brew install postgresql@17
brew services start postgresql@17
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
```

Homebrew's versioned Postgres is keg-only, so without that `export`
neither `pg_dump` nor `createdb` is on your PATH and the clone script
fails before it starts. Put the same line in `~/.zshrc` so it survives a
new terminal.

Version 17 rather than 16 because `pg_dump` must be at least as new as
the server it reads — see the caveats below.

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
- `pg_dump` must be at least as new as the server's major version. A
  newer `pg_dump` reads an older server fine; the reverse fails. If you
  get a "server version mismatch" error, Railway is newer than your
  Homebrew Postgres — install the matching formula
  (`brew install postgresql@18`, and so on) and redo the `export PATH`
  line with the new version number. To check what Railway runs:
  `psql "$PROD_DATABASE_URL" -c 'select version();'`

## How deploys work

Railway auto-deploys on every push to `main`. There is no build or test
pipeline in between — whatever lands on `main` is on gallery.je a couple
of minutes later. Run `pnpm check` before you push; it is the only thing
between a type error and a failed deploy.

Pushing straight to `main` is fine for ordinary work. Use a branch when
you want someone to look at the change first, or when it's big enough
that you'd rather not find out on the live site.

Deploys never touch the database. The image runs `npm run build` and
`npm run start` — no `drizzle-kit`, no migration step — so the schema
only ever changes when someone runs `pnpm db:push` by hand.

## If a deploy goes bad

Code rolls back cleanly. In the Railway dashboard, open the service, go
to the **Deployments** tab, and use the three-dot menu on the last good
deployment:

- **Rollback** reuses that deployment's stored image *and* its variables,
  so it's live as soon as the container starts — no rebuild. Only offered
  while the image is still retained: 72h on Hobby, 120h on Pro.
- **Redeploy** rebuilds from that commit's source. Use it when the
  deployment is too old to roll back. Same result, you just wait for the
  build.

Neither changes git history, so `main` still points at the bad commit.
If you want history to reflect the fix, `git revert <sha>` and push —
that deploys the revert as a new deployment.

**Two things a rollback does not undo**, because they are data, not code:

- **`pnpm db:push`.** If the bad deploy came with a schema change that
  was pushed, rolling back gives you the old app against the new table
  shape, which may be worse than the bug. Schema changes are worth a
  heads-up to whoever else is working that day.
- **Anything done in `/admin`.** Edited articles, uploaded images —
  that's live content in Postgres and R2. There is no undo. `updated_at`
  is the audit trail: `SELECT id, title, updated_at FROM articles ORDER
  BY updated_at DESC LIMIT 20;` shows what changed most recently.
