-- Encrypt the per-company state-reporting (LeadsOnline) SFTP password at rest
-- using Supabase Vault, so a DB dump or a service-role leak does not directly
-- expose tenant SFTP passwords in plaintext.
--
-- Before: company_reporting_config.sftp_password held the password as plaintext
-- (protected only by RLS + service-role boundary).
-- After: the password lives as a Vault secret (encrypted with pgsodium under a
-- key never stored in the DB); the table keeps only the secret's UUID. Owners
-- still write it through upsert_reporting_config (never read it back); the edge
-- function fetches the decrypted value through a service_role-only RPC.

create extension if not exists supabase_vault with schema vault;

-- 1. Reference column for the Vault secret.
alter table public.company_reporting_config
  add column if not exists sftp_password_secret_id uuid;

-- 2. Migrate any existing plaintext password into Vault, then forget it.
do $$
declare
  r record;
  v_secret_id uuid;
begin
  -- Guard: the column may already be gone on a re-run.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'company_reporting_config'
      and column_name = 'sftp_password'
  ) then
    for r in
      execute 'select company_id, sftp_password from public.company_reporting_config
               where coalesce(sftp_password, '''') <> '''' '
    loop
      v_secret_id := vault.create_secret(
        r.sftp_password,
        null,
        'LeadsOnline SFTP password for company ' || r.company_id::text
      );
      update public.company_reporting_config
        set sftp_password_secret_id = v_secret_id
        where company_id = r.company_id;
    end loop;
  end if;
end $$;

-- 3. Drop the plaintext column entirely.
alter table public.company_reporting_config
  drop column if exists sftp_password;

-- 4. Owner write path — store/rotate the password as a Vault secret. A blank
--    password leaves the existing secret intact (edit host/user without
--    re-entering). Non-secret fields upsert as before.
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
  v_secret_id uuid;
begin
  if not public.is_owner() then
    raise exception 'Only owners can configure state reporting';
  end if;
  v_company := public.current_company_id();
  select id into v_uid from public.users where supabase_id = auth.uid();

  insert into public.company_reporting_config as c (
    company_id, provider, sftp_host, sftp_port, sftp_username,
    remote_dir, enabled, updated_by, updated_at
  )
  values (
    v_company, coalesce(p_provider, 'leadsonline'), coalesce(p_sftp_host, ''),
    coalesce(p_sftp_port, 22), coalesce(p_sftp_username, ''),
    coalesce(p_remote_dir, ''), coalesce(p_enabled, false), v_uid, now()
  )
  on conflict (company_id) do update set
    provider = excluded.provider,
    sftp_host = excluded.sftp_host,
    sftp_port = excluded.sftp_port,
    sftp_username = excluded.sftp_username,
    remote_dir = excluded.remote_dir,
    enabled = excluded.enabled,
    updated_by = excluded.updated_by,
    updated_at = now();

  -- Secret handling (only when a new password was supplied).
  if coalesce(p_sftp_password, '') <> '' then
    select sftp_password_secret_id into v_secret_id
      from public.company_reporting_config where company_id = v_company;
    if v_secret_id is null then
      v_secret_id := vault.create_secret(
        p_sftp_password, null,
        'LeadsOnline SFTP password for company ' || v_company::text
      );
      update public.company_reporting_config
        set sftp_password_secret_id = v_secret_id
        where company_id = v_company;
    else
      perform vault.update_secret(v_secret_id, p_sftp_password);
    end if;
  end if;
end;
$$;

revoke all on function public.upsert_reporting_config(text, text, int, text, text, text, boolean) from public;
grant execute on function public.upsert_reporting_config(text, text, int, text, text, text, boolean) to authenticated;

-- 5. Non-secret read for the settings screen — has_credentials now derives from
--    the presence of a Vault secret reference.
create or replace function public.get_reporting_config()
returns table (
  provider text,
  sftp_host text,
  sftp_port int,
  sftp_username text,
  remote_dir text,
  enabled boolean,
  has_credentials boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return query
    select c.provider, c.sftp_host, c.sftp_port, c.sftp_username,
           c.remote_dir, c.enabled, (c.sftp_password_secret_id is not null)
    from public.company_reporting_config c
    where c.company_id = public.current_company_id();
end;
$$;

revoke all on function public.get_reporting_config() from public;
grant execute on function public.get_reporting_config() to authenticated;

-- 6. Service-role-only decrypt path for the uploader edge function. Returns the
--    decrypted SFTP password for one company. Executable ONLY by service_role
--    (the edge function); authenticated/anon clients can never call it.
create or replace function public.get_reporting_secret(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret_id uuid;
  v_password text;
begin
  select sftp_password_secret_id into v_secret_id
    from public.company_reporting_config where company_id = p_company_id;
  if v_secret_id is null then
    return null;
  end if;
  select decrypted_secret into v_password
    from vault.decrypted_secrets where id = v_secret_id;
  return v_password;
end;
$$;

-- Lock this down to service_role ONLY. Supabase's default privileges grant
-- execute to anon/authenticated on new public functions, and `revoke … from
-- public` does NOT strip those explicit role grants — so they must be revoked
-- by name. Otherwise any logged-in (or anon) caller could pass an arbitrary
-- company_id and read that tenant's decrypted SFTP password.
revoke all on function public.get_reporting_secret(uuid)
  from public, anon, authenticated;
grant execute on function public.get_reporting_secret(uuid) to service_role;
