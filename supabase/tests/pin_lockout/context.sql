-- Minimal faithful context for testing the PIN-lockout fix (#142/#158).
create or replace function auth.uid() returns uuid
language sql stable as $$ select nullif(current_setting('app.current_uid', true), '')::uuid $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table public.companies (
  id uuid primary key default gen_random_uuid(), name text, prefix text
);
create table public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_id uuid,
  company_id uuid references public.companies(id),
  role text, is_active boolean default true, name text
);

-- verbatim from 20260422000004
create or replace function public.current_company_id()
returns uuid language sql security definer set search_path = '' stable as $$
  select company_id from public.users where supabase_id = auth.uid();
$$;
create or replace function public.is_owner()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.users
    where supabase_id = auth.uid() and role = 'owner' and is_active = true);
$$;
create or replace function public.is_admin()
returns boolean language sql security definer set search_path = '' stable as $$
  select exists (select 1 from public.users
    where supabase_id = auth.uid() and role in ('admin','owner') and is_active = true);
$$;
