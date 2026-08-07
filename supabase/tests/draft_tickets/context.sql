-- Minimal-but-faithful context for testing the draft_tickets (employee->cashier)
-- hardening. The tables + helper functions below are copied verbatim from their
-- real migrations; auth.uid() is shimmed to read a GUC we control per-test so we
-- can simulate the shared-terminal session user.

-- auth.uid() reads a GUC we set per test (the session user's supabase_id).
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('app.current_uid', true), '')::uuid;
$$;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text,
  prefix text
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_id uuid,
  company_id uuid references public.companies(id),
  role text,
  is_active boolean default true,
  name text,
  pin_hash text
);

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid
);

-- Verbatim from 20260422000004_multi_tenancy_phase_3_helpers.sql
create or replace function public.current_company_id()
returns uuid language sql security definer set search_path = '' stable as $$
  select company_id from public.users where supabase_id = auth.uid();
$$;

-- Verbatim from 20260612000002_created_by_session.sql
create or replace function public.stamp_created_by_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.created_by_session := (select id from public.users where supabase_id = auth.uid());
  return new;
end;
$$;
