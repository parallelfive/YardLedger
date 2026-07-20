# RFC: Migrate the backend off Supabase → Neon + BetterAuth + Drizzle (Hono API, monorepo)

Status: **Draft for review** (Damian + Zach)
Author: Claude (with Damian)
Date: 2026-07-20

---

## 1. Decision & why

Move Tare/YardLedger off Supabase to a self-owned stack:

- **DB:** Neon (managed serverless Postgres) for prod; local Postgres (Docker) for dev.
- **Auth:** BetterAuth (server-side, TS).
- **ORM + migrations:** Drizzle.
- **API tier:** Hono (new — the app currently has none).
- **Storage:** Cloudflare R2 (S3-compatible).
- **Structure:** pnpm + Turborepo monorepo.
- **API hosting:** Fly.io (prod). _Open — see §8._ (Homelab/Coolify optional for staging.)

Motivations: get off the heavy self-hosted Supabase image stack, remove vendor
lock-in, gain a real server tier, align with the team's Postgres/Drizzle
direction, and — honestly — learn the stack. This is a **deliberate** move, not a
prerequisite for the first user; see §7 rollout.

### Two facts that make this far more tractable than the raw coupling suggests

1. **Greenfield — no data migration.** The mobile app's current Supabase is stale
   and disposable; the dad-yard hasn't started. We build the new backend and
   bootstrap fresh. **The scariest part of most migrations (live data cutover)
   does not apply.**
2. **The client blast radius is contained.** The app already funnels _everything_
   through `services/` (21 files) + `authStore`. So the client rewrite is bounded
   to those — **screens and hooks barely change.** The "never call Supabase from a
   screen" rule pays off here.

---

## 2. The insight that reshapes the effort

The naive read is "298 RLS references + 73 SECURITY DEFINER functions + 31
triggers + ~100 client call sites = rewrite everything." That's wrong, and here's
why it matters:

**RLS and PL/pgSQL are core Postgres, not Supabase weight.** Supabase's _weight_
is its image stack (auth, PostgREST, realtime, storage, kong…). Neon is just
Postgres — it runs RLS and functions natively. So we **keep the entire Postgres
data layer** (schema, functions, triggers, RLS policies) and only replace the one
Supabase-specific dependency inside it: **`auth.uid()`**.

Today:

```sql
create function current_company_id() returns uuid as $$
  select company_id from public.users where supabase_id = auth.uid();
$$;
```

`auth.uid()` reads Supabase's auth JWT. Replace it with a **per-request session
variable (GUC)** the API sets:

```sql
create function current_company_id() returns uuid as $$
  select nullif(current_setting('app.company_id', true), '')::uuid;
$$;
create function current_user_id() returns uuid as $$
  select nullif(current_setting('app.user_id', true), '')::uuid;
$$;
-- is_admin() / is_owner() rewritten to read the users row by current_user_id()
```

Then, per authenticated request, the API opens a transaction and runs:

```sql
set local app.company_id = '<uuid from session>';
set local app.user_id    = '<PIN'd-in staffer uuid>';
```

**Result: all 298 policies and most of the 73 functions keep working unchanged.**
We re-point ~3 helper functions from `auth.uid()` to GUCs instead of
reimplementing multi-tenancy in app code. This preserves the _compliance-critical,
already-verified_ logic (receipt immutability, audit trail, inventory
weighted-avg, holds) rather than re-deriving it — which is both less work and far
less risk for regulated data.

Standard pattern: the API connects to Postgres as a privileged role and sets the
session context per request; **RLS then acts as defense-in-depth** even though
the connection is privileged. A missed scope in app code is caught by RLS, and
vice-versa.

---

## 3. Target architecture

```
Expo app (apps/mobile)
   │  typed API client (fetch), BetterAuth client
   ▼
Hono API (apps/api) on Fly.io
   │  - BetterAuth: email/password sessions (the device/company login)
   │  - PIN sign-in + admin elevation (ported from SQL → TS, or call SQL fns)
   │  - per request: open txn, set app.company_id / app.user_id GUCs
   │  - endpoints per domain; Drizzle queries + call preserved SQL fns
   ▼
Neon Postgres  (schema, functions, triggers, RLS — Drizzle-managed)
   +
Cloudflare R2  (private customer-ids bucket, public company-logos) via signed URLs
   +
Cron worker    (purge-expired-pii, report-to-state → scheduled server jobs)

packages/db = Drizzle schema + shared TS types (imported by app AND api)
```

---

## 4. The hard problems, worked

### 4.1 Auth model (the crux)

Current model is subtle and must be preserved exactly:

- **Two-step:** email/password anchors the _device to a company_; a **4-digit PIN**
  identifies the _staffer_ at a shared counter (many staff per shift, one device).
- **Admin elevation:** a separate short-lived window opened by an admin PIN, gating
  privileged writes (we built this: `admin_elevate`, `has_admin_elevation`).
- Attribution: writes credit the PIN'd-in staffer, not the device account.

Mapping to the new stack:

- **BetterAuth** owns the **email/password device session** (long-lived, the
  company anchor). Its `user`/`session` tables sit alongside our `users` table;
  link BetterAuth user → our `users` row (which holds `company_id`, `role`,
  `pin_hash`).
- **PIN sign-in + elevation stay application logic** — we already have the hard
  parts as SQL (bcrypt compare, `pin_attempts` lockout in `20260605/612…`,
  `admin_elevate` window). Two options: (a) keep them as Postgres functions the
  API calls, or (b) port to TS. Lean (a) first — least risk, already verified —
  then port opportunistically.
- Per request the client sends the BetterAuth session (company/device) **plus** a
  short-lived staff-identity/elevation token; the API resolves both, sets the two
  GUCs, and RLS/`is_admin()` enforce as today.

**This is the highest-risk area.** It's custom and security-sensitive; it gets its
own phase, its own tests, and a careful port of the lockout/elevation invariants.

### 4.2 Multi-tenancy — see §2. GUC swap + central API scoping helper.

### 4.3 Transactional RPCs → Drizzle transactions (keep the portable SQL)

- `create_receipt_with_items` (receipt + line items, atomic, fires numbering +
  inventory triggers): **keep as a Postgres function** the API calls inside a
  txn, OR reimplement as a Drizzle transaction. Since the triggers
  (receipt-number sequence, inventory weighted-avg, immutability) are portable
  and legally important, **keep the triggers**; the API just inserts and they
  fire. Only the _auth checks_ inside RPCs move to the GUC model.
- Admin mutation RPCs (`admin_create_metal`, `admin_update_user_role`, …): keep
  as SQL functions (they already encapsulate the role matrix) or port to API
  endpoints that check `is_admin()`/`is_owner()` via GUCs. Either works.

### 4.4 Storage → R2 signed URLs

- Buckets today: `customer-ids` (private, PII, per-company path isolation via
  Storage RLS) and `company-logos` (public). Both are _created by migrations_.
- New: R2 buckets; the **API mints short-lived presigned PUT/GET URLs**, and
  enforces that the requesting session's company owns the path (path is already
  company-scoped in `receipts.ts`/`customers.ts`). Replaces Storage RLS with API
  authz. Signatures + ID photos + logos.

### 4.5 Edge functions → cron jobs

- `purge-expired-pii` and `report-to-state` (SFTP to the state registry, per-company
  config, `CRON_SECRET`-gated). Port to scheduled server jobs (a Hono route hit by
  a scheduler, or a small worker). Logic is portable; `CRON_SECRET` → server env,
  service-role DB access → the API's privileged connection.

### 4.6 Migrations tooling for the raw SQL

Drizzle owns the typed schema + queries. The **PL/pgSQL functions, triggers, and
RLS policies** live as **Drizzle custom SQL migrations** (drizzle-kit supports raw
SQL migration files) applied in order. Alternative: Atlas for declarative
management of functions/policies. **Recommend Drizzle-kit + custom SQL files** to
keep one tool; revisit if the raw-SQL surface gets unwieldy. _(Open — §8.)_

---

## 5. Preserved vs rewritten (the honest effort map)

| Area                                          | Fate                                                                | Effort                   |
| --------------------------------------------- | ------------------------------------------------------------------- | ------------------------ |
| Table schema                                  | **Preserved** → Drizzle (introspect current schema as baseline)     | Low                      |
| Functions / triggers / RLS policies           | **Preserved** → Drizzle custom SQL; re-point 3 auth helpers to GUCs | Low–Med                  |
| Email/password auth                           | **Replaced** → BetterAuth                                           | Med                      |
| PIN sign-in + admin elevation                 | **Ported** (keep SQL fns, call from API)                            | Med (security-sensitive) |
| Invite-code signup (`handle_new_user`)        | **Reimplemented** as BetterAuth signup hook                         | Med                      |
| API tier                                      | **New** (Hono endpoints per domain)                                 | High (but mechanical)    |
| Client data layer (`services/*`, `authStore`) | **Rewritten** supabase-js → API client (~100 call sites, contained) | Med–High                 |
| Storage                                       | **Replaced** → R2 signed URLs                                       | Med                      |
| Edge functions                                | **Ported** → cron jobs                                              | Low–Med                  |
| Screens / hooks / UI                          | **Untouched**                                                       | ~0                       |

Net: the _data layer_ is largely preserved; we swap the **auth substrate** and add
an **API tier + client rewrite**. Realistic effort **~3–5 focused weeks solo**,
phased so it's steady and each phase is verifiable.

---

## 6. Phased plan

- **Phase 0 — Scaffold.** Monorepo (pnpm + Turbo): move Expo app → `apps/mobile`,
  create `apps/api` (Hono) + `packages/db` (Drizzle). Local Postgres via Docker.
  Neon project (prod). _Deliverable: everything builds; app still runs on Supabase._
- **Phase 1 — DB foundation.** Introspect current schema into Drizzle; carry
  functions/triggers/RLS as SQL migrations; re-point `current_company_id`,
  `current_user_id`, `is_admin`, `is_owner` to GUCs. Seed. _Deliverable: Neon holds
  the full schema; a psql session with GUCs set behaves like today._
- **Phase 2 — Auth.** BetterAuth email/password; link to `users`; invite-code
  signup hook; PIN sign-in + admin elevation (call preserved SQL fns); the
  GUC-setting request middleware. _Deliverable: full auth model works via the API._
- **Phase 3 — API endpoints.** Port every service domain (metals, receipts w/ the
  transactional create, inventory, sales, customers, tare presets, company
  settings, invites, reporting, admin actions). Each sets GUCs + runs
  Drizzle/SQL in a txn. _Deliverable: the whole data API exists + is testable._
- **Phase 4 — Client cutover.** Swap `services/*` → typed API client; `authStore`
  → BetterAuth client. Screens untouched. _Deliverable: the app runs entirely on
  the new backend locally._
- **Phase 5 — Storage + jobs.** R2 signed-URL flow; port the 2 cron jobs.
- **Phase 6 — Deploy + cutover.** Neon + Fly API + R2; env/secrets; rebuild the
  mobile app against prod; bootstrap the real yard; ship to dad.

---

## 7. Rollout / risk posture

- **Greenfield bootstrap**, not a data migration — build new, point app at it,
  seed the real company. No dual-write, no backfill.
- **Keep Supabase running until Phase 4 is proven.** Don't tear down Zach's
  homelab Supabase containers until the app runs end-to-end on the new stack. Then
  reclaim that RAM.
- **The app keeps working on Supabase throughout Phases 0–3** (client isn't
  touched until Phase 4), so there's always a working fallback.

### Risks

| Risk                                                                                        | Mitigation                                                                                               |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Auth model port introduces a security regression (PIN lockout, elevation, tenant isolation) | Dedicated phase + tests; keep lockout/elevation as the _already-verified_ SQL fns; RLS backstop stays on |
| Compliance logic (immutability, audit, holds, retention) drifts during the move             | **Preserve** it as-is (don't rewrite); port verbatim as SQL migrations                                   |
| Scope creep turns "~3–5 wk" into "forever"                                                  | Strict phase gates; each phase ships + is verified before the next                                       |
| No tests today = risky refactor                                                             | Add tests _as we port_ — start with the money/tare/profit math and the auth invariants                   |

---

## 8. Open decisions (for Zach)

1. **API hosting:** Fly.io (my rec — managed, cheap, pairs with Neon, doesn't
   depend on a MacBook being up) vs Coolify/homelab (aligns with p5-ops, but a
   home box shouldn't be what dad's shop depends on). Staging could be homelab.
2. **Raw-SQL migration tool:** Drizzle custom SQL (my rec — one tool) vs Atlas
   (nicer for functions/policies, another tool).
3. **PIN/elevation:** keep as SQL functions called by the API (my rec — least
   risk) vs port fully to TS now.
4. **Neon tier / region**, R2 account, Fly org — infra provisioning owners.

---

## 9. Next step

On sign-off (and Zach's take on §8), start **Phase 0**: scaffold the monorepo and
stand up local Postgres + Neon. Everything stays working on Supabase until Phase 4.
