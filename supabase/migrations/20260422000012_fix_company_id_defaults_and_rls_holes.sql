-- Fix three multi-tenancy defects surfaced by audit:
--
-- 1. company_id was NOT NULL on every business table but nothing ever set
--    it: no column default, no trigger, and no client service passes it.
--    Every INSERT therefore failed the NOT NULL constraint *and* the RLS
--    `with check (company_id = current_company_id())`. The app could not
--    write any data. Fix: default company_id to the caller's company.
--
-- 2. Privilege escalation. The "Users can update own name" self-update
--    policy only checked `supabase_id = auth.uid()` in WITH CHECK, so a
--    worker could `update users set role='owner'` (or move themselves to
--    another company). Pin role / company_id / is_active to their existing
--    values on self-update; admin/owner role changes go through the
--    separate admin policies.
--
-- 3. validate_access_code (SECURITY DEFINER, bypasses RLS) matched on the
--    4-digit code alone with no company scope, so a worker could consume /
--    brute-force any company's price-override codes. Scope to the caller's
--    company.

-- ---- 1. company_id defaults -------------------------------------------
-- current_company_id() is stable + security definer; safe as a default.
-- users.company_id is set by handle_new_user, inventory.company_id by its
-- buy/sale triggers, so those are left alone.
alter table public.metals            alter column company_id set default public.current_company_id();
alter table public.metal_categories  alter column company_id set default public.current_company_id();
alter table public.receipts          alter column company_id set default public.current_company_id();
alter table public.line_items        alter column company_id set default public.current_company_id();
alter table public.sales             alter column company_id set default public.current_company_id();
alter table public.customers         alter column company_id set default public.current_company_id();
alter table public.access_codes      alter column company_id set default public.current_company_id();
alter table public.price_history     alter column company_id set default public.current_company_id();
alter table public.company_settings  alter column company_id set default public.current_company_id();

-- ---- 2. Lock down user self-update ------------------------------------
drop policy if exists "Users can update own name" on public.users;
create policy "Users can update own name"
  on public.users for update
  to authenticated
  using (supabase_id = auth.uid())
  with check (
    supabase_id = auth.uid()
    -- role / company_id / is_active must be unchanged. The subquery reads
    -- the row's pre-update value (statement-snapshot), so any attempt to
    -- alter these columns fails the check.
    and role       = (select u.role       from public.users u where u.supabase_id = auth.uid())
    and company_id = (select u.company_id from public.users u where u.supabase_id = auth.uid())
    and is_active  = (select u.is_active  from public.users u where u.supabase_id = auth.uid())
  );

-- ---- 3. Company-scope access-code validation --------------------------
create or replace function public.validate_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  code_id uuid;
  current_user_id uuid;
begin
  select id into current_user_id
    from public.users
    where supabase_id = auth.uid();

  select id into code_id
    from public.access_codes
    where code = p_code
      and is_used = false
      and company_id = public.current_company_id()
    limit 1;

  if code_id is null then
    return false;
  end if;

  update public.access_codes
    set is_used = true,
        used_at = now(),
        used_by = current_user_id
    where id = code_id
      and company_id = public.current_company_id();

  return true;
end;
$$;
