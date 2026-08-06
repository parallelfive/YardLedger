# End-to-end tests (frontend → backend)

The plan: drive the **real UI against a real backend** and assert on **both**
ends — the screen shows the right thing _and_ the database row is correct.
Asserting DB state after a UI action is what proves the whole chain
(component → hook → service → PostgREST → RLS → trigger → back).

This directory is the **first slice**: a reproducible local backend + a
deterministic fixture, verified end to end (a real login token is issued). The
browser driver (Playwright) is the next increment — see Roadmap.

## What's verified working today

- `supabase start` brings up the full local stack (Postgres + Auth/GoTrue +
  PostgREST + Storage + Deno edge runtime + Kong) and applies all migrations.
- `e2e/fixtures/seed.sql` seeds a deterministic tenant and a signed-in-able
  owner **through the real signup path** (`handle_new_user` consumes an invite
  code), plus the full auto-seeded metal catalog.
- Logging in as that owner against the live GoTrue server returns a JWT.
- **A real browser E2E passes** (`e2e/tests/login.spec.ts`): Playwright drives the
  web login UI → live GoTrue session → then asserts the backend via the DB
  (`e2e/lib/db.ts`) — the owner's role/name in `public.users`. This is the
  frontend→backend→DB pattern the golden flows will extend.

**Credentials:** `owner@e2e.test` / `Passw0rd!` · shift PIN `1379` · company `EE-2026`.

## Run the tests

```bash
bash e2e/setup.sh                 # stack + fixture
npm run web                       # boot the web app against the local stack
npm run test:e2e                  # playwright (chromium, wide viewport = desktop shell)
```

`E2E_BASE_URL` (default `http://localhost:8090`) and `E2E_DB_URL` (default
`…54322`) are env-overridable for machines running the stack on remapped ports.

## Bring it up

```bash
bash e2e/setup.sh
```

Then point the web app at the local stack and run it:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
EXPO_PUBLIC_SUPABASE_ANON_KEY="$(supabase status -o env | sed -n 's/^ANON_KEY=//p')" \
npm run web
```

## Gotchas (learned the hard way)

- **Depends on PR #160.** The `20260806000001_harden_draft_tickets.sql` migration
  on `main` has an apply-blocking bug (a `created_at::date` index — STABLE, not
  IMMUTABLE). Until #160 merges, `supabase start` / `db reset` aborts mid-migrate
  and the schema comes up empty. Run E2E from a branch that includes #160's fix.
- **Port conflicts.** If another local Supabase stack is up (it binds
  54321–54327), `supabase start` fails with "port is already allocated". Either
  stop that stack or remap the ports in `supabase/config.toml` (local-only edit —
  don't commit it).
- **Direct `auth.users` inserts** must set the token columns
  (`confirmation_token`, `recovery_token`, …) to `''`, not NULL — GoTrue can't
  scan NULL into a string and login 500s with "Database error querying schema".
  The fixture already does this.
- **Inserting a company auto-seeds a full catalog** (~55 metals) via a
  company-bootstrap trigger, so the fixture doesn't seed metals.
- **Pointing the app at your stack**: the web app resolves its Supabase URL from
  `EXPO_PUBLIC_SUPABASE_URL` (inlined at bundle time from `.env*`). A plain shell
  `export` does **not** override a value already set in `.env`, and
  `EXPO_NO_DOTENV=1` disables the whole `EXPO_PUBLIC_*` inlining (falls back to
  the `supabase.ts` default). If a second stack owns the default ports and you've
  remapped yours, set the URL in `.env.development.local` (highest precedence) —
  not via a shell export.

## Roadmap

1. **This slice** — local stack + fixture + Playwright wired; **browser login
   asserting UI _and_ DB passes**. ✅
2. **Golden flows** — extend to the rest at both viewports (desktop shell +
   mobile-web), asserting UI **and** DB after each action:
   auth+lockout · buy (net & gross−tare, override, per-piece) · **two-station
   worker→cashier handoff** · sale (oversell) · compliance/report · tenant isolation.
3. **Native E2E** — Detox/Maestro on a sim/emulator (data layer is shared, so web
   covers most logic).
4. **Edge-fn E2E** — `report-to-state` against the local stack + a fake SFTP
   container (proves #48's ordering).
5. **CI** — a GitHub Actions job that stands the stack up, seeds, runs Playwright
   headless (issues #2 / #3 / #120). `npm run test:db` stays a faster pre-gate.
