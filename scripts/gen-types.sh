#!/usr/bin/env bash
# Regenerate lib/supabase/types.ts from the live schema.
#
# Needs a personal access token, NOT the database password:
#   npx supabase login          (interactive, stores the token)
# or export SUPABASE_ACCESS_TOKEN=... for CI.
#
# Written via a temp file, because `supabase gen types` reports failures on
# stdout: redirecting straight at the real file replaces the types with an
# error blob. Both failure modes are handled — a non-zero exit, and the
# exits-0-with-garbage case — so a bad run always leaves the file untouched.
set -uo pipefail

PROJECT_ID="${SUPABASE_PROJECT_ID:-cxzyjgjfqjashdgjueiv}"
OUT="lib/supabase/types.ts"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

fail() {
  echo "gen-types: $1 — leaving $OUT untouched." >&2
  echo "gen-types: the CLI said:" >&2
  sed 's/^/  /' "$TMP" >&2
  exit 1
}

npx supabase gen types typescript --project-id "$PROJECT_ID" --schema public > "$TMP" \
  || fail "the CLI exited non-zero"

# A real generated file always declares `export type Database`.
grep -q "export type Database" "$TMP" || fail "output was not a types file"

mv "$TMP" "$OUT"
echo "gen-types: wrote $OUT ($(wc -l < "$OUT") lines)"
