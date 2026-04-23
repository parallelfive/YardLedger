-- Multi-tenancy phase 4: rewrite every RLS policy to scope by company.
--
-- Every business-data policy becomes "X in their company". Owner-only
-- policies are added where a scope is larger than admin (managing other
-- owners, editing company profile).
--
-- Also fixes the update_inventory_on_buy trigger to carry company_id
-- onto new inventory rows (phase 2 made inventory.company_id NOT NULL,
-- so the original trigger INSERT would now fail).
--
-- Deferred to phase 8: policies for the invite_codes and companies
-- tables. Those are only exercised once the invite-code flow lands.

-- =========================================================================
-- users
-- =========================================================================
drop policy if exists "Users can read own profile" on public.users;
drop policy if exists "Admins can read all users" on public.users;
drop policy if exists "Admins can update users" on public.users;
drop policy if exists "Users can update own name" on public.users;

create policy "Users can read own profile"
  on public.users for select
  to authenticated
  using (supabase_id = auth.uid());

create policy "Admins can read users in their company"
  on public.users for select
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Users can update own name"
  on public.users for update
  to authenticated
  using (supabase_id = auth.uid())
  with check (supabase_id = auth.uid());

-- Admins can manage admins and workers (not owners) in their company.
create policy "Admins can update non-owners in their company"
  on public.users for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
    and role in ('admin', 'worker')
  )
  with check (
    company_id = public.current_company_id()
    and role in ('admin', 'worker')
  );

-- Owners can manage anyone (including other owners) in their company.
create policy "Owners can update anyone in their company"
  on public.users for update
  to authenticated
  using (
    public.is_owner()
    and company_id = public.current_company_id()
  )
  with check (company_id = public.current_company_id());

-- =========================================================================
-- metals
-- =========================================================================
drop policy if exists "All authenticated users can read metals" on public.metals;
drop policy if exists "Admins can insert metals" on public.metals;
drop policy if exists "Admins can update metals" on public.metals;

create policy "Users can read metals in their company"
  on public.metals for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Admins can insert metals in their company"
  on public.metals for insert
  to authenticated
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Admins can update metals in their company"
  on public.metals for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (company_id = public.current_company_id());

-- =========================================================================
-- metal_categories
-- =========================================================================
drop policy if exists "All authenticated users can read categories" on public.metal_categories;
drop policy if exists "Admins can insert categories" on public.metal_categories;
drop policy if exists "Admins can update categories" on public.metal_categories;

create policy "Users can read metal categories in their company"
  on public.metal_categories for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Admins can insert metal categories in their company"
  on public.metal_categories for insert
  to authenticated
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Admins can update metal categories in their company"
  on public.metal_categories for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (company_id = public.current_company_id());

-- =========================================================================
-- receipts
-- =========================================================================
drop policy if exists "Authenticated users can read receipts" on public.receipts;
drop policy if exists "Workers can create their own receipts" on public.receipts;
drop policy if exists "Admins can update receipts" on public.receipts;
drop policy if exists "Admins can delete receipts" on public.receipts;

create policy "Users can read receipts in their company"
  on public.receipts for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Workers can create their own receipts"
  on public.receipts for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and worker_id in (select id from public.users where supabase_id = auth.uid())
  );

create policy "Admins can update receipts in their company"
  on public.receipts for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Admins can delete receipts in their company"
  on public.receipts for delete
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- line_items
-- =========================================================================
drop policy if exists "Authenticated users can read line items" on public.line_items;
drop policy if exists "Users can create line items on their own receipts" on public.line_items;
drop policy if exists "Admins can update line items" on public.line_items;
drop policy if exists "Admins can delete line items" on public.line_items;

create policy "Users can read line items in their company"
  on public.line_items for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Users can create line items on their own receipts"
  on public.line_items for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.receipts r
      where r.id = receipt_id
        and r.company_id = public.current_company_id()
        and (
          r.worker_id in (select id from public.users where supabase_id = auth.uid())
          or public.is_admin()
        )
    )
  );

create policy "Admins can update line items in their company"
  on public.line_items for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Admins can delete line items in their company"
  on public.line_items for delete
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- inventory
-- =========================================================================
drop policy if exists "All authenticated users can read inventory" on public.inventory;
drop policy if exists "Admins can update inventory" on public.inventory;

create policy "Users can read inventory in their company"
  on public.inventory for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Admins can update inventory in their company"
  on public.inventory for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (company_id = public.current_company_id());

-- No INSERT policy — inventory rows are created by the trigger below,
-- which runs SECURITY DEFINER and bypasses RLS.

-- =========================================================================
-- sales
-- =========================================================================
drop policy if exists "Authenticated users can read sales" on public.sales;
drop policy if exists "Workers can create their own sales" on public.sales;
drop policy if exists "Admins can update sales" on public.sales;

create policy "Users can read sales in their company"
  on public.sales for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Workers can create their own sales"
  on public.sales for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and worker_id in (select id from public.users where supabase_id = auth.uid())
  );

create policy "Admins can update sales in their company"
  on public.sales for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- customers
-- =========================================================================
drop policy if exists "Authenticated users can read customers" on public.customers;
drop policy if exists "Authenticated users can insert customers" on public.customers;
drop policy if exists "Admins can update customers" on public.customers;
drop policy if exists "Admins can delete customers" on public.customers;

create policy "Users can read customers in their company"
  on public.customers for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Users can insert customers in their company"
  on public.customers for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "Admins can update customers in their company"
  on public.customers for update
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  )
  with check (company_id = public.current_company_id());

create policy "Admins can delete customers in their company"
  on public.customers for delete
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- access_codes
-- =========================================================================
drop policy if exists "Admins can read access codes" on public.access_codes;
drop policy if exists "Admins can insert access codes" on public.access_codes;
drop policy if exists "Admins can delete their own access codes" on public.access_codes;

create policy "Admins can read access codes in their company"
  on public.access_codes for select
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Admins can insert access codes in their company"
  on public.access_codes for insert
  to authenticated
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

create policy "Admins can delete their own access codes"
  on public.access_codes for delete
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
    and created_by in (select id from public.users where supabase_id = auth.uid())
  );

-- =========================================================================
-- price_history
-- =========================================================================
drop policy if exists "Authenticated users can read price history" on public.price_history;
drop policy if exists "Authenticated users can insert price history" on public.price_history;

create policy "Users can read price history in their company"
  on public.price_history for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Admins can insert price history in their company"
  on public.price_history for insert
  to authenticated
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- company_settings
-- =========================================================================
drop policy if exists "Authenticated users can read company settings" on public.company_settings;
drop policy if exists "Admins can insert company settings" on public.company_settings;
drop policy if exists "Admins can update company settings" on public.company_settings;

create policy "Users can read company settings in their company"
  on public.company_settings for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Owners can insert company settings for their company"
  on public.company_settings for insert
  to authenticated
  with check (
    public.is_owner()
    and company_id = public.current_company_id()
  );

create policy "Owners can update company settings in their company"
  on public.company_settings for update
  to authenticated
  using (
    public.is_owner()
    and company_id = public.current_company_id()
  )
  with check (
    public.is_owner()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- RPC fix: create_access_code now sets company_id on the new row. Phase 2
-- made access_codes.company_id NOT NULL, so the previous version from
-- 20260422000001 would fail on every call.
-- =========================================================================
create or replace function public.create_access_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  current_user_id uuid;
  caller_company_id uuid;
  bytes bytea;
  num int;
  max_attempts int := 10;
  attempt int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create access codes';
  end if;

  select id, company_id into current_user_id, caller_company_id
    from public.users
    where supabase_id = auth.uid();

  loop
    attempt := attempt + 1;
    bytes := gen_random_bytes(2);
    num := get_byte(bytes, 0) * 256 + get_byte(bytes, 1);
    new_code := lpad((num % 10000)::text, 4, '0');

    begin
      insert into public.access_codes (code, created_by, company_id)
        values (new_code, current_user_id, caller_company_id);
      return new_code;
    exception when unique_violation then
      if attempt >= max_attempts then
        raise exception 'Unable to generate unique access code after % attempts', max_attempts;
      end if;
    end;
  end loop;
end;
$$;

-- =========================================================================
-- Trigger fix: update_inventory_on_buy now stamps company_id on the
-- inventory row when inserting a first-time entry for a metal. Without
-- this, the NOT NULL constraint from phase 2 would fail every buy that
-- introduces a new metal to a company's inventory.
-- =========================================================================
create or replace function public.update_inventory_on_buy()
returns trigger
language plpgsql
security definer
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
