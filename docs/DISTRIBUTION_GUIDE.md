# YardLedger — Distribution Guide

How to build YardLedger and install it on employee phones and tablets (Android & iOS).

> **Important**: End users do NOT need Expo, Node.js, or any developer tools. They just install the app like any other app.

> **Scope**: this guide is the **mobile app** (build + install). For the
> **backend + web app** — Coolify deploys, applying migrations, edge-function
> deploys, and seeding — see **[OPERATIONS.md](./OPERATIONS.md)**.

---

## What You Need (One-Time Setup on YOUR Computer)

1. **Node.js** — Already installed if you've been developing.
2. **Expo account** — Free. Sign up at https://expo.dev.
3. **EAS CLI**:
   ```bash
   npm install -g eas-cli
   eas login
   ```
4. **Apple Developer account** ($99/year) — Only needed if distributing to iPhones/iPads. Not needed for Android.

---

## Step 1: Set Up Production Supabase

This replaces the local Docker database with a real cloud database.

1. Go to https://supabase.com and create a new project (free tier works to start).
2. Wait for the project to finish provisioning (~2 minutes).
3. Go to **Settings > API** and copy:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (starts with `eyJ...`)
4. **Apply the migrations.** Run **every** file in `supabase/migrations/` in
   filename order (there are far more than the original handful — the full set
   covers multi-tenancy, compliance/holds, PIN auth, cash drawer, per-piece
   pricing, etc.). Don't hand-list them here; it goes stale. Use the process in
   **[OPERATIONS.md](./OPERATIONS.md) §2** (or `supabase db push` against the
   project), then deploy the edge functions (**§3**) — the SQL Editor alone
   won't install `supabase/functions/`.

---

## Step 2: Configure the Build

Update your `.env` file with the production Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://abcdefg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-key-here
```

Update `eas.json` to produce an installable APK for Android:

```json
{
  "cli": {
    "version": ">= 18.1.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://abcdefg.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJhbGciOi...your-key-here"
      }
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## Step 3: Build the App

All build commands run on your computer. The build happens in the cloud on Expo's servers.

### Android (phones + tablets)

```bash
eas build --profile preview --platform android
```

- Takes ~10-15 minutes.
- When done, EAS gives you a **download link** for the `.apk` file.
- Download it and save it somewhere (Google Drive, USB stick, etc.).

### iOS (iPhones + iPads)

```bash
eas build --profile preview --platform ios
```

- Requires an **Apple Developer account** ($99/year).
- You'll need to register each device's UDID (EAS walks you through this).
- Produces an `.ipa` file.
- Distribute via **TestFlight** (easiest) or direct install via EAS.

### Both platforms at once

```bash
eas build --profile preview --platform all
```

---

## Step 4: Install on Devices

### Android (phones + tablets)

No app store needed. No Expo needed on the device.

1. **Send the APK** to the device via:
   - Google Drive link (easiest — just share the link)
   - WhatsApp / text message
   - Email attachment
   - USB cable
2. **Open the APK** on the device.
3. If prompted, tap **Settings** and enable **"Install from this source"** (one-time).
4. Tap **Install**.
5. Open YardLedger. Done.

### iOS (iPhones + iPads)

Option A — **TestFlight** (recommended):

1. Upload the `.ipa` to App Store Connect using `eas submit --platform ios`.
2. Add testers by email in TestFlight.
3. They get an invite, install TestFlight from the App Store, then install YardLedger through it.

Option B — **Direct install via EAS**:

1. Register each device's UDID at https://expo.dev (EAS has a device registration page).
2. Rebuild with those devices registered.
3. Share the install link EAS provides — they open it in Safari and tap Install.

---

## Step 5: Bootstrap the company + first owner

There is no "approve users" / `is_active` toggle anymore. You provision the
company and an owner **invite code** via SQL, then the owner signs up with it
(full steps in **[../CLAUDE.md](../CLAUDE.md) → Bootstrapping a new company**):

```sql
insert into public.companies (name, prefix)
  values ('Gorilla Recycling', 'GR-2026') returning id;
insert into public.invite_codes (code, company_id, role, created_by)
  values ('XXXXXXXX', '<company_id>', 'owner', null);
```

The owner opens the app, **Registers** with any email/password **+ that invite
code**, and becomes the owner. They then invite everyone else in-app (each gets
their own invite code) and fill in the Company Profile. After bootstrap you
never touch the DB for user management.

---

## Updating the App Later

### Small code changes (bug fixes, UI tweaks)

```bash
eas update --branch preview --message "fixed receipt formatting"
```

The app auto-downloads the update next time anyone opens it. No reinstall needed.

### Big changes (new native packages added)

```bash
eas build --profile preview --platform android
```

You'll need to redistribute the new APK. Users install it over the old one (no data loss — data lives in Supabase).

---

## Per-Yard Checklist

- [ ] Create Supabase project at supabase.com
- [ ] Apply **all** migrations + deploy edge functions ([OPERATIONS.md](./OPERATIONS.md) §2–§3)
- [ ] Put Supabase URL + anon key in `eas.json`
- [ ] Build: `eas build --profile preview --platform android`
- [ ] Download the APK and send it to the yard
- [ ] Insert the company row + owner invite code (Step 5)
- [ ] Yard owner registers with the invite code, then invites employees in-app
- [ ] Yard owner fills in Company Profile (name, address, logo, operating state)

---

## Troubleshooting

| Problem                                  | Solution                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **"App not installed"** on Android       | Uninstall any previous version first, then try again.                                              |
| **Can't find the APK** after downloading | Check the Downloads folder or notification tray on the device.                                     |
| **"Install blocked"** on Android         | Go to Settings > Apps > Special Access > Install Unknown Apps, and allow the browser/file manager. |
| **App opens but shows errors**           | The Supabase URL or key in `eas.json` is wrong. Rebuild with the correct values.                   |
| **User registers but can't log in**      | Admin needs to approve them from the Admin tab.                                                    |
| **iOS says "Untrusted Developer"**       | On the device: Settings > General > VPN & Device Management > trust the developer certificate.     |

---

## Cost Summary

| Item                       | Cost                                      |
| -------------------------- | ----------------------------------------- |
| Expo / EAS Build           | Free (up to 30 builds/month)              |
| Supabase                   | Free tier (500 MB database, 1 GB storage) |
| Apple Developer (iOS only) | $99/year                                  |
| Android distribution       | Free (sideloaded APK)                     |
