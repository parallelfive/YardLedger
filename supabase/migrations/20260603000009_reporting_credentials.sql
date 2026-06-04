-- Per-company state-reporting (LeadsOnline) credentials, stored securely.
--
-- Each yard has its own NMRLD dealer registration + LeadsOnline SFTP account.
-- Credentials must be (a) writable by the yard owner from the app, but
-- (b) NEVER readable back by any client (write-only secret), and (c) readable
-- only by the server-side uploader (service role / edge function).
--
-- Mechanism: the table has RLS ENABLED with NO client policies, so the anon/
-- authenticated roles cannot select or modify it at all. Owners write through
-- a SECURITY DEFINER RPC; a separate RPC returns only NON-secret fields plus a
-- has_credentials boolean. The edge function reads the full row via the
-- service-role key (which bypasses RLS).

create table if not exists public.company_reporting_config (
  company_id uuid primary key references public.companies(id) on delete cascade,
  provider text not null default 'leadsonline',
  sftp_host text not null default '',
  sftp_port int not null default 22,
  sftp_username text not null default '',
  sftp_password text not null default '',
  remote_dir text not null default '',
  enabled boolean not null default false,
  updated_by uuid references public.users(id),
  updated_at timestamptz not null default now()
);

-- RLS on, NO policies → no anon/authenticated access. Only SECURITY DEFINER
-- RPCs (below) and the service role (edge function) can touch it.
alter table public.company_reporting_config enable row level security;

-- Owner-only write. A blank password leaves the stored one intact, so the
-- owner can edit host/user without re-entering (the app never reads it back).
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
  if not public.is_owner() then
    raise exception 'Only owners can configure state reporting';
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

-- Non-secret read for the settings screen. Never returns the password.
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
           c.remote_dir, c.enabled, (c.sftp_password <> '')
    from public.company_reporting_config c
    where c.company_id = public.current_company_id();
end;
$$;

revoke all on function public.get_reporting_config() from public;
grant execute on function public.get_reporting_config() to authenticated;
