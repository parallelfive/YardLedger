-- Multi-tenancy phase 5: per-company receipt numbering with daily reset.
--
-- Replaces the single-tenant generate_receipt_number() (which produced
-- YL-YYYYMMDD-NNNN globally) with a per-company, per-day sequence.
-- New format: {PREFIX}-{MMDDYYYY}-{N}
--   - PREFIX  = company prefix like GR-2026
--   - MMDDYYYY = date the receipt was created
--   - N       = 1, 2, 3, ... resets each day per company
--
-- Example: GR-2026-04242026-1, GR-2026-04242026-2, ...
--
-- pg_advisory_xact_lock on (prefix, date) serializes concurrent inserts
-- so two workers can't both grab the same N. The existing
-- unique(receipt_number) constraint is a belt-and-suspenders backstop.
--
-- Legacy YL-YYYYMMDD-NNNN rows are ignored by the max() lookup because
-- they don't match the LIKE pattern for the current company + day.
--
-- The receipts_auto_number trigger (from 20260310000003) is unchanged;
-- it still fires BEFORE INSERT only when the caller hasn't supplied
-- receipt_number. We're only swapping the function body.

create or replace function public.generate_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  company_prefix text;
  date_str text;
  seq int;
  lock_key bigint;
begin
  select prefix into company_prefix
    from public.companies
    where id = new.company_id;

  if company_prefix is null then
    raise exception 'Cannot generate receipt number: company % has no prefix', new.company_id;
  end if;

  -- MMDDYYYY per product decision. Non-ISO, doesn't text-sort
  -- chronologically, but matches the agreed display format.
  date_str := to_char(now(), 'MMDDYYYY');

  -- One lock per (company, day) so parallel inserts serialize only
  -- where they'd actually collide.
  lock_key := hashtext(company_prefix || '-' || date_str);
  perform pg_advisory_xact_lock(lock_key);

  -- Take max over the trailing digit run so deletions don't cause
  -- sequence reuse (count(*) would have that bug).
  select coalesce(max(
    substring(receipt_number from '([0-9]+)$')::int
  ), 0) + 1 into seq
  from public.receipts
  where company_id = new.company_id
    and receipt_number like company_prefix || '-' || date_str || '-%';

  new.receipt_number := company_prefix || '-' || date_str || '-' || seq::text;
  return new;
end;
$$;
