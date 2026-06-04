-- Enforce NM record retention (NMSA 57-30-6 general; 57-30-2.4 catalytic).
-- Receipts were hard-deletable by admins at any time, which can destroy a
-- record the dealer is legally required to keep (1 yr general / 3 yr
-- catalytic). Block deletion until the retention window has elapsed; the
-- window length is read from per-company settings (state-configurable).

create or replace function public.enforce_receipt_retention()
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
  select general_retention_years, cat_converter_retention_years
    into v_years, v_cat_years
    from public.company_settings
    where company_id = old.company_id
    limit 1;

  v_years     := coalesce(v_years, 1);
  v_cat_years := coalesce(v_cat_years, 3);
  v_required  := case
                   when coalesce(old.is_catalytic, false) then v_cat_years
                   else v_years
                 end;

  if old.created_at > now() - make_interval(years => v_required) then
    raise exception
      'Receipt is within its %-year retention window (NM 57-30) and cannot be deleted until %.',
      v_required,
      (old.created_at + make_interval(years => v_required))::date;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_receipt_retention on public.receipts;
create trigger trg_receipt_retention
  before delete on public.receipts
  for each row execute function public.enforce_receipt_retention();
