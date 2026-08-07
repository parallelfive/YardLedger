#!/usr/bin/env bash
# DB-level integration test for the PIN-lockout fix (#142/#158). Applies the real
# PIN + admin-authz migrations (ending with the fix) to a throwaway
# supabase/postgres container over a minimal faithful context, then asserts that
# failed attempts PERSIST across transactions and the lockout actually trips.
# Requires docker. Not part of `npm test` (node-only).
#
#   bash supabase/tests/pin_lockout/run.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../migrations"
IMG="supabase/postgres:15.1.0.147"
C="yl_dbtest_pin_lockout"

cleanup() { docker rm -f "$C" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
docker run --rm -e POSTGRES_PASSWORD=test -d --name "$C" "$IMG" >/dev/null

# The supabase image restarts postgres partway through init — wait for a STABLE
# connection (5 consecutive probes), not just the first success.
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
apply "$MIG/20260605000001_user_pin_signin.sql"
apply "$MIG/20260612000001_pin_lockout_no_reset_on_success.sql"
apply "$MIG/20260618000002_admin_authz_helpers.sql"
apply "$MIG/20260806000002_pin_lockout_persist_attempts.sql"

docker cp "$HERE/assert.sql" "$C:/tmp/assert.sql" >/dev/null
res="$(docker exec "$C" psql -U postgres -v ON_ERROR_STOP=0 -q -f /tmp/assert.sql 2>&1 | grep -E 'PASS|FAIL' || true)"
echo "$res"

fails="$(echo "$res" | grep -c 'FAIL' || true)"
passes="$(echo "$res" | grep -c 'PASS' || true)"
echo "----- PASS ${passes} / FAIL ${fails} -----"
[ "$fails" -eq 0 ] && [ "$passes" -ge 4 ] || { echo "pin_lockout DB test FAILED"; exit 1; }
echo "pin_lockout: all checks passed."
