-- Teardown for demo_seed.sql — removes ONLY the tagged demo rows from the
-- GR-2026 "Gorilla Recycling (local)" company, then clears that company's
-- inventory (which the seed buys had accumulated via triggers).
--
-- Safe: matches on the [SEED] / (demo) tags the seed wrote, so it won't touch
-- app-entered data — EXCEPT the final inventory clear, which resets the demo
-- company's on-hand to empty (the seed was the only thing that filled it).
--
-- Run:  cat supabase/seed/demo_teardown.sql | ssh coolify-macbook \
--         "docker exec -i <db-container> psql -U postgres -d postgres"

do $$
declare
  v_company uuid := (select id from public.companies where prefix = 'GR-2026');
  n_receipts int; n_sales int; n_customers int; n_inv int;
begin
  if v_company is null then
    raise notice 'GR-2026 company not found — nothing to tear down.';
    return;
  end if;

  delete from public.receipts
    where company_id = v_company and notes like '[SEED]%';  -- line_items cascade
  get diagnostics n_receipts = row_count;

  delete from public.sales
    where company_id = v_company and buyer_name like '%(demo)';
  get diagnostics n_sales = row_count;

  delete from public.customers
    where company_id = v_company and notes = '[SEED]';
  get diagnostics n_customers = row_count;

  -- Inventory has no delete-side trigger, so removing the buys above doesn't
  -- reverse it. Clear the demo company's inventory to reset on-hand to zero.
  delete from public.inventory where company_id = v_company;
  get diagnostics n_inv = row_count;

  raise notice 'Teardown: % receipts, % sales, % customers, % inventory rows removed.',
    n_receipts, n_sales, n_customers, n_inv;
end $$;
