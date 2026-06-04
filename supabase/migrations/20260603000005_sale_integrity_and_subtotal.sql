-- Server-authoritative data integrity for sales and receipt subtotals.
-- The client computed cost basis, profit, revenue, and receipt subtotal and
-- the DB trusted them — a crafted insert could oversell inventory, fake a
-- cost basis/profit, or set any receipt subtotal. Make the server the source
-- of truth for all of it.

-- ---- 1. Sales: block oversell + authoritative cost basis / profit --------
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
begin
  v_company := coalesce(new.company_id, public.current_company_id());

  -- Lock the inventory row to serialize concurrent sales of the same metal.
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

  -- Cost basis comes from the weighted-average inventory cost, not the client.
  new.cost_basis_per_lb := v_avg;
  new.total_revenue := round(new.weight * new.sale_price_per_lb, 2);
  new.profit := new.total_revenue - round(new.weight * v_avg, 2);

  return new;
end;
$$;

drop trigger if exists trg_enforce_sale_integrity on public.sales;
create trigger trg_enforce_sale_integrity
  before insert on public.sales
  for each row execute function public.enforce_sale_integrity();

-- ---- 2. Receipts: subtotal is always sum(line_items.total) ---------------
-- enforce_line_item_pricing already recomputes each line total server-side;
-- this keeps the parent receipt subtotal in lockstep so it can't be faked.
create or replace function public.recompute_receipt_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt uuid;
begin
  v_receipt := coalesce(new.receipt_id, old.receipt_id);
  update public.receipts
    set subtotal = (
      select coalesce(sum(total), 0)
      from public.line_items
      where receipt_id = v_receipt
    )
    where id = v_receipt;
  return null;
end;
$$;

drop trigger if exists trg_recompute_receipt_subtotal on public.line_items;
create trigger trg_recompute_receipt_subtotal
  after insert or update or delete on public.line_items
  for each row execute function public.recompute_receipt_subtotal();
