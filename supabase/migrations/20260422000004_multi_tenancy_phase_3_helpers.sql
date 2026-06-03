-- Multi-tenancy phase 3: helper functions that phase 4 RLS policies will
-- lean on to scope every query by company.
--
-- Adds:
--   - current_company_id() → resolves the caller's company
--   - is_owner()           → owner role check
--
-- Updates:
--   - is_admin() now returns true for 'admin' OR 'owner' (owners inherit
--     all admin powers without rewriting every policy) and additionally
--     requires is_active = true, so a deactivated admin instantly loses
--     admin privileges on their next query.
--
--   - handle_new_user() routes unclaimed sign-ups to the Legacy company
--     as inactive workers. Phase 8 will replace this with invite-code
--     validation; the fallback keeps public sign-up from breaking after
--     phase 2 made users.company_id NOT NULL.

-- =========================================================================
-- current_company_id(): the caller's company
-- =========================================================================
create or replace function public.current_company_id()
returns uuid
language sql
security definer set search_path = ''
stable
as $$
  select company_id from public.users
  where supabase_id = auth.uid();
$$;

-- =========================================================================
-- is_owner(): owner role check (requires is_active)
-- =========================================================================
create or replace function public.is_owner()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.users
    where supabase_id = auth.uid()
      and role = 'owner'
      and is_active = true
  );
$$;

-- =========================================================================
-- is_admin(): semantics change. Returns true for admin OR owner, and now
-- requires is_active = true so deactivation takes effect immediately.
-- =========================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.users
    where supabase_id = auth.uid()
      and role in ('admin', 'owner')
      and is_active = true
  );
$$;

-- =========================================================================
-- handle_new_user(): temporary fallback routing sign-ups to Legacy.
-- Phase 8 replaces this with invite-code validation.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  legacy_id uuid;
begin
  select id into legacy_id
    from public.companies
    where prefix = 'LEGAC-2026'
    limit 1;

  insert into public.users (supabase_id, email, name, role, is_active, company_id)
  values (new.id, new.email, '', 'worker', false, legacy_id);
  return new;
end;
$$;
