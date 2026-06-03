-- Qualify pgcrypto function calls.
--
-- Both create_access_code and create_invite_code were calling
-- gen_random_bytes() unqualified, but in Supabase pgcrypto lives in the
-- `extensions` schema, and our SECURITY DEFINER functions explicitly
-- set search_path = public — which excludes extensions. The function
-- isn't found at runtime, even though gen_random_uuid() works as a
-- column default elsewhere (default expressions resolve through a
-- different search path).
--
-- Fix: call extensions.gen_random_bytes() explicitly. Same for the
-- invite-code generator.

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
    bytes := extensions.gen_random_bytes(2);
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

create or replace function public.create_invite_code(p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  current_user_id uuid;
  caller_role text;
  caller_company_id uuid;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  i int;
  max_attempts int := 10;
  attempt int := 0;
begin
  if p_role not in ('owner', 'admin', 'worker') then
    raise exception 'Role must be owner, admin, or worker';
  end if;

  select role, company_id, id
    into caller_role, caller_company_id, current_user_id
    from public.users
    where supabase_id = auth.uid()
      and is_active = true
      and role in ('admin', 'owner');

  if caller_role is null then
    raise exception 'Only active admins or owners can create invite codes';
  end if;

  if caller_role = 'admin' and p_role = 'owner' then
    raise exception 'Admins cannot invite owners; only owners can';
  end if;

  loop
    attempt := attempt + 1;
    bytes := extensions.gen_random_bytes(8);
    new_code := '';
    for i in 0..7 loop
      new_code := new_code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.invite_codes (code, company_id, role, created_by)
        values (new_code, caller_company_id, p_role, current_user_id);
      return new_code;
    exception when unique_violation then
      if attempt >= max_attempts then
        raise exception 'Unable to generate unique invite code after % attempts', max_attempts;
      end if;
    end;
  end loop;
end;
$$;
