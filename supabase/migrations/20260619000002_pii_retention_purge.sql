-- Retention purge: scrub seller PII from buy receipts once the legal retention
-- window (NM 57-30: 1yr general / 3yr catalytic) has closed.
--
-- WHY: scrap law requires us to CAPTURE and KEEP seller ID for the window, but
-- data-minimization (and DL-data laws like the federal DPPA / state swipe laws)
-- says don't keep that PII longer than necessary. Receipts are immutable for the
-- compliance record, so the only permitted post-window mutation is a one-way
-- redaction that clears the identity fields and deletes the ID/seller/material
-- photos. The transaction itself (receipt #, totals, line items, dates) is
-- retained for business records. See docs/decisions/0001-id-retention-purge.md.
--
-- Flow (driven by the purge-expired-pii edge function, cron-capable):
--   1. pii_to_purge(company)      → past-retention, not-yet-purged receipts + photo paths
--   2. <delete those storage objects from the private bucket>
--   3. redact_receipt_pii(ids)    → null the PII columns, stamp pii_purged_at
-- Listing before deleting/redacting makes it crash-safe: a re-run re-lists the
-- same receipts (still unpurged) and re-deletes already-gone paths as a no-op.

alter table public.receipts
  add column if not exists pii_purged_at timestamptz;

-- ── Allow the one-way redaction through the immutability guard ───────────────
create or replace function public.enforce_receipt_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_years     int;
  v_cat_years int;
  v_required  int;
begin
  -- The ONLY permitted mutation of the frozen identity columns: a PII purge
  -- after the retention window. Enforced here so even an elevated admin can't
  -- alter (only clear) identity data, and never before the window closes.
  if new.pii_purged_at is not null and old.pii_purged_at is null then
    select general_retention_years, cat_converter_retention_years
      into v_years, v_cat_years
      from public.company_settings
      where company_id = old.company_id
      limit 1;
    v_required := case
                    when coalesce(old.is_catalytic, false)
                      then coalesce(v_cat_years, 3)
                    else coalesce(v_years, 1)
                  end;
    if old.created_at > now() - make_interval(years => v_required) then
      raise exception
        'Cannot purge PII before the %-year retention window closes (NM 57-30).',
        v_required;
    end if;
    -- Redaction must CLEAR identity data, not change it to a new value. This
    -- covers EVERY column redact_receipt_pii() clears — a partial list would let
    -- an unlisted PII field survive a "purge".
    if coalesce(new.customer_name, '') <> ''
    or coalesce(new.customer_phone, '') <> ''
    or coalesce(new.seller_name, '') <> ''
    or coalesce(new.seller_dl_number, '') <> ''
    or coalesce(new.seller_dob, '') <> ''
    or coalesce(new.seller_state_of_issue, '') <> ''
    or coalesce(new.seller_address, '') <> ''
    or coalesce(new.seller_city, '') <> ''
    or coalesce(new.seller_state, '') <> ''
    or coalesce(new.seller_zip, '') <> ''
    or coalesce(new.vehicle_plate, '') <> ''
    or coalesce(new.transport_vin, '') <> ''
    or coalesce(new.cat_converter_numbers, '') <> ''
    or new.seller_id_photo_uri is not null
    or new.seller_photo_uri is not null
    or new.material_photo_uri is not null
    or new.cat_converter_photo_uri is not null
    or new.cat_title_photo_uri is not null
    or new.signature_uri is not null
    then
      raise exception 'A PII purge may only clear identity fields, not alter them';
    end if;
    -- AND it must leave every other (compliance / business) column untouched.
    -- Without this an admin could piggy-back arbitrary edits (subtotal,
    -- is_catalytic, payment_method, receipt_number, …) onto the pii_purged_at
    -- flip and defeat immutability for the whole record.
    if new.receipt_number      is distinct from old.receipt_number
    or new.type                is distinct from old.type
    or new.subtotal            is distinct from old.subtotal
    or new.worker_id           is distinct from old.worker_id
    or new.notes               is distinct from old.notes
    or new.created_at          is distinct from old.created_at
    or new.customer_id         is distinct from old.customer_id
    or new.vehicle_description  is distinct from old.vehicle_description
    or new.seller_affirmed     is distinct from old.seller_affirmed
    or new.vehicle_year        is distinct from old.vehicle_year
    or new.vehicle_make        is distinct from old.vehicle_make
    or new.vehicle_model       is distinct from old.vehicle_model
    or new.vehicle_color       is distinct from old.vehicle_color
    or new.company_id          is distinct from old.company_id
    or new.payment_method      is distinct from old.payment_method
    or new.is_catalytic        is distinct from old.is_catalytic
    or new.hold_until          is distinct from old.hold_until
    or new.disposed_at         is distinct from old.disposed_at
    or new.reported_at         is distinct from old.reported_at
    or new.created_by_session  is distinct from old.created_by_session
    then
      raise exception
        'A PII purge may only clear identity fields, not alter other receipt data';
    end if;
    return new;
  end if;

  if new.receipt_number       is distinct from old.receipt_number
  or new.customer_name        is distinct from old.customer_name
  or new.customer_phone       is distinct from old.customer_phone
  or new.customer_id          is distinct from old.customer_id
  or new.type                 is distinct from old.type
  or new.signature_uri        is distinct from old.signature_uri
  or new.worker_id            is distinct from old.worker_id
  or new.company_id           is distinct from old.company_id
  or new.created_at           is distinct from old.created_at
  or new.vehicle_plate        is distinct from old.vehicle_plate
  or new.vehicle_year         is distinct from old.vehicle_year
  or new.vehicle_make         is distinct from old.vehicle_make
  or new.vehicle_model        is distinct from old.vehicle_model
  or new.vehicle_color        is distinct from old.vehicle_color
  or new.vehicle_description   is distinct from old.vehicle_description
  or new.seller_name          is distinct from old.seller_name
  or new.seller_dl_number     is distinct from old.seller_dl_number
  or new.seller_dob           is distinct from old.seller_dob
  or new.seller_state_of_issue is distinct from old.seller_state_of_issue
  or new.seller_address       is distinct from old.seller_address
  or new.seller_city          is distinct from old.seller_city
  or new.seller_state         is distinct from old.seller_state
  or new.seller_zip           is distinct from old.seller_zip
  or new.seller_affirmed      is distinct from old.seller_affirmed
  or new.seller_id_photo_uri  is distinct from old.seller_id_photo_uri
  or new.seller_photo_uri     is distinct from old.seller_photo_uri
  or new.material_photo_uri   is distinct from old.material_photo_uri
  or new.cat_converter_numbers is distinct from old.cat_converter_numbers
  or new.transport_vin        is distinct from old.transport_vin
  or new.cat_converter_photo_uri is distinct from old.cat_converter_photo_uri
  or new.cat_title_photo_uri  is distinct from old.cat_title_photo_uri
  or new.payment_method       is distinct from old.payment_method
  or new.is_catalytic         is distinct from old.is_catalytic
  then
    raise exception
      'Receipt records are immutable once created (NM 57-30); only subtotal, disposal, and hold status may change.';
  end if;
  return new;
end;
$$;

-- ── List receipts whose retention window has closed (with their photo paths) ──
create or replace function public.pii_to_purge(p_company uuid default null)
returns table (receipt_id uuid, photo_paths text[])
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    array_remove(array[
      r.seller_id_photo_uri,
      r.seller_photo_uri,
      r.material_photo_uri,
      r.cat_converter_photo_uri,
      r.cat_title_photo_uri
    ], null)
  from public.receipts r
  left join public.company_settings cs on cs.company_id = r.company_id
  where r.type = 'buy'
    and r.pii_purged_at is null
    -- A session is locked to its own company; only the no-session caller
    -- (service-role/cron) may target a company via p_company. Prevents an
    -- authenticated user enumerating another tenant's receipt IDs + private
    -- storage object paths by passing someone else's company uuid.
    and r.company_id = coalesce(public.current_company_id(), p_company)
    and r.created_at < now() - make_interval(years =>
      case when coalesce(r.is_catalytic, false)
        then coalesce(cs.cat_converter_retention_years, 3)
        else coalesce(cs.general_retention_years, 1) end);
$$;

revoke all on function public.pii_to_purge(uuid) from public;
grant execute on function public.pii_to_purge(uuid) to authenticated;

-- ── Redact the PII (after the storage objects have been deleted) ──────────────
create or replace function public.redact_receipt_pii(p_receipt_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.receipts set
    customer_name = '',
    customer_phone = '',
    seller_name = '',
    seller_dl_number = '',
    seller_dob = '',
    seller_state_of_issue = '',
    seller_address = '',
    seller_city = '',
    seller_state = '',
    seller_zip = '',
    vehicle_plate = '',
    transport_vin = '',
    cat_converter_numbers = '',
    seller_id_photo_uri = null,
    seller_photo_uri = null,
    material_photo_uri = null,
    cat_converter_photo_uri = null,
    cat_title_photo_uri = null,
    signature_uri = null,
    pii_purged_at = now()
  where id = any (p_receipt_ids)
    and pii_purged_at is null
    -- in-app callers scoped to their company; service-role/cron (no session) all
    and (public.current_company_id() is null
         or company_id = public.current_company_id());
  -- The immutability guard enforces the retention window on each row.
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.redact_receipt_pii(uuid[]) from public;
grant execute on function public.redact_receipt_pii(uuid[]) to authenticated;
