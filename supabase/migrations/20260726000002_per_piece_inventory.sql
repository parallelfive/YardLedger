-- Piece-count inventory for per-piece materials (converters, rims). The base
-- inventory row is weight-based (weight + avg_cost_per_lb); this adds a parallel
-- quantity + avg_cost_per_piece pair so a per-piece buy accumulates an on-hand
-- COUNT and a weighted-average per-piece cost, without disturbing the weight math.
-- A metal is one unit or the other, so a given inventory row uses one pair.
--
-- Scope: the BUY side (accumulate on hand) + display. Selling per-piece back out
-- (deducting the count) rides on the existing weight-based sale flow and is a
-- follow-up — for converters, on-hand today reflects purchases.

alter table public.inventory
  add column if not exists quantity numeric(12, 2) not null default 0,
  add column if not exists avg_cost_per_piece numeric(12, 4) not null default 0;

-- Extend the buy trigger: per-piece ('each') lines maintain quantity +
-- avg_cost_per_piece (weighted by pieces); weight lines keep the existing
-- weight + avg_cost_per_lb path unchanged.
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
  current_qty numeric;
  current_avg_piece numeric;
  new_total_qty numeric;
  new_avg_piece numeric;
begin
  select r.type into receipt_type
    from public.receipts r where r.id = new.receipt_id;

  if receipt_type <> 'buy' then
    return new;
  end if;

  if coalesce(new.unit, 'lb') = 'each' then
    -- Per-piece: accumulate a count + weighted-average per-piece cost.
    select i.quantity, i.avg_cost_per_piece
      into current_qty, current_avg_piece
      from public.inventory i
      where i.metal_id = new.metal_id
        and i.company_id = new.company_id;

    if current_qty is null then
      insert into public.inventory (
        metal_id, metal_name, weight, avg_cost_per_lb,
        quantity, avg_cost_per_piece, company_id
      )
      values (
        new.metal_id, new.metal_name, 0, 0,
        coalesce(new.quantity, 0), new.price_per_lb, new.company_id
      );
    else
      new_total_qty := current_qty + coalesce(new.quantity, 0);
      new_avg_piece := case
        when new_total_qty > 0 then
          ((current_qty * current_avg_piece)
            + (coalesce(new.quantity, 0) * new.price_per_lb)) / new_total_qty
        else 0
      end;
      update public.inventory
        set quantity = new_total_qty,
            avg_cost_per_piece = new_avg_piece,
            metal_name = new.metal_name
        where metal_id = new.metal_id
          and company_id = new.company_id;
    end if;
  else
    -- Weight-priced: existing weighted-average-by-weight path.
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
