-- Per-piece (quantity) pricing — for materials bought by the piece rather than
-- by weight: catalytic converters, rims, batteries, etc. Sits alongside the
-- existing per-lb weight pricing.
--
-- Model: a metal declares a `pricing_unit` ('lb' | 'each'). The existing
-- price_per_lb column doubles as the generic "price per unit" (per lb OR per
-- piece), so the whole override/audit machinery keeps working unchanged. Each
-- line_item records the `unit` it was priced in plus a `quantity`, so the record
-- is self-describing even if the metal's unit later changes. Buy-time price
-- override stays gated to admin-elevation / a recent access code exactly as for
-- weight pricing (enforce_line_item_pricing, unchanged in that respect).
--
-- Inventory: per-piece lines are intentionally SKIPPED by the weight-based
-- inventory trigger for now (piece-count inventory is a follow-up) so they can't
-- corrupt the weighted-average cost. Buy / payout / compliance are fully wired.

-- 1. Metals (and the catalog template) get a pricing unit. Default 'lb' keeps
--    every existing metal exactly as-is.
alter table public.metals
  add column if not exists pricing_unit text not null default 'lb'
    check (pricing_unit in ('lb', 'each'));
alter table public.metal_catalog_template_metals
  add column if not exists pricing_unit text not null default 'lb'
    check (pricing_unit in ('lb', 'each'));

-- 2. Line items carry the quantity and the unit this line was priced in.
alter table public.line_items
  add column if not exists quantity numeric(10, 2),
  add column if not exists unit text not null default 'lb'
    check (unit in ('lb', 'each'));

-- 3. Pricing trigger: total is quantity*price for a per-piece line, weight*price
--    otherwise. Override authorization is unchanged (admin elevation or a recent
--    access code) — that IS the "owner/admin can override the set price" rule.
create or replace function public.enforce_line_item_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market      numeric(10,4);
  v_uid         uuid;
  v_recent_code boolean;
begin
  select price_per_lb into v_market
    from public.metals
    where id = new.metal_id
      and company_id = coalesce(new.company_id, public.current_company_id());

  if v_market is null then
    raise exception 'Unknown metal % for this company', new.metal_id;
  end if;

  select id into v_uid from public.users where supabase_id = auth.uid();

  new.original_price_per_lb := v_market;
  new.is_price_override := (new.price_per_lb is distinct from v_market);
  -- Server-authoritative total: pieces × unit-price for 'each', weight × price
  -- for 'lb'. Rounded per line so sum(lines) equals the stored subtotal.
  if new.unit = 'each' then
    new.total := round(coalesce(new.quantity, 0) * new.price_per_lb, 2);
  else
    new.total := round(new.weight * new.price_per_lb, 2);
  end if;

  if new.is_price_override then
    if not public.has_admin_elevation() then
      select exists (
        select 1 from public.access_codes
        where company_id = coalesce(new.company_id, public.current_company_id())
          and used_by = v_uid
          and is_used = true
          and used_at > now() - interval '15 minutes'
      ) into v_recent_code;

      if not coalesce(v_recent_code, false) then
        raise exception
          'Price override requires a valid approval code (none consumed recently).';
      end if;
    end if;

    if new.override_approved_by is null then
      new.override_approved_by := v_uid::text;
    end if;
  end if;

  return new;
end;
$$;

-- 4. Inventory-on-buy trigger: skip per-piece lines so they don't distort the
--    weight-based weighted-average cost. (Piece-count inventory is a follow-up.)
create or replace function public.update_inventory_on_buy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  receipt_type text;
  current_weight numeric;
  current_avg_cost numeric;
  new_total_weight numeric;
  new_avg_cost numeric;
begin
  select r.type into receipt_type
    from public.receipts r where r.id = new.receipt_id;

  if receipt_type = 'buy' and coalesce(new.unit, 'lb') = 'lb' then
    select i.weight, i.avg_cost_per_lb
      into current_weight, current_avg_cost
      from public.inventory i
      where i.metal_id = new.metal_id
        and i.company_id = new.company_id;

    if current_weight is null then
      insert into public.inventory (
        metal_id, metal_name, weight, avg_cost_per_lb, company_id
      )
      values (
        new.metal_id, new.metal_name, new.weight, new.price_per_lb, new.company_id
      );
    else
      new_total_weight := current_weight + new.weight;
      new_avg_cost := ((current_weight * current_avg_cost) + (new.weight * new.price_per_lb)) / new_total_weight;
      update public.inventory
        set weight = new_total_weight,
            avg_cost_per_lb = new_avg_cost,
            metal_name = new.metal_name
        where metal_id = new.metal_id
          and company_id = new.company_id;
    end if;
  end if;

  return new;
end;
$$;

-- 5. Receipt-creation RPC: carry quantity + unit onto each line item. Verbatim
--    from 20260721000002 except the two new columns in the line_items insert.
create or replace function public.create_receipt_with_items(
  p_receipt jsonb,
  p_line_items jsonb
)
returns public.receipts
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.receipts;
begin
  if not exists (
    select 1 from public.users
    where id = (p_receipt->>'worker_id')::uuid
      and company_id = public.current_company_id()
  ) then
    raise exception 'worker_id must be a member of the current company';
  end if;

  insert into public.receipts (
    receipt_number, customer_name, customer_phone, customer_id, type, subtotal,
    signature_uri, worker_id, notes, vehicle_plate, vehicle_description,
    vehicle_year, vehicle_make, vehicle_model, vehicle_color, seller_affirmed,
    seller_no_theft_affirmed,
    seller_name, seller_dl_number, seller_state_of_issue, seller_dob,
    seller_address, seller_city, seller_state, seller_zip, seller_id_photo_uri,
    cat_converter_numbers, transport_vin, cat_converter_photo_uri,
    cat_title_photo_uri, payment_method, is_catalytic, seller_photo_uri,
    material_photo_uri
  )
  values (
    '',
    p_receipt->>'customer_name',
    coalesce(p_receipt->>'customer_phone', ''),
    nullif(p_receipt->>'customer_id', '')::uuid,
    p_receipt->>'type',
    coalesce((p_receipt->>'subtotal')::numeric, 0),
    p_receipt->>'signature_uri',
    (p_receipt->>'worker_id')::uuid,
    p_receipt->>'notes',
    coalesce(p_receipt->>'vehicle_plate', ''),
    coalesce(p_receipt->>'vehicle_description', ''),
    coalesce(p_receipt->>'vehicle_year', ''),
    coalesce(p_receipt->>'vehicle_make', ''),
    coalesce(p_receipt->>'vehicle_model', ''),
    coalesce(p_receipt->>'vehicle_color', ''),
    coalesce((p_receipt->>'seller_affirmed')::boolean, false),
    coalesce((p_receipt->>'seller_no_theft_affirmed')::boolean, false),
    coalesce(p_receipt->>'seller_name', ''),
    coalesce(p_receipt->>'seller_dl_number', ''),
    coalesce(p_receipt->>'seller_state_of_issue', ''),
    coalesce(p_receipt->>'seller_dob', ''),
    coalesce(p_receipt->>'seller_address', ''),
    coalesce(p_receipt->>'seller_city', ''),
    coalesce(p_receipt->>'seller_state', ''),
    coalesce(p_receipt->>'seller_zip', ''),
    p_receipt->>'seller_id_photo_uri',
    coalesce(p_receipt->>'cat_converter_numbers', ''),
    coalesce(p_receipt->>'transport_vin', ''),
    p_receipt->>'cat_converter_photo_uri',
    p_receipt->>'cat_title_photo_uri',
    coalesce(p_receipt->>'payment_method', 'cash'),
    coalesce((p_receipt->>'is_catalytic')::boolean, false),
    p_receipt->>'seller_photo_uri',
    p_receipt->>'material_photo_uri'
  )
  returning * into v;

  insert into public.line_items (
    receipt_id, metal_id, metal_name, weight, gross_weight, tare_weight,
    price_per_lb, original_price_per_lb, is_price_override, override_approved_by,
    total, is_regulated, is_restricted, quantity, unit
  )
  select
    v.id,
    (li->>'metal_id')::uuid,
    li->>'metal_name',
    (li->>'weight')::numeric,
    nullif(li->>'gross_weight', '')::numeric,
    nullif(li->>'tare_weight', '')::numeric,
    (li->>'price_per_lb')::numeric,
    (li->>'original_price_per_lb')::numeric,
    coalesce((li->>'is_price_override')::boolean, false),
    nullif(li->>'override_approved_by', '')::uuid,
    (li->>'total')::numeric,
    coalesce((li->>'is_regulated')::boolean, false),
    coalesce((li->>'is_restricted')::boolean, false),
    nullif(li->>'quantity', '')::numeric,
    coalesce(nullif(li->>'unit', ''), 'lb')
  from jsonb_array_elements(p_line_items) as li;

  return v;
end;
$$;

-- 6. Carry pricing_unit into metals seeded for new companies from the template.
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
    (company_id, name, category_id, price_per_lb, is_regulated, is_restricted, is_catalytic, is_report_exempt, pricing_unit, is_active)
  select
    p_company_id, t.name, c.id, t.default_price,
    t.is_regulated, t.is_restricted, t.is_catalytic, t.is_report_exempt, t.pricing_unit, true
  from public.metal_catalog_template_metals t
  left join public.metal_categories c
    on c.company_id = p_company_id and c.name = t.category_name
  on conflict (company_id, name) do nothing;
end;
$$;
