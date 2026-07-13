# Tare (YardLedger)

Offline-capable **scrap-metal yard management** app — buy tickets, inventory,
sales, and state compliance for a recycling yard. Multi-tenant (every yard is a
company). Distributed as an unlisted iOS app; also runs as a desktop web app.

- **Mobile:** Expo / React Native (the counter terminal on a phone or tablet)
- **Desktop:** the same codebase rendered via `react-native-web` — on wide
  browser viewports it mounts a **dedicated desktop shell** (`src/desktop/`)
  instead of the mobile tab UI.
- **Backend:** Supabase (Postgres + RLS + Auth + edge functions)
- **State:** Redux Toolkit · **Nav:** React Navigation v7 · **Offline:** WatermelonDB (scaffolded)

> Architecture rules, layering, naming, multi-tenancy and auth are documented in
> **[CLAUDE.md](./CLAUDE.md)** — read that after this. This file is how to get running.

---

## Prerequisites

| Tool               | Notes                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node**           | Use a known-good LTS (e.g. 20 or 22). Pinned via `.nvmrc` (Node 20) — run `nvm use`. ⚠️ Node 26 broke the husky/npx pre-commit hook, so stick to the pinned LTS. |
| **Docker Desktop** | Runs the local Supabase stack. Must be running before `npm run dev`.                                                                                             |
| **Supabase CLI**   | `brew install supabase/tap/supabase`                                                                                                                             |
| **Xcode**          | Only for the **iOS** build (the app uses native modules — document scanner, ML Kit, signature — so **Expo Go won't work**; you need a custom dev client).        |

## First-time setup

```bash
npm install

# Local env — point at the local Supabase stack.
cp .env.example .env.local
# Fill EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY from `supabase status`
# (run `npm run dev` once first to boot Supabase, then copy the printed keys).

# One-time native dev-client build (mobile). Re-run only when native deps change.
npx expo run:ios
```

## Running

```bash
npm run dev          # Supabase + edge functions + app on the iOS simulator
npm run web          # desktop/web only (react-native-web via Metro)
npm run dev:stop     # tear everything down, free the ports
npm run dev:status   # what's running
npm run dev:reset    # WIPE local DB + re-run all migrations + seed (prompts)
```

`npm run dev` orchestrates the whole local stack (`scripts/dev.sh`): starts
Supabase (idempotent), serves edge functions in the background, then launches
the app. Ctrl-C tears it all down.

### First-run login (local)

The seed (`supabase/seed.sql`) creates a company **Gorilla Recycling (GR-2026)**
and an **owner invite code: `GORILLA1`**. Sign-up is invite-only, so:

1. In the app's sign-up screen, register with any email/password **+ invite code `GORILLA1`**.
2. That makes you the **owner** of GR-2026.
3. You'll be prompted to set a 4-digit **admin PIN** (owners/admins need one to
   authorize privileged actions).

Sign-in is two-step by design: **email+password** anchors the device to a
company; a **PIN** identifies the staffer at the shared counter. See the
`user-pin` migrations and CLAUDE.md → Auth.

> Invite codes are single-use. If `GORILLA1` is already consumed, `npm run dev:reset`
> re-seeds a fresh one.

### Desktop web

`npm run web` serves the app through Metro. The **desktop shell mounts only on
wide viewports** (`useResponsive().isDesktop`, ≥1024px) — narrow web still gets
the mobile UI. For a production-style build:

```bash
npx expo export --platform web        # → dist/
python3 -m http.server 8080 --directory dist
```

---

## Project layout

```
src/
  components/   shared React Native UI (mobile) — e.g. AddMaterialKeypad, foundry
  config/       supabase client
  constants/    theme tokens
  db/           WatermelonDB schema, models, migrations, sync (offline cache)
  desktop/      ⚠️ WEB-ONLY desktop shell (see below + CLAUDE.md)
  hooks/        data-fetching hooks (useMetals, useReceipts, useCustomers, …)
  navigation/   RootNavigator picks mobile vs desktop shell
  screens/      mobile screens (auth, transactions, inventory, sales, admin, customers)
  services/     Supabase data access — the ONLY place queries live
  store/        Redux slices (auth, app)
  types/        shared types
  utils/        pure helpers (formatting, print, share, AAMVA ID parse)
supabase/
  migrations/   sequential timestamped SQL (RLS, triggers, RPCs)
  functions/    Deno edge functions
  seed.sql      local company + invite code
docs/           APP_GUIDE, DISTRIBUTION_GUIDE, design notes, decisions/ (ADRs)
scripts/dev.sh  local stack orchestrator
```

**Two UI trees — don't mix them:**

- `src/screens/` + `src/components/` = **React Native** (mobile + mobile-web).
- `src/desktop/` = **web-only DOM** rendered through `react-native-web` (raw
  `<div>`/`<select>`/`<svg>` JSX, its own `ui.tsx` component lib and
  `DesktopStyle.tsx` CSS). Both trees share the **same `services/`, `hooks/`,
  `store/`** — only the view layer differs.

---

## Conventions & workflow

- **Layering (enforced):** `DB migration → service → store/hook → screen`. Never
  call Supabase from a screen/component.
- **TypeScript strict**, ESLint, Prettier. **Conventional Commits** (commitlint).
- Pre-commit runs `lint-staged` (eslint --fix + prettier). Before pushing:
  ```bash
  npm run typecheck && npm run lint && npm run format:check
  ```
- No automated test suite yet — changes are verified manually; see `docs/test-cases.md`.

## Troubleshooting (gotchas we've actually hit)

- **Port conflict with another local Supabase project.** Only one Supabase stack
  can hold the default ports. Stop the other (`npm run dev:stop` in its repo). If
  its containers keep resurrecting, they have a Docker `unless-stopped` restart
  policy: `docker update --restart=no <container>` then `docker stop` it.
- **New migration not applied / "function … not found in schema cache."** A
  _stale local DB volume_ won't pick up new migrations on `supabase start`. Run
  `supabase migration up --local` (keeps data) or `npm run dev:reset` (wipes).
- **Pre-commit hook fails (`Cannot find module '.../npx'`).** A Node upgrade
  broke the path. Reinstall/re-point Node (a pinned LTS avoids this); as a
  one-off, `git commit --no-verify` after running the checks manually.
- **iOS build uses a dead Node path.** Delete `ios/.xcode.env.local` so it falls
  back to `$(command -v node)`.

## Deployment

See **[docs/DISTRIBUTION_GUIDE.md](./docs/DISTRIBUTION_GUIDE.md)** — Xcode archive
→ unlisted App Store distribution.
