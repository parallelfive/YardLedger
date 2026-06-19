# 0001 — Seller ID capture, retention, and auto-purge

**Status:** Accepted · 2026-06-19
**Area:** Compliance / privacy / data handling

> Not legal advice. This records _why_ we built it this way so the next person
> (and a reviewing attorney) understands the intent. Confirm specifics with
> counsel for each state you operate in.

## Context

YardLedger buys scrap from walk-in sellers. State scrap-metal law (we target
**NM 57-30** today) **requires** dealers to record the seller's identity on each
purchase — name, address, DL number, DOB, often a **photo of the ID, the seller,
and the material**, plus vehicle/transport details. So we don't have a choice
about _capturing_ it; the questions are how we **store**, **protect**, and
**dispose of** it.

The tension:

- **Keep it long enough** — the law sets a minimum retention (NM: **1 year**
  general records, **3 years** for catalytic converters). Records can't be
  deleted inside that window.
- **Don't keep it longer than necessary** — data-minimization best practice, and
  driver's-license-data laws (the federal **DPPA** and various state
  "license-swipe" statutes) restrict _using_ DL-derived data beyond the lawful
  purpose and discourage indefinite retention. A breach of DL#/DOB/address/photo
  PII is exactly the kind that's costly and reportable.

## Decisions

1. **Capture is mandatory and stays.** The buy flow collects the seller ID/PII
   the statute requires. This is a feature, not a liability to remove.

2. **Store it defensively.** (Already in place.)
   - ID/seller/material photos live in a **private storage bucket**, referenced
     by **object path** — never a public URL. Consumers mint a **short-lived
     signed URL** on demand (`services/storage.signPrivatePath`).
   - **RLS** scopes every read to the owning company (`current_company_id()`).
   - Raw Postgres errors are scrubbed before logging so DL#/address can't leak
     into device logs.
   - Receipts are **immutable** for the compliance record
     (`enforce_receipt_immutability`), and **can't be deleted inside the
     retention window** (`enforce_receipt_retention`).

3. **Auto-purge PII once retention closes** — the new part. After a receipt's
   window passes, scrub the personal data but **keep the transaction record**
   (receipt #, totals, line items, metals, dates, payment method) for business
   history. Implemented as a **one-way redaction**, not a delete:
   - The immutability guard permits exactly one post-window mutation: clearing
     the identity fields (it rejects any _alteration_, and rejects purging
     _before_ the window — verified in tests).
   - `pii_to_purge(company)` lists past-window, not-yet-purged receipts and their
     photo object paths.
   - The **`purge-expired-pii` edge function** (cron-capable, owner-only when
     called from the app) deletes those photo objects from the bucket, then
     `redact_receipt_pii(ids)` nulls the PII columns and stamps `pii_purged_at`.
   - **Crash-safe**: list → delete files → redact. A re-run re-lists the same
     receipts (still unpurged) and re-deletes already-gone paths as a no-op, so a
     mid-run failure never half-purges.

### What gets cleared vs kept

| Cleared (PII)                                                            | Kept (business record)                          |
| ------------------------------------------------------------------------ | ----------------------------------------------- |
| customer/seller name & phone, DL#, DOB, address/city/state/zip, DL state | receipt number, type, created_at                |
| vehicle plate, transport VIN, cat-converter serials                      | subtotal, line items, metals, weights           |
| ID / seller / material / cat photos (files deleted)                      | payment method, is_catalytic, hold_until        |
| signature image                                                          | seller_affirmed flag, `pii_purged_at` timestamp |

## Why redact instead of delete the whole receipt

Deleting the row would lose financial/inventory history and break referential
integrity (line items, inventory math). Redaction removes the _personal_ data
(the actual liability) while preserving the _transaction_, which is the
data-minimization sweet spot.

## Scope & limitations (v1)

- **Receipts only.** The receipt snapshots the seller identity at purchase time —
  that's the compliance record. The **`customers` roster** (a convenience table
  with its own DL photo/DOB/address) is **not** purged yet: a returning customer
  may still have in-window receipts, so it needs a "no in-window receipts → purge
  the roster PII" rule. **Follow-up.**
- **Scheduling is ops.** The edge function is cron-capable (`x-cron-secret`) but
  the actual schedule (e.g., nightly) must be wired in the deploy environment,
  same as `report-to-state`. Until then it can be run manually by an owner.
- **Retention values are per-company** (`company_settings.*_retention_years`,
  defaulting to NM's 1/3 years) so other states can override.
- **Legal review recommended** for the exact states in play — DPPA + any state
  license-swipe/retention statute, and whether photo retention has stricter
  rules than field retention.

## Related: desktop / peripheral capture (future)

On a desktop/web station we intend to capture via **connected hardware** rather
than the phone camera: a **2D barcode scanner** reads the PDF417 on the back of a
US driver's license (far more reliable than camera OCR) and a **USB signature
pad** captures the signature. This changes _how_ PII is captured but not the
retention/purge model above — the same fields land in the same place and age out
the same way.

## Implementation pointers

- Migration `supabase/migrations/20260619000002_pii_retention_purge.sql`
  (`pii_purged_at`, immutability exemption, `pii_to_purge`, `redact_receipt_pii`).
- Edge function `supabase/functions/purge-expired-pii/`.
- Existing guards: `20260603000004` (retention), `20260603000006` (immutability).
