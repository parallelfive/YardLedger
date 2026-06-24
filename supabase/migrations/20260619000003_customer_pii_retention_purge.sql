-- Retention purge, part 2: scrub regulated ID data from the customers ROSTER.
--
-- The receipt purge (20260619000002) minimizes the compliance record. But a
-- regulated seller also has a convenience roster row (customers) carrying its
-- own DL#, DL photo, DOB and address — captured/updated on each buy. That data
-- must be minimized too once we no longer need it.
--
-- REFERENCE-AWARE: a returning seller may still have in-window receipts, and the
-- law requires us to keep their ID for those. So a roster row is purgeable only
-- when the person has NO buy receipt still inside its retention window (general
-- 1yr / catalytic 3yr). Naively purging the roster by age could delete ID we are
-- still legally required to hold. See docs/decisions/0001-id-retention-purge.md.
--
-- WHAT IS CLEARED: the regulated driver's-license data the DPPA / state swipe
-- laws target — drivers_license, dl_photo_uri (object deleted), address, dob,
-- notes. WHAT IS KEPT: name, phone, and the is_flagged / flag_reason safety
-- signal — lower-sensitivity CRM/business data, and the flag must keep working
-- to refuse a known bad actor. The roster row itself is kept so receipt
-- customer_id references stay intact.
--
-- Flow (driven by the purge-expired-pii edge function, alongside the receipts):
--   customers_pii_to_purge(company) → eligible roster rows + their DL photo path
--   <delete those storage objects from the private bucket>
--   redact_customer_pii(ids)        → clear the regulated columns
-- Listing before deleting is crash-safe and idempotent: a purged row no longer
-- carries PII, so it drops out of the list on the next run.

-- ── List roster rows whose regulated ID data may be purged ───────────────────
create or replace function public.customers_pii_to_purge(p_company uuid default null)
returns table (customer_id uuid, photo_paths text[])
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    array_remove(array[c.dl_photo_uri], null)
  from public.customers c
  -- A session is locked to its own company; only the no-session caller
  -- (service-role/cron) may target a company via p_company. Prevents an
  -- authenticated user enumerating another tenant's customer IDs + private
  -- DL-photo object paths by passing someone else's company uuid.
  where c.company_id = coalesce(public.current_company_id(), p_company)
    -- still has regulated ID data to clear (keeps the list idempotent)
    and (coalesce(c.drivers_license, '') <> ''
         or c.dl_photo_uri is not null
         or coalesce(c.address, '') <> ''
         or c.dob is not null
         or coalesce(c.notes, '') <> '')
    -- has buy history to age against (don't purge brand-new / never-transacted)
    and exists (
      select 1 from public.receipts r
      where r.customer_id = c.id and r.type = 'buy'
    )
    -- reference-aware: NO buy receipt still inside its retention window
    and not exists (
      select 1
      from public.receipts r
      left join public.company_settings cs on cs.company_id = r.company_id
      where r.customer_id = c.id
        and r.type = 'buy'
        and r.created_at >= now() - make_interval(years =>
          case when coalesce(r.is_catalytic, false)
            then coalesce(cs.cat_converter_retention_years, 3)
            else coalesce(cs.general_retention_years, 1) end)
    );
$$;

revoke all on function public.customers_pii_to_purge(uuid) from public;
grant execute on function public.customers_pii_to_purge(uuid) to authenticated;

-- ── Redact the roster ID data (after the DL photo objects are deleted) ───────
create or replace function public.redact_customer_pii(p_customer_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  -- The WHERE re-checks eligibility (reference-aware), so a stale list can't
  -- scrub a customer who has transacted again since it was built.
  update public.customers c set
    drivers_license = '',
    dl_photo_uri = null,
    address = '',
    dob = null,
    notes = ''
  where c.id = any (p_customer_ids)
    -- in-app callers scoped to their company; service-role/cron (no session) all
    and (public.current_company_id() is null
         or c.company_id = public.current_company_id())
    and exists (
      select 1 from public.receipts r
      where r.customer_id = c.id and r.type = 'buy'
    )
    and not exists (
      select 1
      from public.receipts r
      left join public.company_settings cs on cs.company_id = r.company_id
      where r.customer_id = c.id
        and r.type = 'buy'
        and r.created_at >= now() - make_interval(years =>
          case when coalesce(r.is_catalytic, false)
            then coalesce(cs.cat_converter_retention_years, 3)
            else coalesce(cs.general_retention_years, 1) end)
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.redact_customer_pii(uuid[]) from public;
grant execute on function public.redact_customer_pii(uuid[]) to authenticated;
