-- Role enforcement, part 4: elevation hygiene helpers.
--
-- 1. clear_elevation(): drop the company's active elevation window(s). Called by
--    the client whenever the active staff identity changes (lock / PIN-in) so an
--    admin's window can't outlive their presence at the terminal — e.g. an admin
--    elevates, then hands the terminal to a worker. Clearing only ever REDUCES
--    privilege, so it's safe for any authenticated caller in the company.
--
-- 2. current_user_has_pin(): does the signed-in user have a PIN set? Drives the
--    "set your admin PIN" gate so an admin/owner isn't locked out of admin work
--    after enforcement tightens (they need a PIN to open an elevation window).

create or replace function public.clear_elevation()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.admin_elevations
    where company_id = public.current_company_id();
$$;

revoke all on function public.clear_elevation() from public;
grant execute on function public.clear_elevation() to authenticated;

create or replace function public.current_user_has_pin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select pin_hash is not null from public.users where supabase_id = auth.uid()),
    false
  );
$$;

revoke all on function public.current_user_has_pin() from public;
grant execute on function public.current_user_has_pin() to authenticated;
