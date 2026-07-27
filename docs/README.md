# Docs index

Everything in `docs/`, grouped by purpose. New here? Follow **Start here** top to
bottom.

## Start here (onboarding path)

1. **[../README.md](../README.md)** — get the app running (prereqs, local stack, login).
2. **[../CLAUDE.md](../CLAUDE.md)** — architecture, layering, naming, multi-tenancy, auth. The rules.
3. **[FEATURES.md](./FEATURES.md)** — subsystem map: where each feature lives + its tables/invariants. Start here when picking up a feature.
4. **[OPERATIONS.md](./OPERATIONS.md)** — how to ship: deploys, migrations by hand, edge functions, seeding.

## Operations & release

- **[OPERATIONS.md](./OPERATIONS.md)** — backend + web app: Coolify deploys, migrations, edge fns, demo seed, release checklist.
- **[DISTRIBUTION_GUIDE.md](./DISTRIBUTION_GUIDE.md)** — mobile app: EAS build, iOS/Android install, per-yard provisioning.

## Reference

- **[test-cases.md](./test-cases.md)** — manual QA scripts (buy/sell/compliance flows, local staffers + PINs).
- **[CLAUDE_DESIGN_NOTES.md](./CLAUDE_DESIGN_NOTES.md)** — design-handoff notes: what was kept vs. rebuilt, known gaps.
- **[TARE_REBRAND.md](./TARE_REBRAND.md)** — the Tare rebrand (shipped): what changed and follow-ups.
- **[APP_GUIDE.md](./APP_GUIDE.md)** / [APP_GUIDE_ES.md](./APP_GUIDE_ES.md) — end-user guide. ⚠️ Partially out of date (predates several subsystems); FEATURES.md + CLAUDE.md are authoritative for engineers.

## Decisions (ADRs)

Accepted architectural decisions — the _why_, for the next engineer (and a
reviewing attorney). Add new ones as `decisions/NNNN-title.md`.

- **[decisions/0001-id-retention-and-purge.md](./decisions/0001-id-retention-and-purge.md)** — seller-ID capture, retention windows, and auto-purge (compliance/privacy).

## Proposals (RFCs)

> ⚠️ **Drafts — NOT the current architecture.** These are proposals under
> discussion; the shipped stack is Supabase (see CLAUDE.md). Don't build against
> an RFC unless it's been accepted and moved into the code.

- **[BACKEND_MIGRATION_RFC.md](./BACKEND_MIGRATION_RFC.md)** — _Draft._ Proposal to move the backend off Supabase → Neon + BetterAuth + Drizzle + Hono. Not started.
- **[ENTITLEMENTS_AND_PORTAL_RFC.md](./ENTITLEMENTS_AND_PORTAL_RFC.md)** — _Draft._ Add-on entitlements (tiers) + an operator portal. Not started.

---

_Adding a doc? Drop it in the right group above with a one-line "what it is."
ADRs are immutable once accepted; RFCs get a `Status:` line (Draft → Accepted →
Superseded)._
