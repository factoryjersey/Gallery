#!/usr/bin/env bash
#
# Clone the production database into a local Postgres so you can work
# against real content without touching live data.
#
# Personal data is NOT copied. These tables arrive with their schema but
# no rows:
#   users        - admin usernames and password hashes
#   subscribers  - newsletter list: emails, names, unsubscribe tokens
#
# Usage:
#   export PROD_DATABASE_URL='postgres://...'          # Railway, read-only is fine
#   ./scripts/clone-db-local.sh                        # -> gallery_dev on localhost
#   ./scripts/clone-db-local.sh --dry-run              # print the plan, change nothing
#   LOCAL_DATABASE_URL=postgres://localhost/foo ./scripts/clone-db-local.sh
#
# Requires: pg_dump / psql / createdb, at least as new as the server's
# major version (brew install postgresql@17). Homebrew's versioned
# Postgres is keg-only, so also:
#   export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

set -euo pipefail

LOCAL_DATABASE_URL="${LOCAL_DATABASE_URL:-postgres://localhost:5432/gallery_dev}"
EXCLUDE_DATA_TABLES=(public.users public.subscribers)

# Extensions present in production but not on a stock local Postgres.
# Left over from the Supabase era; nothing in this app uses them, but
# pg_dump still emits CREATE EXTENSION for them and the restore dies on
# the first one. pg_dump only grew --exclude-extension in 18, so on 17
# the dump has to be filtered instead. Override with
# SKIP_EXTENSIONS="a b c" if production sprouts another.
SKIP_EXTENSIONS="${SKIP_EXTENSIONS:-supabase_vault pgsodium pg_graphql supabase_functions pgjwt}"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

die() { printf 'error: %s\n' "$1" >&2; exit 1; }

[[ -n "${PROD_DATABASE_URL:-}" ]] || die \
  "PROD_DATABASE_URL is not set. Get it from the Railway project's
       variables tab (DATABASE_URL), or run this via:
         railway run ./scripts/clone-db-local.sh"

# Refuse to write anywhere but a local Postgres. This is the one guard
# that stops a mistyped variable from overwriting production.
case "$LOCAL_DATABASE_URL" in
  *@localhost[:/]*|*@127.0.0.1[:/]*|postgres://localhost[:/]*|postgres://127.0.0.1[:/]*|\
  postgresql://localhost[:/]*|postgresql://127.0.0.1[:/]*) ;;
  *) die "LOCAL_DATABASE_URL must point at localhost or 127.0.0.1.
       Refusing to write to: $LOCAL_DATABASE_URL" ;;
esac

[[ "$PROD_DATABASE_URL" != "$LOCAL_DATABASE_URL" ]] || die \
  "PROD_DATABASE_URL and LOCAL_DATABASE_URL are the same database."

LOCAL_DB_NAME="${LOCAL_DATABASE_URL##*/}"
LOCAL_DB_NAME="${LOCAL_DB_NAME%%\?*}"
[[ -n "$LOCAL_DB_NAME" ]] || die "could not read a database name out of LOCAL_DATABASE_URL"

exclude_args=()
for t in "${EXCLUDE_DATA_TABLES[@]}"; do
  exclude_args+=(--exclude-table-data="$t")
done

echo "  from:    (production, as given in PROD_DATABASE_URL)"
echo "  into:    $LOCAL_DATABASE_URL"
echo "  db name: $LOCAL_DB_NAME"
echo "  schema+data for every table EXCEPT, schema only:"
printf '             %s\n' "${EXCLUDE_DATA_TABLES[@]}"
echo "  extensions skipped (not available locally):"
printf '             %s\n' $SKIP_EXTENSIONS
echo

if (( DRY_RUN )); then
  echo "--dry-run: nothing was read or written."
  exit 0
fi

# Connect to the 'postgres' maintenance database on the SAME server the
# target URL names. Bare dropdb/createdb would use libpq's defaults and
# silently act on a different server if LOCAL_DATABASE_URL points at a
# non-default host or port.
local_base="${LOCAL_DATABASE_URL%%\?*}"
LOCAL_ADMIN_URL="${local_base%/*}/postgres"

echo "==> dropping and recreating $LOCAL_DB_NAME"
psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$LOCAL_ADMIN_URL" \
  -c "DROP DATABASE IF EXISTS \"$LOCAL_DB_NAME\";"
psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$LOCAL_ADMIN_URL" \
  -c "CREATE DATABASE \"$LOCAL_DB_NAME\";"

# Build the extension filter: drop CREATE/COMMENT ON EXTENSION lines for
# anything in SKIP_EXTENSIONS. With an empty list this is a plain cat.
filter_args=()
for ext in $SKIP_EXTENSIONS; do
  filter_args+=(-e "/^CREATE EXTENSION IF NOT EXISTS \"\?${ext}\"\?/d")
  filter_args+=(-e "/^COMMENT ON EXTENSION \"\?${ext}\"\?/d")
done
if (( ${#filter_args[@]} )); then
  ext_filter=(sed "${filter_args[@]}")
else
  ext_filter=(cat)
fi

echo "==> dumping production and restoring into $LOCAL_DB_NAME"
# --no-owner/--no-privileges: Railway's roles don't exist locally.
# ON_ERROR_STOP so a failed restore exits non-zero instead of leaving a
# half-populated database that looks fine until something 500s.
pg_dump \
  --no-owner \
  --no-privileges \
  --no-comments \
  "${exclude_args[@]}" \
  "$PROD_DATABASE_URL" \
  | "${ext_filter[@]}" \
  | psql --quiet --no-psqlrc -v ON_ERROR_STOP=1 "$LOCAL_DATABASE_URL"

echo "==> row counts"
psql --quiet --no-psqlrc "$LOCAL_DATABASE_URL" <<'SQL'
SELECT relname AS table, n_live_tup AS approx_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC, relname;
SQL

cat <<EOF

Done. Point .env.local at it:

  DATABASE_URL=$LOCAL_DATABASE_URL

/admin still works: it authenticates against the ADMIN_PASSWORD env var
(see server/adminAuth.ts), not the 'users' table, so the empty 'users'
table costs you nothing. Set ADMIN_PASSWORD and ADMIN_COOKIE_SECRET to
any values you like in .env.local — locally they only guard this copy.
EOF
