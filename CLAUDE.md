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

## Key Rules

- All Supabase queries live in `services/` — never in screens
- Load actions set `error` state; mutations throw
- All formatting utilities go in `utils/`
- Import from barrel exports where available (`services/index.ts`, `hooks/index.ts`)
- WatermelonDB models use decorators — `experimentalDecorators` is enabled
- Metals are dynamic (DB-managed) — never hardcode metal types
- Price overrides require admin auth and are tracked per line item
- Only admins/owners can CRUD metals and change pricing

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
