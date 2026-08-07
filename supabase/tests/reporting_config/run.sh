#!/usr/bin/env bash
# DB-level integration test for the reporting-creds elevation fix (#44/#159).
# Applies the fix migration over a minimal faithful context (real Supabase Vault
# from the image) and asserts the owner-elevation guard on upsert_reporting_config.
# Requires docker. Not part of `npm test` (node-only).
#
#   bash supabase/tests/reporting_config/run.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../migrations"
IMG="supabase/postgres:15.1.0.147"
C="yl_dbtest_reporting_config"
cleanup() { docker rm -f "$C" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run --rm -e POSTGRES_PASSWORD=test -d --name "$C" "$IMG" >/dev/null
ok=0
for _ in $(seq 1 90); do
  if docker exec "$C" psql -U postgres -c 'select 1' >/dev/null 2>&1; then ok=$((ok + 1)); else ok=0; fi
  [ "$ok" -ge 5 ] && break
  sleep 1
done
apply() {
  docker cp "$1" "$C:/tmp/$(basename "$1")" >/dev/null
  docker exec "$C" psql -U postgres -v ON_ERROR_STOP=1 -q -f "/tmp/$(basename "$1")"
}
apply "$HERE/context.sql"
apply "$MIG/20260806000003_reporting_config_owner_elevation.sql"
docker cp "$HERE/assert.sql" "$C:/tmp/assert.sql" >/dev/null
res="$(docker exec "$C" psql -U postgres -v ON_ERROR_STOP=0 -q -f /tmp/assert.sql 2>&1 | grep -E 'PASS|FAIL' || true)"
echo "$res"
fails="$(echo "$res" | grep -c 'FAIL' || true)"
passes="$(echo "$res" | grep -c 'PASS' || true)"
echo "----- PASS ${passes} / FAIL ${fails} -----"
[ "$fails" -eq 0 ] && [ "$passes" -ge 3 ] || { echo "reporting_config DB test FAILED"; exit 1; }
echo "reporting_config: all checks passed."
