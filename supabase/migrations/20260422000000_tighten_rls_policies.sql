-- Tighten RLS policies across tables.
-- Closes 5 gaps surfaced in the April audit:
--   1. company_settings readable by unauthenticated users
--   2. customers fully open to all workers
--   3. inventory INSERT policy too permissive (trigger already bypasses RLS)
--   4. sales INSERT allows spoofing worker_id; SELECT too narrow for shared-yard workflow
--   5. access_codes readable/updatable by any authenticated user
-- Also aligns receipts/sales with the agreed scope: any worker can view all the yard's
-- transactions; only admins can edit (for corrections when a worker makes a mistake).

-- =========================================================================
-- company_settings: anyone -> authenticated only
-- =========================================================================
drop policy if exists "Anyone can read company settings" on public.company_settings;

create policy "Authenticated users can read company settings"
  on public.company_settings for select
  to authenticated
  using (true);

-- =========================================================================
-- customers: workers can read and create (needed for new-customer receipt
-- flow); only admins can edit or delete to prevent bad cleanups.
-- =========================================================================
drop policy if exists "Authenticated users can read customers" on public.customers;
drop policy if exists "Authenticated users can insert customers" on public.customers;
drop policy if exists "Authenticated users can update customers" on public.customers;

create policy "Authenticated users can read customers"
  on public.customers for select
  to authenticated
  using (true);

create policy "Authenticated users can insert customers"
  on public.customers for insert
  to authenticated
  with check (true);

create policy "Admins can update customers"
  on public.customers for update
  to authenticated
  using (public.is_admin());

create policy "Admins can delete customers"
  on public.customers for delete
  to authenticated
  using (public.is_admin());

-- =========================================================================
-- receipts: any worker can view all yard receipts; only admins can edit
-- Also tighten INSERT to prevent worker_id spoofing.
-- =========================================================================
drop policy if exists "Workers read own receipts" on public.receipts;
drop policy if exists "Authenticated users can create receipts" on public.receipts;

create policy "Authenticated users can read receipts"
  on public.receipts for select
  to authenticated
  using (true);

create policy "Workers can create their own receipts"
  on public.receipts for insert
  to authenticated
  with check (
    worker_id in (select id from public.users where supabase_id = auth.uid())
  );

create policy "Admins can update receipts"
  on public.receipts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =========================================================================
-- line_items: follow receipts (all authenticated read); tighten INSERT so
-- a worker can only add line items to a receipt they own (or admin); admins
-- can edit anything.
-- =========================================================================
drop policy if exists "Line items follow receipt access" on public.line_items;
drop policy if exists "Authenticated users can create line items" on public.line_items;

create policy "Authenticated users can read line items"
  on public.line_items for select
  to authenticated
  using (true);

create policy "Users can create line items on their own receipts"
  on public.line_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id
        and (
          r.worker_id in (select id from public.users where supabase_id = auth.uid())
          or public.is_admin()
        )
    )
  );

create policy "Admins can update line items"
  on public.line_items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =========================================================================
-- inventory: drop open INSERT policy — trigger runs SECURITY DEFINER and
-- bypasses RLS, so no INSERT policy is needed for it to function.
-- =========================================================================
drop policy if exists "System can insert inventory" on public.inventory;

-- =========================================================================
-- sales: match receipts (any worker can view; tighten INSERT; admin edit)
-- =========================================================================
drop policy if exists "Workers read own sales" on public.sales;
drop policy if exists "Authenticated users can create sales" on public.sales;

create policy "Authenticated users can read sales"
  on public.sales for select
  to authenticated
  using (true);

create policy "Workers can create their own sales"
  on public.sales for insert
  to authenticated
  with check (
    worker_id in (select id from public.users where supabase_id = auth.uid())
  );

create policy "Admins can update sales"
  on public.sales for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =========================================================================
-- access_codes: workflow is "worker is logged in, admin physically types code
-- on the worker's device to authorize an override." So:
--   - only admins can SELECT (no enumeration by workers)
--   - only admins can INSERT (existing policy)
--   - any authenticated user can call validate_access_code (the RPC below),
--     since the caller's session is the worker's but the typist is the admin
-- Security during validation relies on the code being secret (6-digit out-of-
-- band). Code-strength improvements tracked separately.
-- =========================================================================
drop policy if exists "Authenticated users can read access codes" on public.access_codes;
drop policy if exists "Authenticated users can update access codes" on public.access_codes;

create policy "Admins can read access codes"
  on public.access_codes for select
  to authenticated
  using (public.is_admin());

create policy "Admins can delete their own access codes"
  on public.access_codes for delete
  to authenticated
  using (
    public.is_admin()
    and created_by in (select id from public.users where supabase_id = auth.uid())
  );

-- Atomic validate + mark-as-used. SECURITY DEFINER so the authenticated caller
-- (typically a worker) can mark the code used without SELECT/UPDATE rights on
-- the table directly.
create or replace function public.validate_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  code_id uuid;
begin
  select id into code_id
    from public.access_codes
    where code = p_code
      and is_used = false
    limit 1;

  if code_id is null then
    return false;
  end if;

  update public.access_codes
    set is_used = true,
        used_at = now()
    where id = code_id;

  return true;
end;
$$;

revoke all on function public.validate_access_code(text) from public;
grant execute on function public.validate_access_code(text) to authenticated;
