# YardLedger — Architecture & Rules

## Tech Stack

- Expo (React Native) + TypeScript
- Supabase (auth, Postgres, RLS, edge functions)
- WatermelonDB (offline-first local SQLite with sync)
- Redux Toolkit (state management)
- React Navigation v7 (native-stack + bottom-tabs)

## Layering (enforced order)

```
DB migration → Service → Store/Hook → Screen
```

**Never** call Supabase directly from screens or components. Always go through:

1. `services/` — raw Supabase queries, grouped by domain
2. `store/` — Redux slices for global state (auth, app sync status)
3. `hooks/` — React hooks that call services and manage loading/error state

## File Structure

```
src/
  components/     — Shared UI components
  config/         — Supabase client setup
  constants/      — Theme colors, spacing, font sizes
  db/             — WatermelonDB schema, models, sync
  hooks/          — Data fetching hooks (useMetals, useReceipts, etc.)
  lib/            — Barrel re-exports
  navigation/     — React Navigation navigators
  screens/        — Screen components (grouped by feature)
  services/       — Supabase data access (metals, receipts, inventory, sales, users)
  store/          — Redux Toolkit slices
  types/          — Shared TypeScript types
  utils/          — Pure utility functions
supabase/
  migrations/     — Postgres SQL migrations (sequential, timestamped)
  functions/      — Edge functions (Deno/TypeScript)
```

## Naming Conventions

- **Screens**: PascalCase (LoginScreen.tsx, InventoryScreen.tsx)
- **Services**: camelCase (metals.ts, receipts.ts)
- **Hooks**: camelCase with `use` prefix (useMetals.ts)
- **Store slices**: camelCase with `Store` suffix (authStore.ts)
- **DB models**: PascalCase (Receipt.ts, LineItem.ts)
- **Migrations**: `YYYYMMDDNNNNNN_snake_case.sql`

## Desktop / Web shell (`src/desktop/`)

The app runs on web via `react-native-web`. On a **wide browser viewport**
(`useResponsive().isDesktop`, ≥1024px), `RootNavigator` mounts a **dedicated
desktop shell** (`src/desktop/DesktopShell.tsx` when authed, `DesktopLogin.tsx`
when not) instead of the mobile tab navigator. Native and narrow mobile-web are
**untouched** — they keep the React Native screens.

**`src/desktop/` is web-only DOM code.** Because it only ever renders through
react-dom, raw JSX (`<div>`, `<select>`, `<svg>`, `<input>`) is valid and used
throughout. It has its **own view layer, separate from mobile**:

- `ui.tsx` — desktop component library (Card, Table, SlideOver, Btn, StatTile,
  Field, TextInput, money/lbs helpers…). **Not** the mobile `components/foundry`.
- `Icon.tsx` — desktop SVG icon set. `DesktopStyle.tsx` — injected global CSS
  (theme tokens as CSS custom properties, fonts, animations).
- `DesktopShell.tsx` — root: rail + top bar + active screen + slide-over overlays
  - keyboard shortcuts.
- `screens/` — Dashboard, Inventory, Sales, Customers, Compliance, Settings.
- `Flows.tsx` — the Buy and Sale slide-overs. `CloseDay.tsx` — day-close summary.
- `AdminActions.tsx` — admin-PIN **elevation** modals + `useDeskAdmin()`
  (`addMaterial`, `editPrice`, `editCompany`, `ensureElevated`).
- `print.ts` — purchase record / bill of lading / day-close via `Print.printAsync`.

**Rules for the two trees:**

- **Never import across trees.** Don't pull `src/components/` (RN) into
  `src/desktop/`, or `src/desktop/ui.tsx` into a mobile screen.
- The **data layer is shared** — desktop screens use the same `services/`,
  `hooks/`, and `store/` as mobile. Only the view differs.
- Privileged desktop writes go through `useDeskAdmin().ensureElevated()` (opens
  an admin-PIN window) exactly like mobile's `useAdminElevation()`.
- Flexbox scroll trap: a `flex:1` scroll child needs `min-height:0`
  (see `.screen-scroll` / `.yl-col` in `DesktopStyle.tsx`) or it pushes pinned
  footers off-screen instead of scrolling.

## Key Rules

- All Supabase queries live in `services/` — never in screens
- Load actions set `error` state; mutations throw
- All formatting utilities go in `utils/`
- Import from barrel exports where available (`services/index.ts`, `hooks/index.ts`)
- WatermelonDB models use decorators — `experimentalDecorators` is enabled
- Metals are dynamic (DB-managed) — never hardcode metal types
- Price overrides require admin auth and are tracked per line item
- Only admins/owners can CRUD metals and change pricing
- **Pricing unit**: a metal is priced by weight or by piece —
  `metals.pricing_unit` is `'lb' | 'each'`. For an `'each'` metal (converters,
  rims) `price_per_lb` doubles as $/piece; line_items & sales carry
  `unit` + `quantity`, `weight` is 0, and inventory accumulates `quantity` +
  `avg_cost_per_piece` in parallel to the weight columns. Totals are recomputed
  server-side (`enforce_line_item_pricing` / `enforce_sale_integrity`) — never
  trust the client total.

## Before Committing

- `npm run typecheck` — zero errors
- `npm run lint` — zero warnings
- `npm run format:check` — all files formatted
- Commit messages follow Conventional Commits (enforced by commitlint)
  - `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`, `test:`

## Multi-tenancy

Every yard is a **company**. Data is scoped per-company end-to-end — RLS
policies on every business table filter by `company_id = current_company_id()`.
Services don't filter explicitly; they rely on RLS.

- **Tables with `company_id` (NOT NULL)**: users, metals, metal_categories,
  receipts, line_items, inventory, sales, customers, access_codes,
  price_history, company_settings.
- **Company prefix format**: `{2-5 uppercase letters}-{YYYY}` (e.g. `GR-2026`).
- **Receipt numbers**: `{PREFIX}-{MMDDYYYY}-{N}`, sequence resets daily per
  company. Example: `GR-2026-04242026-1`.
- **Helper SQL functions**: `public.current_company_id()`,
  `public.is_admin()` (true for admin or owner), `public.is_owner()`.
  All SECURITY DEFINER and stable.

### Bootstrapping a new company

The service operator provisions new companies via Supabase SQL (no in-app
flow, no super-admin role). After creating the company row, insert an
owner invite so the first owner can sign up through the app:

```sql
insert into public.companies (name, prefix)
  values ('Gorilla Recycling', 'GR-2026')
  returning id;
-- copy that id, then:
insert into public.invite_codes (code, company_id, role, created_by)
  values ('XXXXXXXX', '<company_id>', 'owner', null);
```

## Auth & Roles

Three roles, in order of power:

- **`owner`** — full access within their company. Can invite/promote/demote
  anyone (including other owners), edit company profile, and everything
  admins can do.
- **`admin`** — can invite/manage admins and workers (not owners), manage
  metals/pricing, see all receipts/sales, override prices via access codes.
- **`worker`** — can create receipts and sales, view all yard data, cannot
  manage users or pricing.

`is_admin()` returns true for both admin **and** owner — existing policies
that gate on admin automatically grant owners the same rights without
having to double up.

### Sign-up flow

Self sign-up is disabled. New accounts require an **invite code** generated
by an owner or admin in their company. The code is 8-char uppercase
alphanumeric, passed via Supabase auth metadata (`options.data.invite_code`),
and the `handle_new_user` trigger validates + consumes it atomically. Invalid
or missing code = sign-up fails and the auth.users insert rolls back.

## Compliance & jurisdictions

State scrap-metal rules live in a **jurisdiction layer** (`src/compliance/
jurisdictions/`) so compliance is per-state, not hardcoded. New Mexico is the
first module.

- `types.ts` — the `Jurisdiction` contract (reportability rule, upload/CSV
  format + registry, hold/retention defaults, legal copy).
- `nm.ts` — New Mexico's implementation. `index.ts` — the registry +
  `getJurisdiction(company_settings.state)` (falls back to NM).
- `utils/reporting.ts` and `utils/nmrldExport.ts` are **thin back-compat shims**
  re-exporting the NM module — put new logic in a jurisdiction module, not there.
- **Adding a state** = add a module implementing `Jurisdiction`, register it in
  `index.ts`. Per-company numeric overrides (hold hours, retention, check-only,
  registration #, timezone) live in `company_settings` and are edited in the
  desktop Company Profile modal + read by the DB hold/retention triggers.
- ⚠️ The `report-to-state` edge function **duplicates** the reportability rule +
  CSV columns in Deno (can't import app code) — keep it in sync with `nm.ts`.

Reporting is **manual** (export CSV / "Send now" to the registry over SFTP); no
cron sweep is wired. See [docs/OPERATIONS.md](./docs/OPERATIONS.md).

## Deploy & ops

Web + Supabase are self-hosted on Coolify; migrations and edge functions are
applied by hand (no CI deploy, no migration ledger). Runbook:
[docs/OPERATIONS.md](./docs/OPERATIONS.md). Demo data: `supabase/seed/`.

## Feature map

Where each major subsystem lives (code + tables + invariants) is mapped in
[docs/FEATURES.md](./docs/FEATURES.md) — start there when picking up a feature.
