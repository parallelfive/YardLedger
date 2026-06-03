-- New Mexico (Sale of Recycled Metals Act, NMSA 57-30 + SB133/SB141)
-- operational compliance that the app captured fields for but never enforced:
--
--   * Catalytic converters: cash payment prohibited (check only), and the
--     dealer must hold the converter >= 60 days before resale/disposal.
--   * General regulated material: 24-hour disposal/processing hold.
--   * Retention: 1 yr general records, 3 yr catalytic-converter records.
--
-- All thresholds live on company_settings so other states can override them
-- (the user noted NM today, other states later). Defaults are the NM values.

-- ---- Configurable, per-company compliance rules ------------------------
alter table public.company_settings
  add column if not exists state text not null default 'NM',
  add column if not exists general_hold_hours int not null default 24,
  add column if not exists cat_converter_hold_days int not null default 60,
  add column if not exists cat_converter_check_only boolean not null default true,
  add column if not exists general_retention_years int not null default 1,
  add column if not exists cat_converter_retention_years int not null default 3;

-- ---- Receipt-level payment + hold tracking -----------------------------
alter table public.receipts
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'check', 'other')),
  add column if not exists is_catalytic boolean not null default false,
  add column if not exists hold_until timestamptz,
  add column if not exists disposed_at timestamptz;

comment on column public.receipts.hold_until is
  'Earliest time material may be processed/removed/resold (NM 57-30-11; 60 days for catalytic converters per 57-30-2.4). Set automatically on insert.';

-- ---- Enforce payment rule + stamp the hold window on insert ------------
create or replace function public.set_receipt_compliance()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_check_only boolean;
  v_cat_days   int;
  v_gen_hours  int;
  v_is_cat     boolean;
begin
  -- Only purchases (buys) are subject to hold/payment rules.
  if new.type <> 'buy' then
    return new;
  end if;

  -- A receipt is a catalytic-converter transaction if it carries converter
  -- serial numbers or is explicitly flagged.
  v_is_cat := coalesce(new.is_catalytic, false)
              or coalesce(new.cat_converter_numbers, '') <> '';
  new.is_catalytic := v_is_cat;

  select cat_converter_check_only, cat_converter_hold_days, general_hold_hours
    into v_check_only, v_cat_days, v_gen_hours
    from public.company_settings
    where company_id = coalesce(new.company_id, public.current_company_id())
    limit 1;

  -- Fall back to NM statutory defaults if a company has no settings row yet.
  v_check_only := coalesce(v_check_only, true);
  v_cat_days   := coalesce(v_cat_days, 60);
  v_gen_hours  := coalesce(v_gen_hours, 24);

  if v_is_cat and v_check_only
     and lower(coalesce(new.payment_method, 'cash')) = 'cash' then
    raise exception
      'Cash payment is prohibited for catalytic converter purchases (NM 57-30-2.4); pay by check.';
  end if;

  if new.hold_until is null then
    if v_is_cat then
      new.hold_until := now() + make_interval(days => v_cat_days);
    else
      new.hold_until := now() + make_interval(hours => v_gen_hours);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_receipt_compliance on public.receipts;
create trigger trg_receipt_compliance
  before insert on public.receipts
  for each row execute function public.set_receipt_compliance();

-- ---- Block disposal/resale before the hold expires ---------------------
-- Guards against marking a receipt's material disposed while still on hold.
create or replace function public.enforce_receipt_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.disposed_at is not null
     and old.disposed_at is null
     and new.hold_until is not null
     and new.disposed_at < new.hold_until then
    raise exception
      'Material is on a mandatory hold until % and cannot be disposed/resold yet (NM 57-30-11 / 57-30-2.4).',
      new.hold_until;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_receipt_hold on public.receipts;
create trigger trg_enforce_receipt_hold
  before update on public.receipts
  for each row execute function public.enforce_receipt_hold();
