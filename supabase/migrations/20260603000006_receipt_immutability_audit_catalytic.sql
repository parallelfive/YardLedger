-- Round 5: receipt immutability + disposal audit trail, and a durable
-- catalytic flag on metals (replacing the fragile name-substring heuristic).

-- ===========================================================================
-- 1. Receipt immutability — freeze statutory/identity columns after creation.
-- Allowed to change post-insert: subtotal (system-recomputed from line items),
-- disposed_at (disposal write-path), hold_until (governed by
-- enforce_receipt_hold), notes, updated_at. Everything else is frozen so a
-- compliance record can't be silently altered.
-- ===========================================================================
create or replace function public.enforce_receipt_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

drop trigger if exists trg_receipt_immutability on public.receipts;
create trigger trg_receipt_immutability
  before update on public.receipts
  for each row execute function public.enforce_receipt_immutability();

-- ===========================================================================
-- 2. Append-only disposal audit trail.
-- ===========================================================================
create table if not exists public.receipt_audit (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  company_id uuid,
  action text not null,
  actor_user_id uuid references public.users(id),
  detail text,
  created_at timestamptz not null default now()
);

alter table public.receipt_audit enable row level security;

-- Read-only to a company's members; writes happen only via the SECURITY
-- DEFINER trigger below (no INSERT/UPDATE/DELETE policy for clients).
create policy "Members read their company audit log"
  on public.receipt_audit for select
  to authenticated
  using (company_id = public.current_company_id());

create or replace function public.log_receipt_disposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  if new.disposed_at is not null and old.disposed_at is null then
    select id into v_uid from public.users where supabase_id = auth.uid();
    insert into public.receipt_audit (receipt_id, company_id, action, actor_user_id, detail)
    values (new.id, new.company_id, 'disposed', v_uid, 'Material marked disposed');
  end if;
  return null;
end;
$$;

drop trigger if exists trg_log_receipt_disposal on public.receipts;
create trigger trg_log_receipt_disposal
  after update on public.receipts
  for each row execute function public.log_receipt_disposal();

-- ===========================================================================
-- 3. Durable catalytic flag on metals (replaces name-substring detection).
-- Backfill once from the existing name heuristic, then it's authoritative.
-- ===========================================================================
alter table public.metals
  add column if not exists is_catalytic boolean not null default false;
alter table public.metal_catalog_template_metals
  add column if not exists is_catalytic boolean not null default false;

update public.metals
  set is_catalytic = true where name ilike '%catalytic%';
update public.metal_catalog_template_metals
  set is_catalytic = true where name ilike '%catalytic%';

-- Recreate the catalog seed to carry the catalytic flag into new companies.
create or replace function public.seed_company_metals(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.metal_categories (company_id, name, display_order, image_url, is_active)
  select p_company_id, t.name, t.display_order, t.image_url, true
  from public.metal_catalog_template_categories t
  on conflict (company_id, name) do nothing;

  insert into public.metals
    (company_id, name, category_id, price_per_lb, is_regulated, is_restricted, is_catalytic, is_active)
  select
    p_company_id, t.name, c.id, t.default_price,
    t.is_regulated, t.is_restricted, t.is_catalytic, true
  from public.metal_catalog_template_metals t
  left join public.metal_categories c
    on c.company_id = p_company_id and c.name = t.category_name
  on conflict (company_id, name) do nothing;
end;
$$;
