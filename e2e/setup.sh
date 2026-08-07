#!/usr/bin/env bash
# Bring up the local Supabase stack and load the deterministic E2E fixture.
# Requires: docker + the supabase CLI.
#
# Prereqs / gotchas (see e2e/README.md):
#  * Needs PR #160's migration fix on your branch, or the migrate step aborts.
#  * If another local supabase stack owns ports 54321-54327, stop it or remap
#    ports in supabase/config.toml (local-only) before running this.
#
#   bash e2e/setup.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# project_id in supabase/config.toml — the DB container is supabase_db_<project_id>.
PROJECT="$(grep -E '^project_id' supabase/config.toml | sed -E 's/.*"(.*)".*/\1/')"
DB_CONTAINER="supabase_db_${PROJECT}"

supabase start
# clean, fully-migrated schema (also runs the config seed if present)
supabase db reset

echo "Loading E2E fixture (e2e/fixtures/seed.sql)…"
docker exec -i "$DB_CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -f - < e2e/fixtures/seed.sql

echo ""
echo "E2E backend ready."
echo "  login: owner@e2e.test / Passw0rd!   (shift PIN 1379)"
supabase status | grep -iE "API URL|anon key" || true
