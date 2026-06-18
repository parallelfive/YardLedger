-- Role enforcement, part 3: convert the SECURITY DEFINER functions that still
-- gate on session role (is_admin/is_owner) onto elevation windows, and attach
-- audit triggers that attribute privileged config changes to the PIN'd admin.

-- ── create_access_code: admin elevation instead of session is_admin ──────────
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
  if not public.has_admin_elevation() then
    raise exception 'Creating an access code requires admin authorization';
  end if;

  caller_company_id := public.current_company_id();
  select id into current_user_id from public.users where supabase_id = auth.uid();

  loop
    attempt := attempt + 1;
    bytes := extensions.gen_random_bytes(3);
    num := get_byte(bytes, 0) * 65536 + get_byte(bytes, 1) * 256 + get_byte(bytes, 2);
    new_code := lpad((num % 1000000)::text, 6, '0');

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

revoke all on function public.create_access_code() from public;
grant execute on function public.create_access_code() to authenticated;

-- ── create_invite_code: owner elevation for owner invites, else admin ────────
create or replace function public.create_invite_code(p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  current_user_id uuid;
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

  -- Inviting an owner requires owner-grade authorization (preserves the matrix:
  -- admins manage admins/workers; only owners create owners).
  if p_role = 'owner' then
    if not public.has_admin_elevation(true) then
      raise exception 'Only owners can invite owners';
    end if;
  else
    if not public.has_admin_elevation() then
      raise exception 'Creating an invite code requires admin authorization';
    end if;
  end if;

  caller_company_id := public.current_company_id();
  select id into current_user_id from public.users where supabase_id = auth.uid();

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

revoke all on function public.create_invite_code(text) from public;
grant execute on function public.create_invite_code(text) to authenticated;

-- ── upsert_reporting_config: owner elevation instead of session is_owner ─────
create or replace function public.upsert_reporting_config(
  p_provider text,
  p_sftp_host text,
  p_sftp_port int,
  p_sftp_username text,
  p_sftp_password text,
  p_remote_dir text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_uid uuid;
begin
  if not public.has_admin_elevation(true) then
    raise exception 'Configuring state reporting requires owner authorization';
  end if;
  v_company := public.current_company_id();
  select id into v_uid from public.users where supabase_id = auth.uid();

  insert into public.company_reporting_config as c (
    company_id, provider, sftp_host, sftp_port, sftp_username,
    sftp_password, remote_dir, enabled, updated_by, updated_at
  )
  values (
    v_company, coalesce(p_provider, 'leadsonline'), coalesce(p_sftp_host, ''),
    coalesce(p_sftp_port, 22), coalesce(p_sftp_username, ''),
    coalesce(p_sftp_password, ''), coalesce(p_remote_dir, ''),
    coalesce(p_enabled, false), v_uid, now()
  )
  on conflict (company_id) do update set
    provider = excluded.provider,
    sftp_host = excluded.sftp_host,
    sftp_port = excluded.sftp_port,
    sftp_username = excluded.sftp_username,
    sftp_password = case
                      when excluded.sftp_password = '' then c.sftp_password
                      else excluded.sftp_password
                    end,
    remote_dir = excluded.remote_dir,
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = now();
end;
$$;

revoke all on function public.upsert_reporting_config(text, text, int, text, text, text, boolean) from public;
grant execute on function public.upsert_reporting_config(text, text, int, text, text, text, boolean) to authenticated;

-- ── enforce_line_item_pricing: price override needs elevation (not session) ──
-- Workers still override via a consumed access code (unchanged). The is_admin()
-- session shortcut becomes an elevation check so an admin-signed terminal alone
-- no longer authorizes silent overrides.
create or replace function public.enforce_line_item_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market      numeric(10,4);
  v_uid         uuid;
  v_recent_code boolean;
begin
  select price_per_lb into v_market
    from public.metals
    where id = new.metal_id
      and company_id = coalesce(new.company_id, public.current_company_id());

  if v_market is null then
    raise exception 'Unknown metal % for this company', new.metal_id;
  end if;

  select id into v_uid from public.users where supabase_id = auth.uid();

  new.original_price_per_lb := v_market;
  new.is_price_override := (new.price_per_lb is distinct from v_market);
  new.total := round(new.weight * new.price_per_lb, 2);

  if new.is_price_override then
    -- Elevated admins may override directly; everyone else needs an approval
    -- code consumed for this company within the last 15 minutes.
    if not public.has_admin_elevation() then
      select exists (
        select 1 from public.access_codes
        where company_id = coalesce(new.company_id, public.current_company_id())
          and used_by = v_uid
          and is_used = true
          and used_at > now() - interval '15 minutes'
      ) into v_recent_code;

      if not coalesce(v_recent_code, false) then
        raise exception
          'Price override requires a valid approval code (none consumed recently).';
      end if;
    end if;

    if new.override_approved_by is null then
      new.override_approved_by := v_uid::text;
    end if;
  end if;

  return new;
end;
$$;

-- ── audit triggers: attribute privileged config changes to the PIN'd admin ───
-- Harden stamp_admin_action so it is a no-op outside a company session (seed /
-- signup / service-role contexts) — those would otherwise hit NOT NULL on
-- admin_action_log.company_id and break the underlying write.
create or replace function public.stamp_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
  v_actor uuid;
begin
  if v_company is null then
    return null; -- no company session (seed/signup) — nothing to attribute
  end if;

  select user_id into v_actor
    from public.admin_elevations
    where company_id = v_company and expires_at > now()
    order by granted_at desc
    limit 1;

  insert into public.admin_action_log
    (company_id, actor_user_id, action, target_table, target_id)
  values
    (v_company, v_actor, lower(tg_op), tg_table_name,
     case tg_op when 'DELETE' then old.id else new.id end);

  return null;
end;
$$;

-- Attach to the high-value config tables, UPDATE/DELETE only (creation/signup
-- are covered elsewhere and avoid seed-context edge cases).
drop trigger if exists trg_stamp_admin_action on public.metals;
create trigger trg_stamp_admin_action
  after update or delete on public.metals
  for each row execute function public.stamp_admin_action();

drop trigger if exists trg_stamp_admin_action on public.users;
create trigger trg_stamp_admin_action
  after update or delete on public.users
  for each row execute function public.stamp_admin_action();

drop trigger if exists trg_stamp_admin_action on public.company_settings;
create trigger trg_stamp_admin_action
  after update on public.company_settings
  for each row execute function public.stamp_admin_action();

drop trigger if exists trg_stamp_admin_action on public.companies;
create trigger trg_stamp_admin_action
  after update on public.companies
  for each row execute function public.stamp_admin_action();
