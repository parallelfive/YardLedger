# Tare rebrand — status & follow-ups

Rebrand of the app to **Tare** ("Get to the true net") from the new design
handoff. Reuses the existing copper + Daybook/Nightshift palette, live theming,
and the 5-tab + FAB shell.

## Done (branch `feat/tare-rebrand`)

- **Brand**: `TareMark` (balance-scale SVG, copper rounded square) + `Wordmark`
  ("tare"). `react-native-svg` added.
- **Passcode terminal login** (`PasscodeLoginScreen`) — brand lockup, company
  chip, role picker, 4-dot PIN, keypad, shake-on-error, "sign out" escape.
- **PIN auth backend** (migration `20260605000001`): `users.pin_hash` (bcrypt),
  `set_pin` / `validate_pin` RPCs, per-company PIN uniqueness, 5-try/15-min
  lockout (`pin_attempts`). `services/pin.ts` wraps them.
- **Auth flow**: device holds the company session; `activeIdentity` in the auth
  store is set from the signed-in profile (source `session`) or a PIN-in
  (source `pin`). `PasscodeGate` shows when locked. `AutoLock` re-locks after
  5 min idle / long background — **only once someone has PIN'd in**, so a
  freshly email-signed-in user (no PIN) is never stranded. Manual "Lock
  terminal" in the header menu.
- **Set-PIN UI**: Settings → Account → Shift PIN (two-step keypad).
- **Day book dashboard header**: mark + wordmark + company chip + theme toggle
  - settings cog + "Day book" title/date.
- **App name** → "Tare" (`app.json`); `userInterfaceStyle` → automatic.

## Needs a native rebuild

`react-native-svg` is a native module — run `npx expo run:ios` (the dev client
must be rebuilt) before the Tare mark renders. A JS reload alone won't pick it
up. Same for anyone pulling this branch.

## Follow-ups / decisions

1. **App icon + splash** still use the old YardLedger art. They need
   regenerating with the Tare mark (copper rounded square + white balance scale)
   — that's an image asset task (`assets/final-icon.jpg`, `assets/splash-*`).
   The in-app `TareMark` component is the source of truth for the glyph.
2. **Archivo Expanded**: the wordmark uses Archivo ExtraBold (closest installed
   weight). True Archivo Expanded 800 (the design's display face) needs a
   bundled width-axis `.ttf` + `expo-font` registration.
3. **Scheme / bundle id unchanged** (`yardledger` / `com.parallelfive.YardLedger`)
   to preserve the existing build identity + auth deep links. If a `tare://`
   scheme is wanted, also update `emailRedirectTo` in `authStore.signUp`.
4. **Server role vs PIN identity**: client UI now gates on the PIN'd staffer's
   role via `useRole()` (activeIdentity → session fallback). RLS/`is_admin()`
   still derive from the device's Supabase session user, so provision the device
   with an admin/owner account and let PINs gate the UI per staff; elevated
   actions also remain gated by access codes. A fully server-enforced per-PIN
   role would require minting a session per PIN (the "PIN replaces login" model
   we did not choose). DONE (UI gating).
5. **`worker_id` attribution** — DONE. Receipts/sales record
   `activeIdentity.user_id`; migration `20260605000002` relaxes the INSERT
   policies to "staff in the device's company" (still tenant-safe).
6. **Prod**: apply migrations `20260605000001` + `20260605000002`
   (`supabase db push`) before shipping; PIN sign-in is inert until staff set
   PINs.
