-- Per-piece SELLING: converters/rims ship back out by piece count, mirroring
-- the per-piece buy side. Adds unit + quantity to sales and teaches both sale
-- triggers to branch on unit so an 'each' sale validates + deducts against the
-- inventory piece count and per-piece cost basis instead of weight. Closes the
-- loop opened by 20260726000001/000002 (buy + on-hand count) — a per-piece
-- material can now be bought AND sold, and on-hand no longer only grows.

alter table public.sales
  add column if not exists unit text not null default 'lb'
    check (unit in ('lb', 'each')),
  add column if not exists quantity numeric(12, 2);

-- Belt-and-suspenders parity with inventory_weight_non_negative: the sale
-- integrity trigger already blocks an oversell, but a direct write shouldn't be
-- able to drive the piece count negative either.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inventory_quantity_non_negative'
  ) then
    alter table public.inventory
      add constraint inventory_quantity_non_negative check (quantity >= 0);
  end if;
end $$;

-- ── Sale integrity: block oversell + authoritative cost/revenue/profit ───────
-- For 'each' sales the on-hand count, per-piece cost basis, revenue and profit
-- all run off quantity; sale_price_per_lb / cost_basis_per_lb carry the
-- per-piece figures. The weight path is unchanged.
create or replace function public.enforce_sale_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company uuid;
  v_avail   numeric;
  v_avg     numeric;
  v_qty     numeric;
  v_avg_pc  numeric;
begin
  v_company := coalesce(new.company_id, public.current_company_id());

  if coalesce(new.unit, 'lb') = 'each' then
    -- Lock the inventory row to serialize concurrent piece sales of the metal.
    select quantity, avg_cost_per_piece
      into v_qty, v_avg_pc
      from public.inventory
      where metal_id = new.metal_id and company_id = v_company
      for update;

    if v_qty is null or coalesce(new.quantity, 0) > v_qty then
      raise exception
        'Sale quantity % pcs exceeds on-hand inventory % pcs for this metal.',
        coalesce(new.quantity, 0), coalesce(v_qty, 0);
    end if;

    -- Per-piece cost basis / revenue / profit are server-authoritative.
    new.cost_basis_per_lb := coalesce(v_avg_pc, 0);
    new.total_revenue := round(coalesce(new.quantity, 0) * new.sale_price_per_lb, 2);
    new.profit :=
      new.total_revenue - round(coalesce(new.quantity, 0) * coalesce(v_avg_pc, 0), 2);
    -- A piece sale carries no weight; normalize so weight metrics stay clean.
    new.weight := 0;
    return new;
  end if;

  -- Weight-priced path (unchanged).
  select weight, avg_cost_per_lb
    into v_avail, v_avg
    from public.inventory
    where metal_id = new.metal_id and company_id = v_company
    for update;

  if v_avail is null or new.weight > v_avail then
    raise exception
      'Sale weight % lb exceeds on-hand inventory % lb for this metal.',
      new.weight, coalesce(v_avail, 0);
  end if;

  new.cost_basis_per_lb := v_avg;
  new.total_revenue := round(new.weight * new.sale_price_per_lb, 2);
  new.profit := new.total_revenue - round(new.weight * v_avg, 2);

  return new;
end;
$$;

-- ── Inventory deduction on sale: branch on unit ──────────────────────────────
create or replace function public.update_inventory_on_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.unit, 'lb') = 'each' then
    update public.inventory
      set quantity = quantity - coalesce(new.quantity, 0)
      where metal_id = new.metal_id
        and company_id = new.company_id;
  else
    update public.inventory
      set weight = weight - new.weight
      where metal_id = new.metal_id
        and company_id = new.company_id;
  end if;
  return new;
end;
$$;
