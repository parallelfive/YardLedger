-- Minimal faithful context for testing the reporting-creds elevation fix (#44/#159).
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;

create table public.companies (id uuid primary key default gen_random_uuid(), name text, prefix text);
create table public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_id uuid, company_id uuid references public.companies(id),
  role text, is_active boolean default true, name text
);
create or replace function public.current_company_id()
returns uuid language sql security definer set search_path = '' stable as $$
  select company_id from public.users where supabase_id = auth.uid();
$$;

-- admin_elevations + has_admin_elevation verbatim from 20260618000002
create table public.admin_elevations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid, user_id uuid, expires_at timestamptz, require_owner boolean
);
create or replace function public.has_admin_elevation(p_require_owner boolean default false)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.admin_elevations
    where company_id = public.current_company_id()
      and expires_at > now()
      and (not p_require_owner or require_owner)
  );
$$;

-- company_reporting_config: the columns upsert_reporting_config touches.
create table public.company_reporting_config (
  company_id uuid primary key,
  provider text, sftp_host text, sftp_port int, sftp_username text,
  remote_dir text, enabled boolean, updated_by uuid, updated_at timestamptz,
  sftp_password_secret_id uuid
);

-- The supabase/postgres image already ships Supabase Vault (vault.create_secret /
-- vault.update_secret / vault.secrets), so we use the real thing rather than a
-- stub — stubbing just creates an ambiguous overload of create_secret.
