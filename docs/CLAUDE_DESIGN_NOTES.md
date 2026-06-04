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

## Open questions

- Reports list: which reports are "core" enough to deserve dashboard shortcuts
  vs. living only under the Reports tab?
- Do we want per-company branding (logo/accent) given the multi-tenant pivot,
  or one fixed Foundry identity across all yards?
