# Notes for Claude Design

Running list of things the current handoff didn't cover, features that don't
cleanly map to the prototype, and assets/specs we still need. Nothing here was
deleted from the codebase — it's all preserved and noted for a follow-up design
pass.

## Need design specs / assets

1. **Light theme ("Daybook") — full screen coverage.** We implemented a
   complete light palette that mirrors every Nightshift token, and the app now
   follows the device's light/dark setting. The handoff only showed dark
   ("Nightshift") screens, so the light-mode values (surfaces, ink, lines) are
   our best interpretation of the prototype's `--bg/--surface/--ink` light
   tokens. Need: confirmation of the light palette per screen, especially
   chip/border contrast and accent-on-light legibility.

2. **Live in-app theme toggle.** Requested but deferred. Every screen reads a
   static `colors` object inside `StyleSheet.create` (snapshotted at module
   load), so a _runtime_ toggle needs a `useTheme()` context threaded through
   all screens. Currently the app instead follows the OS color scheme at
   launch. Need: a design decision on whether a manual in-app toggle is worth
   the refactor, or whether "follow system" is the intended behavior.

3. **Custom iconography.** We use Ionicons throughout. The prototype appears to
   use custom/SVG glyphs in places. Need: an icon set (SVG) or confirmation
   that Ionicons are acceptable.

4. **Charts / data-viz.** The Sparkline and MetalMixBar are View-based bar
   renditions (no chart library). They read as the prototype's trend strips but
   aren't true line/area charts. Need: confirmation, or specs if richer charts
   (axes, tooltips, area fills) are wanted for Reports.

## Features with no prototype screen (kept, awaiting design)

These exist and work, but the handoff had no matching screen. Left in place:

- **State reporting status** (`ReportingStatusScreen`) — pending-uploads count,
  last upload, export-unreported-CSV + mark-reported flow. NM 2-business-day
  upload compliance. No prototype screen; built in Foundry style.
- **Holds & disposal workflow** — On-Hold report rows are tappable through to
  the receipt; receipts show a "Disposed" status chip once disposed. Catalytic
  60-day / general 24h hold windows. Prototype showed holds only implicitly.
- **Compliance report + NMRLD CSV export** (`ComplianceReportScreen`,
  `buildNmrldExportCsv`). No prototype screen.
- **Shrinkage report** (`ShrinkageScreen`) — expected-vs-actual inventory
  variance. No prototype screen.
- **Pending approval / invite-code flows** (`PendingApprovalScreen`, register
  with invite code). Multi-tenant onboarding has no prototype coverage.
- **Admin: user management, metals/pricing CRUD, access codes (admin PINs).**
  Reskinned to Foundry but no dedicated prototype screens.

## Screen rebuilds — design structure, not just reskin

- **New Buy** (`NewTransactionScreen`) — rebuilt to the prototype's tier-aware
  adaptive **stepper** (`screen-buy.jsx` BuyFlow): weigh materials first, the
  app derives the required steps from the governing tier. One deliberate
  deviation: the prototype's **"Proof of ownership" step** for _restricted,
  non-catalytic_ material (e.g. burnt copper wire) is NOT built — our DB has no
  proof-of-ownership photo/note columns. Restricted currently follows the same
  steps as regulated (seller + vehicle). Need: DB columns
  (`proof_photo_uri`, `proof_note`) + a migration if we want this step.
  Also: the prototype's keypad-based "Add material" sheet was kept as our
  existing `AddLineItemModal` (it has scale gross/tare capture the keypad
  mockup lacks).
- **Stock** (`InventoryScreen`) — rebuilt to the design: on-hand value hero,
  dynamic category chips (Restricted included), metal rows with price-now-vs-avg
  spread delta + tone accent. Set aside vs prototype: value hero has no
  delta/sparkline (we have no historical valuation series to chart).
- **Sales** (`SalesScreen`) — rebuilt to the design: sold/profit stat cards +
  Outbound-loads list (truck rows, revenue + profit delta). Set aside: in-screen
  search and the profit-by-category breakdown (both still in the service and the
  Profitability report); our model has no paid/pending status the prototype
  shows, so the second stat card is gross profit instead of "awaiting pay".
- **App shell** — rebuilt: light-default theme + working light/dark toggle,
  5-slot tab bar (Home · Stock · ＋ · Sales · Reports) with center FAB + Quick
  Actions sheet, header overflow menu for Customers/Admin/Pricing.
- **Still reskinned-but-not-structurally-rebuilt**: New Buy/Sale need the
  full-screen overlay header + keypad (logic done, chrome pending); Reports tab
  (ours is a multi-report index, the prototype's is compliance-first — needs a
  product call), the individual Report detail screens, Admin, Settings,
  Customers.

## Open questions

- Reports list: which reports are "core" enough to deserve dashboard shortcuts
  vs. living only under the Reports tab?
- Do we want per-company branding (logo/accent) given the multi-tenant pivot,
  or one fixed Foundry identity across all yards?
