# RFC: Add-on Entitlements & the Operator Portal

Status: **Draft for discussion** · Owner: Damian · Created: 2026-07-21

## 1. Context & goals

YardLedger targets **small scrap yards** priced out of the $200+/mo incumbents,
with the moat being _compliance autopilot_ + _no-hardware, runs-on-your-phone_.
But clients vary widely — a one-person yard needs almost nothing; a bigger
recycler wants dispatch, logistics, automated state reporting, multi-yard. We
also want to sell to both without maintaining forked products.

**Goal:** monetize by **à la carte add-ons** (independently toggleable
capabilities) with **optional bundles** (presets that enable a group at once),
all controlled by **our team via an operator portal** — never by the customer.

### Non-goals (for this RFC / first cut)

- Stripe/billing automation. Entitlements are the source of truth for what's
  _on_; billing is wired later. Keep them decoupled.
- Customer self-serve upgrades. Tenants can _see_ and _request_, never _grant_.
- Building every add-on. This designs the **framework**; dispatch/logistics/etc.
  are just catalog rows added over time.

### The invariant that drives everything

A tenant's own admin must **never** be able to toggle their own entitlements
(they'd upgrade for free). Entitlements are written **only** by platform staff.
This is distinct from in-tenant **preferences** (require-ID-photo, enable-cash-
drawer, which scale) which company admins _do_ control.

## 2. Model: entitlements (à la carte) + bundles (presets)

Three tables, plus reuse of the existing `companies`.

### 2.1 Add-on catalog — `features`

Data-driven so a new add-on is an INSERT, not a deploy.

```sql
create table public.features (
  key          text primary key,          -- 'dispatch', 'logistics', 'auto_reporting', 'scale_hw', 'id_auth'
  name         text not null,
  description  text not null default '',
  category     text not null,             -- 'core' | 'compliance' | 'dispatch' | 'logistics' | 'hardware' | 'analytics'
  is_addon     boolean not null default true,  -- false = always-on core (never billed/gated off)
  price_note   text not null default '',  -- human pricing hint for the portal; real pricing lives in billing later
  created_at   timestamptz not null default now()
);
```

### 2.2 Per-company entitlements — `company_entitlements`

On/off **and** metered from day one (`config` carries limits).

```sql
create table public.company_entitlements (
  company_id   uuid not null references public.companies(id) on delete cascade,
  feature_key  text not null references public.features(key),
  enabled      boolean not null default true,
  config       jsonb not null default '{}'::jsonb,  -- { "max_users": 5, "max_yards": 2, ... }
  granted_by   uuid,                                -- platform_staff.id
  granted_at   timestamptz not null default now(),
  note         text not null default '',            -- 'trial thru Aug', 'comped', 'annual plan'
  primary key (company_id, feature_key)
);
```

### 2.3 Bundles — `bundles` + `bundle_features`

Presets only. Applying a bundle **writes rows into `company_entitlements`** —
the entitlements table stays the single source of truth; bundles are a
convenience for sales, not a second gating path.

```sql
create table public.bundles (
  key text primary key,          -- 'starter', 'pro', 'enterprise'
  name text not null,
  description text not null default ''
);
create table public.bundle_features (
  bundle_key  text not null references public.bundles(key),
  feature_key text not null references public.features(key),
  config      jsonb not null default '{}'::jsonb,   -- default limits this bundle grants
  primary key (bundle_key, feature_key)
);
```

`apply_bundle(company_id, bundle_key)` (platform-only RPC) upserts the bundle's
features into `company_entitlements`. The customer's app never sees "bundles" —
it only ever asks "do I have feature X?".

## 3. Enforcement — one helper, two layers

The single gate everything calls, mirroring `current_company_id()`:

```sql
create or replace function public.has_entitlement(p_feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_entitlements e
    where e.company_id = public.current_company_id()
      and e.feature_key = p_feature
      and e.enabled
  ) or exists (  -- core features are always on, never gated
    select 1 from public.features f where f.key = p_feature and f.is_addon = false
  );
$$;
```

- **Server = the real lock.** RLS policies / RPCs / edge functions on gated
  tables call `has_entitlement('dispatch')`. Example: the dispatch tables' RLS
  requires `has_entitlement('dispatch')`, so even a direct API call is denied
  without the entitlement. The existing `report-to-state` edge function gains a
  `has_entitlement('auto_reporting')` check.
- **Client = UX only.** A `useEntitlement('dispatch')` hook hides/disables UI.
  Never rely on it for security — hiding a button isn't enforcement.

Config/limits (e.g. `max_users`) read from `company_entitlements.config` and are
enforced in the relevant RPC (e.g. invite-user checks the seat count).

## 4. The operator portal (platform staff)

The new, security-critical layer: identities that live **above** all tenant
companies. The app has no super-admin today — this adds one deliberately.

### 4.1 Identity & gates

```sql
create table public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  supabase_id uuid not null unique,     -- their auth.users id
  email text not null,
  role text not null check (role in ('owner','dev','support')),
  created_at timestamptz not null default now()
);

create or replace function public.is_platform_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_staff s where s.supabase_id = auth.uid());
$$;
```

### 4.2 Access rules (the crown-jewels rules)

- **Only platform staff WRITE entitlements** — RLS on `company_entitlements`,
  `features`, `bundles`: write requires `is_platform_staff()`.
- **Tenants READ their own only** — a company member can `select` their
  `company_entitlements` (so the app can gate UI) but cannot insert/update/delete.
- **Every change is audit-logged** — append-only `entitlement_audit`
  (company_id, feature_key, action, old/new, actor = platform_staff.id, note,
  created_at). Written via a SECURITY DEFINER trigger; no client write path.
  You will want this for billing disputes and support.
- **Least privilege across companies** — platform staff bypass per-company RLS
  _only_ on the entitlement/portal tables, not on tenant business data by
  default. Reading a customer's receipts should be a separate, logged action.

### 4.3 Portal surface — OPEN DECISION (recommend A)

**Option A — separate deployment/app (recommended).**
A standalone portal (own URL, own build) that talks to the same Supabase via a
platform-staff session.

- _Pro:_ strongest isolation — a bug/breach in operator tooling can't reach the
  tenant app; staff auth is fully separate; smaller, auditable surface.
- _Con:_ second app to build/deploy; some duplicated UI scaffolding.

**Option B — locked `/admin` route in the existing web app.**
A hidden route gated on `is_platform_staff()`.

- _Pro:_ fastest; reuses `src/desktop/ui.tsx`, components, auth.
- _Con:_ operator tooling shares the tenant app's blast radius and bundle; one
  routing/guard mistake exposes it; the customer app now contains code that can
  touch every tenant.

**Recommendation:** A. The portal can grant/revoke anything for anyone —
isolation is worth the extra deployment. B is a reasonable _interim_ (a guarded
route) if we want to validate the model before standing up a second app; if we
start with B, treat the guard as load-bearing and cover it with tests.

### 4.4 Support access & impersonation ("login as a user") — DECIDED: build it, carefully

Staff need to reproduce bugs in a user's context. This is the most dangerous
capability in the system (become any user in any tenant), so the rules are the
feature:

- **Credential-free.** Never read/use a customer's password or PIN. A
  platform-staff-only edge function (gated on `is_platform_staff()`) mints a
  **short-lived session for the target user** via the service role — an
  operator-initiated grant, not a login-with-their-password.
- **Time-boxed + fully audited.** Append-only `impersonation_audit`: actor
  (platform_staff.id), target user + company, started/ended, reason/ticket.
  Written server-side; no client write path.
- **Loud banner.** While impersonating, the app shows a persistent "SUPPORT
  SESSION — viewing as <user>" bar so staff never mistake it for their own
  account or forget they're in live data.
- **Read-only by default; write on explicit escalation.** A real session grants
  write power, so read-only is enforced by a JWT claim (e.g. `impersonation=true`)
  that write-path RPCs/RLS reject. Escalating to write is a separate, logged act.
- **PII caveat.** A real tenant holds regulated seller PII (ID, DOB, address, ID
  photos — NM law + retention). Impersonating = accessing that PII, so it must be
  logged, justified, and **minimized**. See [[nm_compliance]].
- **Sandbox first (lower-risk complement).** A **sandbox tenant** (or per-company
  support test user) with synthetic data covers MOST bug repro without touching a
  real customer's account. Reach for impersonation only when the bug is specific
  to their actual records. Build the sandbox alongside impersonation.

### 4.5 Platform-staff auth location — DECIDED: same Supabase project

Same project, separate identity (`platform_staff` + `is_platform_staff()`), NOT a
second project. Rationale: the portal must read/write prod entitlements and mint
prod user sessions, so it needs prod access regardless — a separate project adds
a federation seam and double the ops without real isolation. Spend the isolation
budget on the portal deployment (§4.3 Option A), least-privilege + audit, and
keeping the **service-role key server-side only** (edge functions, never the
portal browser client) — that's the actual key-management risk, identical either
way.

## 5. Billing (later, kept separable)

When we add Stripe: a webhook maps purchased products → `apply_bundle` /
entitlement upserts. Because entitlements are already the source of truth, manual
grants (trials, comps, support fixes) keep working with or without Stripe. No
hard coupling now.

## 6. Migration & phasing

Supersedes the earlier `companies.plan` enum idea (never shipped).

- **Phase 1 (framework):** `features`, `company_entitlements`, `has_entitlement()`,
  `platform_staff` + `is_platform_staff()`, RLS + audit log. Seed core features as
  `is_addon=false`. Gate **one** real add-on end-to-end (auto_reporting on the
  existing edge function) to prove the vertical slice. Minimal portal surface
  (per §4.3 decision) that can toggle that one feature.
- **Phase 2:** bundles + `apply_bundle`; a real add-on with UI (dispatch is the
  meaty candidate); `useEntitlement()` hook + client gating across the app.
- **Phase 3:** metered limits (`config`), seat enforcement, more add-ons; Stripe.

## 7. Open questions

1. Portal surface — A vs B (recommend A; B acceptable as interim). **← decide**
2. Naming: "add-ons" vs "modules" vs "features" in customer-facing copy.

### Resolved

- **Impersonation:** yes — credential-free, time-boxed, audited, banner-flagged,
  read-only by default, with a sandbox tenant for most repro (§4.4).
- **Platform-staff auth:** same Supabase project, separate identity (§4.5).

## 8. Security summary

- Entitlements written only by `is_platform_staff()`; tenants read-only.
- Server-side gate (`has_entitlement`) is authoritative; client hook is UX.
- Append-only audit on every entitlement change **and** every impersonation.
- Operator portal isolated (Option A) or a load-bearing, tested guard (Option B).
- Platform staff do **not** get tenant business data by default; impersonation is
  credential-free, time-boxed, banner-flagged, read-only by default, and logged.
- Service-role key lives server-side only (edge functions), never in the portal
  client. Same Supabase project; isolation is at the deployment + RLS + audit
  layers, not a second project.
