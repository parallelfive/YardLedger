-- Per-company timezone so legally-timestamped values use the YARD's local
-- civil day, not the server's UTC day or a device's timezone.
--
-- The receipt number's date segment and daily sequence reset used
-- to_char(now(), 'MMDDYYYY') — now() is UTC, so a receipt created at 6pm in
-- New Mexico (≈1am UTC) was dated the NEXT day, producing a wrong legal date
-- and risking the 2-business-day NMRLD upload deadline. Compute the date in
-- the company's timezone instead.

alter table public.company_settings
  add column if not exists timezone text not null default 'America/Denver';

create or replace function public.generate_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  company_prefix text;
  company_tz text;
  date_str text;
  seq int;
  lock_key bigint;
begin
  select c.prefix, coalesce(cs.timezone, 'America/Denver')
    into company_prefix, company_tz
    from public.companies c
    left join public.company_settings cs on cs.company_id = c.id
    where c.id = new.company_id;

  if company_prefix is null then
    raise exception 'Cannot generate receipt number: company % has no prefix', new.company_id;
  end if;

  -- MMDDYYYY in the company's local timezone (legal business-day boundary).
  date_str := to_char(now() at time zone company_tz, 'MMDDYYYY');

  lock_key := hashtext(company_prefix || '-' || date_str);
  perform pg_advisory_xact_lock(lock_key);

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
