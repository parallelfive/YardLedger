-- Defense-in-depth: scope the SECURITY DEFINER inventory triggers by company_id.
--
-- These triggers bypass RLS (definer) and previously located/mutated the
-- inventory row by `metal_id` alone. That is safe TODAY only because
-- inventory.metal_id is globally unique and each metal belongs to one company —
-- an incidental invariant. If that unique constraint were ever relaxed to the
-- natural multi-tenant key (company_id, metal_id), the metal_id-only lookups
-- could read/merge another tenant's row. Pin every lookup/update to the row's
-- company_id so the per-company invariant is explicit and not load-bearing on
-- the unique constraint. CREATE OR REPLACE preserves the existing triggers.

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

  if receipt_type = 'buy' then
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

create or replace function public.update_inventory_on_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.inventory
    set weight = weight - new.weight
    where metal_id = new.metal_id
      and company_id = new.company_id;
  return new;
end;
$$;
