-- Pin search_path on the two SECURITY DEFINER inventory trigger functions.
-- Every other SECURITY DEFINER function in the schema sets search_path; these
-- two were the only misses (Supabase's function_search_path_mutable linter).
-- References are already fully public-qualified, so search_path = '' is safe.
-- CREATE OR REPLACE preserves the existing trigger bindings.

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
      from public.inventory i where i.metal_id = new.metal_id;

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
        where metal_id = new.metal_id;
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
    where metal_id = new.metal_id;
  return new;
end;
$$;
