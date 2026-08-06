-- Restore owner-ELEVATION gating on the state-reporting credentials write (#44).
--
-- 20260618000004 hardened upsert_reporting_config from a session-role check to
-- an owner-grade elevation-window check (has_admin_elevation(true)), because the
-- shared-terminal model means the Supabase session belongs to the owner/admin
-- who logged the device in — NOT the staffer currently at the counter. Gating on
-- is_owner()/auth.uid() lets any worker on that terminal rewrite the SFTP host /
-- username / password (or flip `enabled`) with no owner PIN.
--
-- The Vault-encryption migration (20260624000001, dated later so it wins) then
-- recreated this function to move the password into Vault, and in doing so
-- silently reintroduced `if not public.is_owner()`. This restores the elevation
-- guard while keeping that migration's Vault secret-handling body verbatim.
--
-- (The read path get_reporting_config stays on is_admin(): it returns only
-- non-secret fields + a has_credentials boolean, and gating a plain view behind
-- a PIN window would just be friction. The WRITE is the security fix.)
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
  if not public.has_admin_elevation(true) then
    raise exception 'Configuring state reporting requires owner authorization';
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
