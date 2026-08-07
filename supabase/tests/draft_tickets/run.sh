#!/usr/bin/env bash
# DB-level integration test for the employee->cashier (draft_tickets) flow and
# its security hardening (#112/#113/#114). Applies the REAL migrations to a
# throwaway supabase/postgres container over a minimal faithful context, then
# asserts the trigger + RLS-policy behavior. Requires docker. Not part of
# `npm test` (that suite is node-only pure logic and can't reach the DB).
#
#   bash supabase/tests/draft_tickets/run.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../migrations"
IMG="supabase/postgres:15.1.0.147"
C="yl_dbtest_draft_tickets"

cleanup() { docker rm -f "$C" >/dev/null 2>&1 || true; }
trap cleanup EXIT

cleanup
docker run --rm -e POSTGRES_PASSWORD=test -d --name "$C" "$IMG" >/dev/null

# The supabase image restarts postgres partway through init, so wait for the
# connection to be STABLE (5 consecutive successful probes), not just up once.
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

# context (minimal companies/users/receipts + real helper fns) then the real
# draft_tickets migrations in order, ending with the hardening under test.
apply "$HERE/context.sql"
apply "$MIG/20260721000003_draft_tickets.sql"
apply "$MIG/20260721000004_draft_ticket_vehicle.sql"
apply "$MIG/20260728000002_draft_ticket_vehicle_details.sql"
apply "$MIG/20260806000001_harden_draft_tickets.sql"

docker cp "$HERE/assert.sql" "$C:/tmp/assert.sql" >/dev/null
res="$(docker exec "$C" psql -U postgres -v ON_ERROR_STOP=0 -q -f /tmp/assert.sql 2>&1 | grep -E 'PASS|FAIL' || true)"
echo "$res"

fails="$(echo "$res" | grep -c 'FAIL' || true)"
passes="$(echo "$res" | grep -c 'PASS' || true)"
echo "----- PASS ${passes} / FAIL ${fails} -----"
[ "$fails" -eq 0 ] && [ "$passes" -ge 11 ] || { echo "draft_tickets DB test FAILED"; exit 1; }
echo "draft_tickets employee->cashier flow: all checks passed."
