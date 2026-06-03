-- Multi-tenancy phase 1: schema foundation.
--
-- Adds companies and invite_codes tables, and a nullable company_id column
-- to every business table. Existing data stays untouched — phase 2 handles
-- the backfill and the NOT NULL flip. No RLS or policy changes yet;
-- phase 4 rewrites policies to scope by company.
--
-- Also extends users.role to include 'owner' so phase 2 can promote the
-- first existing admin to the Legacy company's owner.

-- =========================================================================
-- companies: tenant registry
-- =========================================================================
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Prefix format: 2-5 uppercase letters, a hyphen, 4-digit year.
  -- Example: GR-2026, GRTWO-2026. Used as the receipt-number prefix.
  prefix text not null unique check (prefix ~ '^[A-Z]{2,5}-[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at
  before update on public.companies
  for each row execute function public.update_updated_at();

alter table public.companies enable row level security;
-- Policies deferred to phase 4.

-- =========================================================================
-- invite_codes: admin/owner generates these to bring new users into their
-- company with a specific role. Replaces self-signup + approval flow.
-- =========================================================================
create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'worker')),
  created_by uuid not null references public.users(id),
  is_used boolean not null default false,
  used_at timestamptz,
  used_by uuid references public.users(id),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_invite_codes_company on public.invite_codes(company_id);
create index idx_invite_codes_code on public.invite_codes(code) where is_used = false;

alter table public.invite_codes enable row level security;
-- Policies deferred to phase 4.

-- =========================================================================
-- Extend users.role to include 'owner'
-- =========================================================================
alter table public.users
  drop constraint if exists users_role_check;

alter table public.users
  add constraint users_role_check check (role in ('owner', 'admin', 'worker'));

-- =========================================================================
-- Add company_id (nullable) to every business table. Phase 2 backfills
-- and flips these to NOT NULL.
-- =========================================================================
alter table public.users add column company_id uuid references public.companies(id);
alter table public.metals add column company_id uuid references public.companies(id);
alter table public.metal_categories add column company_id uuid references public.companies(id);
alter table public.receipts add column company_id uuid references public.companies(id);
alter table public.line_items add column company_id uuid references public.companies(id);
alter table public.inventory add column company_id uuid references public.companies(id);
alter table public.sales add column company_id uuid references public.companies(id);
alter table public.customers add column company_id uuid references public.companies(id);
alter table public.access_codes add column company_id uuid references public.companies(id);
alter table public.price_history add column company_id uuid references public.companies(id);
alter table public.company_settings add column company_id uuid references public.companies(id);

-- Every read path will filter on company_id; add indexes proactively.
create index idx_users_company on public.users(company_id);
create index idx_metals_company on public.metals(company_id);
create index idx_metal_categories_company on public.metal_categories(company_id);
create index idx_receipts_company on public.receipts(company_id);
create index idx_line_items_company on public.line_items(company_id);
create index idx_inventory_company on public.inventory(company_id);
create index idx_sales_company on public.sales(company_id);
create index idx_customers_company on public.customers(company_id);
create index idx_access_codes_company on public.access_codes(company_id);
create index idx_price_history_company on public.price_history(company_id);
create index idx_company_settings_company on public.company_settings(company_id);
