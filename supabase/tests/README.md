# DB-level integration tests

Tests that exercise DB triggers, RLS policies, and RPCs against a real
Postgres — the layer the node-only `npm test` suite (pure-logic utils) can't
reach. Require **docker**.

## draft_tickets (employee → cashier flow)

```bash
bash supabase/tests/draft_tickets/run.sh
```

Applies the real `draft_tickets` migrations to a throwaway `supabase/postgres`
container over a minimal faithful context (`context.sql` — real
`current_company_id()` / `stamp_created_by_session()` verbatim, `auth.uid()`
shimmed to a GUC), then asserts (`assert.sql`) the hardening from
#112/#113/#114:

- claim numbers auto-assign sequentially; duplicate claim number blocked
- cross-tenant / bogus `worker_id` rejected by the INSERT policy
- negative subtotal/weight rejected
- finalize/void allowed; a finalized or voided ticket is then frozen
- pending drafts deletable; finalized (audit) rows are not
- `created_by_session` stamped from the session, not the client

Exits non-zero if any check fails. This is what caught that the belt-and-
suspenders unique index couldn't be created on `(created_at::date)` (a STABLE,
non-IMMUTABLE expression).
