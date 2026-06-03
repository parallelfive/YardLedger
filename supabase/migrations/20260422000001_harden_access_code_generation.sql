-- Harden access code generation and add audit trail.
--
-- Two changes:
--   1. Move code generation from client-side Math.random() to a server-side
--      RPC using pgcrypto's gen_random_bytes. 4-digit numeric, admin-only.
--   2. Record who validated each code (used_by), so overrides can be audited
--      back to the worker whose session consumed the code.

-- ---- Audit column ------------------------------------------------------
alter table public.access_codes
  add column used_by uuid references public.users(id);

-- ---- Server-side generation -------------------------------------------
create or replace function public.create_access_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  current_user_id uuid;
  bytes bytea;
  num int;
  max_attempts int := 10;
  attempt int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create access codes';
  end if;

  select id into current_user_id
    from public.users
    where supabase_id = auth.uid();

  -- Retry on the rare unique(code) collision. 4-digit space is small (10k),
  -- so collisions become likely once a yard has generated many unused codes.
  loop
    attempt := attempt + 1;
    bytes := gen_random_bytes(2);
    num := get_byte(bytes, 0) * 256 + get_byte(bytes, 1);
    new_code := lpad((num % 10000)::text, 4, '0');

    begin
      insert into public.access_codes (code, created_by)
        values (new_code, current_user_id);
      return new_code;
    exception when unique_violation then
      if attempt >= max_attempts then
        raise exception 'Unable to generate unique access code after % attempts', max_attempts;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.create_access_code() from public;
grant execute on function public.create_access_code() to authenticated;

-- ---- Update validate to record used_by --------------------------------
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
    limit 1;

  if code_id is null then
    return false;
  end if;

  update public.access_codes
    set is_used = true,
        used_at = now(),
        used_by = current_user_id
    where id = code_id;

  return true;
end;
$$;
