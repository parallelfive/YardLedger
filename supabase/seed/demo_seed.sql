-- Demo seed for the GR-2026 "Gorilla Recycling (local)" company.
--
-- Populates ~3 weeks of realistic buys + sells so dashboards, inventory,
-- compliance, and reports look alive for demos/screenshots — and covers the
-- tricky cases (per-piece converters/rims, restricted/catalytic holds,
-- gross−tare weighed lines, check-only payment). Inventory, receipt numbers,
-- holds and subtotals are all produced by the real triggers (nothing is
-- hand-faked), so the data behaves exactly like app-entered data.
--
-- SAFE + IDEMPOTENT: everything is tagged and scoped to the GR-2026 company.
-- Re-running first clears prior seed rows (see the DELETE block), so it never
-- double-counts. Teardown lives in demo_teardown.sql.
--
-- Run:  cat supabase/seed/demo_seed.sql | ssh coolify-macbook \
--         "docker exec -i <db-container> psql -U postgres -d postgres"

do $$
declare
  v_company uuid := (select id from public.companies where prefix = 'GR-2026');
  v_prefix  text := 'GR-2026';
  v_workers uuid[] := array(
    select id from public.users where company_id = v_company order by id
  );
  v_worker  uuid;
  v_rid     uuid;
  v_day     date;
  v_seq     int;
  v_created timestamptz;
  v_cust    text;
  v_custs   text[] := array[
    'Ruben Salazar','Tanya Whitfield','Marcus Delgado','Priya Nair',
    'Eddie Vargas','Dawn Kowalski','Hector Ramos','Lena Petrov',
    'Cole Barrett','Yusuf Abdi'
  ];
  rec       record;
  v_wt      numeric;
  v_price   numeric;
  v_lines   int;
  d int; k int; n int; ctr int := 0;
begin
  if v_company is null then
    raise exception 'GR-2026 company not found — nothing to seed.';
  end if;
  if array_length(v_workers, 1) is null then
    raise exception 'No users in the GR-2026 company to attribute buys to.';
  end if;

  -- ── Idempotent cleanup of any prior seed run (tagged rows only) ───────────
  delete from public.receipts
    where company_id = v_company and notes like '[SEED]%'; -- line_items cascade
  delete from public.sales
    where company_id = v_company and buyer_name like '%(demo)';
  delete from public.customers
    where company_id = v_company and notes = '[SEED]';
  -- Rebuild inventory from scratch for the demo company (seed buys refill it).
  delete from public.inventory where company_id = v_company;

  -- ── Give the (unnamed) demo users real names for worker attribution ───────
  update public.users set name = 'Marcus Rivera'
    where id = v_workers[1] and coalesce(name, '') = '';
  if array_length(v_workers, 1) >= 2 then
    update public.users set name = 'Dylan Cortez'
      where id = v_workers[2] and coalesce(name, '') = '';
  end if;
  if array_length(v_workers, 1) >= 3 then
    update public.users set name = 'Sam Okafor'
      where id = v_workers[3] and coalesce(name, '') = '';
  end if;

  -- ── Customers (sellers on file) ───────────────────────────────────────────
  for n in 1 .. array_length(v_custs, 1) loop
    insert into public.customers
      (name, phone, drivers_license, address, notes, company_id)
    values (
      v_custs[n],
      '505-555-' || lpad((100 + n)::text, 4, '0'),
      'NM' || lpad((3900000 + n * 1371)::text, 8, '0'),
      (array['142 Alameda Blvd','88 Coors Rd NW','2201 Central Ave',
             '515 Rio Grande','77 Menaul Blvd','3390 Isleta Blvd',
             '9 Paseo del Norte','640 Bridge St','1204 4th St NW',
             '55 Zuni Rd SE'])[n] || ', Albuquerque, NM 871' || lpad(n::text,2,'0'),
      '[SEED]',
      v_company
    );
  end loop;

  -- ── Weight-priced metals used by the daily loop (id/name/price/wt range) ──
  create temp table _sm (idx serial, mid uuid, mname text, price numeric,
                         wmin numeric, wmax numeric) on commit drop;
  insert into _sm (mid, mname, price, wmin, wmax)
  select id, name, price_per_lb, wmin, wmax from (values
    ('#1 Copper',            35,  180),
    ('#2 Copper',            40,  160),
    ('Bare Bright',          20,  90),
    ('Insulated Copper Wire',60,  240),
    ('Yellow Brass',         30,  120),
    ('Mixed Brass',          25,  140),
    ('Aluminum Cans (UBC)',  120, 500),
    ('Cast Aluminum',        80,  300),
    ('Aluminum Extrusions',  60,  260),
    ('Prepared Steel',       800, 4200),
    ('HMS #1',               600, 3800),
    ('Unprepared Steel',     900, 5000),
    ('Lead Acid Batteries',  90,  420),
    ('Electric Motors',      70,  280),
    ('304 Stainless Steel',  40,  220)
  ) as t(nm, wmin, wmax)
  join public.metals m on m.name = t.nm and m.company_id = v_company;

  -- ── ~3 weeks of ordinary buys, 1–2 per day ───────────────────────────────
  for d in 0 .. 20 loop
    v_day := (now() - make_interval(days => d))::date;
    v_seq := 0;
    for k in 1 .. (1 + (d % 2)) loop      -- 1 or 2 receipts that day
      ctr := ctr + 1;
      v_seq := v_seq + 1;
      v_worker := v_workers[1 + ((d + k) % array_length(v_workers, 1))];
      v_cust   := v_custs[1 + (ctr % array_length(v_custs, 1))];
      v_created := v_day + time '08:30' + make_interval(mins => (ctr * 47) % 480);

      insert into public.receipts
        (receipt_number, customer_name, seller_name, type, worker_id,
         company_id, payment_method, seller_affirmed, notes, created_at)
      values (
        v_prefix || '-' || to_char(v_day, 'MMDDYYYY') || '-' || v_seq,
        v_cust, v_cust, 'buy', v_worker, v_company,
        (case when ctr % 7 = 0 then 'check' else 'cash' end),
        true, '[SEED] daily buy', v_created
      ) returning id into v_rid;

      v_lines := 1 + (ctr % 3);           -- 1–3 line items
      for n in 1 .. v_lines loop
        select * into rec from _sm
          where idx = 1 + ((ctr * 3 + n) % (select count(*) from _sm));
        v_wt := round(rec.wmin
                 + (mod((ctr * 2654435761 + n * 40503)::bigint, 1000) / 1000.0)
                   * (rec.wmax - rec.wmin), 1);
        insert into public.line_items
          (receipt_id, metal_id, metal_name, weight, price_per_lb,
           original_price_per_lb, total, is_regulated, is_restricted,
           company_id, unit)
        select v_rid, rec.mid, rec.mname, v_wt, rec.price, rec.price, 0,
               m.is_regulated, m.is_restricted, v_company, 'lb'
          from public.metals m where m.id = rec.mid;
      end loop;
    end loop;
  end loop;

  -- ── Edge-case buys ────────────────────────────────────────────────────────
  -- (a) Catalytic converters — per-piece, restricted/catalytic, CHECK only,
  --     with a statutory hold set from the (backdated) buy date.
  v_day := (now() - make_interval(days => 4))::date;
  v_created := v_day + time '11:15';
  insert into public.receipts
    (receipt_number, customer_name, seller_name, seller_dl_number,
     type, worker_id, company_id, payment_method, is_catalytic,
     seller_affirmed, transport_vin, cat_converter_numbers,
     hold_until, notes, created_at)
  values (v_prefix || '-' || to_char(v_day,'MMDDYYYY') || '-91',
     'Eddie Vargas','Eddie Vargas','NM03998812','buy', v_workers[1], v_company,
     'check', true, true, '1FTFW1E50NFA12345', 'CAT-7781, CAT-7782, CAT-7783',
     v_created + make_interval(days => 2), '[SEED] catalytic', v_created)
  returning id into v_rid;
  insert into public.line_items
    (receipt_id, metal_id, metal_name, weight, price_per_lb,
     original_price_per_lb, total, quantity, unit, is_regulated,
     is_restricted, company_id)
  select v_rid, id, name, 0, price_per_lb, price_per_lb, 0, 4, 'each',
         true, true, v_company
    from public.metals where company_id = v_company and name = 'Catalytic Converter';

  -- (b) Aluminum wheels / rims — per-piece, regulated.
  v_day := (now() - make_interval(days => 8))::date;
  v_created := v_day + time '14:40';
  insert into public.receipts
    (receipt_number, customer_name, seller_name, type, worker_id, company_id,
     payment_method, seller_affirmed, notes, created_at)
  values (v_prefix || '-' || to_char(v_day,'MMDDYYYY') || '-92',
     'Cole Barrett','Cole Barrett','buy', v_workers[2], v_company,
     'cash', true, '[SEED] rims', v_created)
  returning id into v_rid;
  insert into public.line_items
    (receipt_id, metal_id, metal_name, weight, price_per_lb,
     original_price_per_lb, total, quantity, unit, is_regulated, company_id)
  select v_rid, id, name, 0, price_per_lb, price_per_lb, 0, 6, 'each',
         true, v_company
    from public.metals where company_id = v_company and name = 'Aluminum Wheels / Rims';

  -- (c) Burnt copper wire — restricted material (adds proof-of-ownership tier).
  v_day := (now() - make_interval(days => 11))::date;
  v_created := v_day + time '10:05';
  insert into public.receipts
    (receipt_number, customer_name, seller_name, seller_dl_number, type,
     worker_id, company_id, payment_method, seller_affirmed, hold_until,
     notes, created_at)
  values (v_prefix || '-' || to_char(v_day,'MMDDYYYY') || '-93',
     'Hector Ramos','Hector Ramos','NM03991284','buy', v_workers[3], v_company,
     'cash', true, v_created + make_interval(hours => 24),
     '[SEED] restricted', v_created)
  returning id into v_rid;
  insert into public.line_items
    (receipt_id, metal_id, metal_name, weight, price_per_lb,
     original_price_per_lb, total, is_regulated, is_restricted, company_id)
  select v_rid, id, name, 62.5, price_per_lb, price_per_lb, 0, true, true, v_company
    from public.metals where company_id = v_company and name = 'Burnt Copper Wire';

  -- (d) Gross − tare weighed copper (truck on the scale).
  v_day := (now() - make_interval(days => 2))::date;
  v_created := v_day + time '15:20';
  insert into public.receipts
    (receipt_number, customer_name, seller_name, type, worker_id, company_id,
     payment_method, seller_affirmed, notes, created_at)
  values (v_prefix || '-' || to_char(v_day,'MMDDYYYY') || '-94',
     'Priya Nair','Priya Nair','buy', v_workers[1], v_company,
     'cash', true, '[SEED] gross-tare', v_created)
  returning id into v_rid;
  insert into public.line_items
    (receipt_id, metal_id, metal_name, weight, gross_weight, tare_weight,
     price_per_lb, original_price_per_lb, total, is_regulated, company_id, unit)
  select v_rid, id, name, 840.0, 6120.0, 5280.0, price_per_lb, price_per_lb, 0,
         true, v_company, 'lb'
    from public.metals where company_id = v_company and name = '#2 Copper';

  -- ── Outbound sales (ship to processors) ──────────────────────────────────
  -- Each sells a FRACTION of whatever is actually on hand (buy volumes are
  -- randomized), so a sale can never oversell. weight/revenue/profit/cost are
  -- recomputed server-side by enforce_sale_integrity. buyer_name carries a
  -- "(demo)" tag so teardown can find seeded sales.
  for rec in
    select * from (values
      ('#1 Copper',           0.45, 3.65, v_workers[1], 3,  'Western Copper Mills (demo)', 'lb'),
      ('Prepared Steel',      0.55, 0.11, v_workers[2], 6,  'Rio Grande Steel (demo)',     'lb'),
      ('Aluminum Cans (UBC)', 0.50, 0.52, v_workers[1], 9,  'Southwest Aluminum (demo)',   'lb'),
      ('Yellow Brass',        0.40, 1.90, v_workers[3], 12, 'Western Copper Mills (demo)', 'lb'),
      ('Catalytic Converter', 0.60, 165,  v_workers[1], 5,  'AutoCat Recovery (demo)',     'each')
    ) as s(nm, frac, price, worker, dago, buyer, unit)
  loop
    select id into v_rid from public.metals
      where name = rec.nm and company_id = v_company;      -- reuse v_rid as metal id
    if rec.unit = 'each' then
      select floor(coalesce(quantity, 0) * rec.frac) into v_wt
        from public.inventory where metal_id = v_rid and company_id = v_company;
      if coalesce(v_wt, 0) >= 1 then
        insert into public.sales (metal_id, metal_name, weight, sale_price_per_lb,
          cost_basis_per_lb, total_revenue, profit, worker_id, company_id, unit,
          quantity, buyer_name, created_at)
        values (v_rid, rec.nm, 0, rec.price, 0, 0, 0, rec.worker, v_company,
          'each', v_wt, rec.buyer, now() - make_interval(days => rec.dago));
      end if;
    else
      select round(coalesce(weight, 0) * rec.frac, 1) into v_wt
        from public.inventory where metal_id = v_rid and company_id = v_company;
      if coalesce(v_wt, 0) > 0 then
        insert into public.sales (metal_id, metal_name, weight, sale_price_per_lb,
          cost_basis_per_lb, total_revenue, profit, worker_id, company_id, unit,
          quantity, buyer_name, created_at)
        values (v_rid, rec.nm, v_wt, rec.price, 0, 0, 0, rec.worker, v_company,
          'lb', null, rec.buyer, now() - make_interval(days => rec.dago));
      end if;
    end if;
  end loop;

  raise notice 'Seed complete: % daily buys + 4 edge cases + sales for %',
    ctr, v_prefix;
end $$;
