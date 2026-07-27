# Subsystem Map

A **map, not a manual** — for each major feature: where the code lives, which
tables/triggers back it, the one invariant to respect, and its status. Deliberately
pointer-heavy so it ages well; for behavior, read the code it points at. Rules &
layering live in [../CLAUDE.md](../CLAUDE.md); getting-running in
[../README.md](../README.md); deploy in [OPERATIONS.md](./OPERATIONS.md).

> Two UI trees share one data layer: `src/screens/`+`src/components/` (mobile RN)
> and `src/desktop/` (web DOM) both call the same `services/` / `hooks/` / `store/`.
> Most features below have a mobile view and a desktop view over shared services.

---

## Buy ticket (core)

- **Code:** `screens/transactions/NewTransactionScreen` + `hooks/useNewTransaction` (mobile); `desktop/Flows.tsx` `BuyFlow` (desktop). Line entry: `components/AddMaterialKeypad` (mobile) / the Flows line rows (desktop).
- **DB:** `receipts` + `line_items`; RPC `create_receipt_with_items` (atomic insert); triggers `enforce_line_item_pricing` (recomputes each line total server-side), `recompute_receipt_subtotal`, `generate_receipt_number` (`{PREFIX}-{MMDDYYYY}-{N}`, daily reset per company), `update_inventory_on_buy`.
- **Invariant:** never trust a client-sent total — the DB recomputes it. Receipts are **immutable** after insert (`enforce_receipt_immutability`); only subtotal/hold/disposal/notes may change.

## Pricing units — weight vs per-piece

- **What:** metals are priced by **weight** (`$/lb`) or by **piece** (`$/each` — converters, rims). `metals.pricing_unit` `'lb'|'each'`.
- **Code:** buy/sell flows branch on unit; `types/index.ts` (`PricingUnit`, `LineItemInput.unit/quantity`).
- **DB:** migrations `20260726000001/002/003`. `line_items` + `sales` carry `unit`+`quantity`; `inventory` carries parallel `quantity`+`avg_cost_per_piece`; triggers branch on unit (`enforce_line_item_pricing`, `update_inventory_on_buy`, `enforce_sale_integrity`, `update_inventory_on_sale`).
- **Invariant:** an `'each'` line has `weight = 0`; total = `quantity × price`. Weight metrics must exclude piece rows (and vice-versa).
- **Status:** buy = desktop + mobile; **sell = desktop only** (mobile sell filters `weight>0`, so pieces don't appear — a deliberate follow-up).

## Tare weight (gross − tare)

- **Code:** `AddMaterialKeypad` tare mode + `hooks/useTarePresets`; desktop Flows tare fields.
- **DB:** `line_items.gross_weight`/`tare_weight` (migration `20260313000001`); `tare_presets` table (`20260707000001`).
- **Invariant:** net (what's paid) = `max(0, gross − tare)`; the receipt stores gross/tare alongside net.

## Inventory & sales

- **Code:** `services/inventory.ts`, `services/sales.ts`; `desktop/screens/Inventory.tsx` + `Sales.tsx` + Flows `SaleFlow`; mobile `screens/inventory` + `screens/sales`.
- **DB:** `inventory` (weighted-avg cost, auto-maintained by buy/sale triggers), `sales`; `enforce_sale_integrity` (blocks oversell, server-authoritative cost/revenue/profit), `inventory_weight_non_negative` / `inventory_quantity_non_negative` checks.
- **Invariant:** cost basis + profit are computed server-side from weighted-avg inventory cost, never the client.

## Two-station handoff (scale ticket → cashier)

- **What:** a worker weighs material on a phone at the scale, sends a **draft ticket**; a cashier finalizes the payout (ID/photos/payment) at the desk.
- **Code:** `screens/transactions/ScaleTicketScreen` (worker, mobile) → `services/draftTickets` → `desktop/CashierQueue.tsx` + `Flows.tsx` (cashier seeds a BuyFlow from the draft).
- **DB:** `draft_tickets` (migrations `20260721000003/004`).
- **Invariant:** the draft carries everything the cashier needs so no data is re-entered; finalizing links `receipt_id` and clears the draft (guard against double-payout).

## Compliance & state reporting

- **What:** capture (seller ID / vehicle / affirmations / photos), statutory **holds**, the **reportability queue**, CSV export, and a manual SFTP **"Send now"** to the state registry. Rules are **per-state** via the jurisdiction layer.
- **Code:** `src/compliance/jurisdictions/` (`types.ts` contract, `nm.ts` New Mexico, `index.ts` registry + `getJurisdiction(company_settings.state)`). `utils/reporting.ts` + `utils/nmrldExport.ts` are **thin shims** → the NM module (don't add logic there). `desktop/screens/Compliance.tsx`; `services/reporting.ts`; edge fn `supabase/functions/report-to-state`.
- **DB:** capture/hold columns on `receipts`; per-company knobs on `company_settings` (`state`, `general_hold_hours`, `cat_converter_hold_days`, `cat_converter_check_only`, retention years, `timezone`, registration #) edited in the desktop Company Profile modal + read by the hold trigger; `company_reporting_config` (SFTP) + `compliance_upload_log`.
- **Invariant:** reportability logic is **duplicated** in the Deno edge fn (can't import app code) — keep `nm.ts` and `report-to-state/index.ts` in sync. NM = a single 24h hold on all regulated material (no 60-day catalytic hold).
- **Status:** **manual** — no cron sweep is scheduled and the SFTP format isn't validated against a live LeadsOnline account yet. Adding a state = a new module in `jurisdictions/`.

## Cash drawer / day close

- **Code:** `services/cashDrawer.ts` + `hooks/useCashDrawer`; `screens/reports/CashDrawerScreen` (mobile) + `desktop/CloseDay.tsx`.
- **DB:** `cash_drawer_sessions` (migration `20260619000001`).
- **What:** opening float − cash buys = expected; count → over/short. Day-close summarizes buys/sales/payouts.

## Auth, roles & multi-tenancy

- **What:** email+password anchors the device to a **company**; a **PIN** identifies the staffer at a shared terminal. Roles owner > admin > worker. Sign-up is **invite-code only**.
- **Code:** `screens/auth`, `desktop/DesktopLogin`; `store/authStore`; admin elevation `hooks/useAdminElevation` (mobile) / `desktop/AdminActions` `useDeskAdmin` (desktop).
- **DB:** `invite_codes` (`handle_new_user` validates+consumes), `access_codes` (reusable admin PINs), `users`; helpers `current_company_id()`, `is_admin()`, `is_owner()`. **Every business table has `company_id` + RLS** filtering by `current_company_id()` — services never filter by company explicitly.
- **Invariant:** privileged writes are gated server-side (RLS + `has_admin_elevation`), not just in the UI.

## Alerts (desktop)

- **Code:** the header bell in `desktop/TopBar.tsx`; the list is built in `DesktopShell.tsx` from `useReceipts` + `useDraftTickets` (cashier tickets waiting, buys awaiting state report).

---

_Keep this current when you add a subsystem: one entry, pointer-style. If you find
an entry wrong, fix it in the same PR — a stale map is worse than none._
