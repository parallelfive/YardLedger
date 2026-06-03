-- Prefilled metal catalog per company.
--
-- Problem: new companies were created with an EMPTY metals/metal_categories
-- set (only company_settings was auto-seeded). A fresh yard had to hand-enter
-- ~30 metal grades AND re-type every is_regulated/is_restricted compliance
-- flag — guaranteeing onboarding friction and regulatory-flag drift.
--
-- Solution (per-company rows, NOT a normalized shared catalog — avoids
-- repointing line_items/inventory FKs): keep a canonical TEMPLATE captured
-- from the current catalog, and seed every new (and existing-empty) company
-- from it. Each company owns its rows and sets its own prices — "prefilled
-- materials, custom pricing per company". The regulatory flags come from the
-- authoritative template, so they're correct out of the box.

-- ---- 0. Ensure per-company name uniqueness (self-contained; also in the
--         audit-round-2 migration — guarded so either order is fine) --------
do $$
begin
  alter table public.metals drop constraint if exists metals_name_key;
  alter table public.metal_categories drop constraint if exists metal_categories_name_key;
  if not exists (
    select 1 from pg_constraint where conname = 'metals_company_name_key'
  ) then
    alter table public.metals
      add constraint metals_company_name_key unique (company_id, name);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'metal_categories_company_name_key'
  ) then
    alter table public.metal_categories
      add constraint metal_categories_company_name_key unique (company_id, name);
  end if;
end $$;

-- ---- 1. Canonical template tables (operator reference data) --------------
create table if not exists public.metal_catalog_template_categories (
  name text primary key,
  display_order int not null default 0,
  image_url text
);

create table if not exists public.metal_catalog_template_metals (
  name text primary key,
  category_name text,
  is_regulated boolean not null default false,
  is_restricted boolean not null default false,
  default_price numeric(10,4) not null default 0
);

-- Reference data: RLS on, no policies => only SECURITY DEFINER / service role
-- (the seed function) can touch it; tenants never read it directly.
alter table public.metal_catalog_template_categories enable row level security;
alter table public.metal_catalog_template_metals enable row level security;

-- ---- 2. Populate the template from whatever catalog currently exists ------
-- DISTINCT ON (name) picks one representative row per name across all
-- companies, capturing the real canonical grade list + flags at apply time
-- (no hardcoded 30-row list to drift out of date).
insert into public.metal_catalog_template_categories (name, display_order, image_url)
select distinct on (name) name, display_order, image_url
from public.metal_categories
order by name, display_order
on conflict (name) do nothing;

insert into public.metal_catalog_template_metals
  (name, category_name, is_regulated, is_restricted, default_price)
select distinct on (m.name)
  m.name, c.name, m.is_regulated, m.is_restricted, m.price_per_lb
from public.metals m
left join public.metal_categories c on c.id = m.category_id
where m.is_active
order by m.name, m.created_at
on conflict (name) do nothing;

-- ---- 3. Seed function: copy template -> a company (idempotent) -----------
create or replace function public.seed_company_metals(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.metal_categories (company_id, name, display_order, image_url, is_active)
  select p_company_id, t.name, t.display_order, t.image_url, true
  from public.metal_catalog_template_categories t
  on conflict (company_id, name) do nothing;

  insert into public.metals
    (company_id, name, category_id, price_per_lb, is_regulated, is_restricted, is_active)
  select
    p_company_id, t.name, c.id, t.default_price, t.is_regulated, t.is_restricted, true
  from public.metal_catalog_template_metals t
  left join public.metal_categories c
    on c.company_id = p_company_id and c.name = t.category_name
  on conflict (company_id, name) do nothing;
end;
$$;

-- ---- 4. Auto-seed every newly created company ----------------------------
create or replace function public.trg_seed_company_metals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_company_metals(new.id);
  return new;
end;
$$;

drop trigger if exists trg_seed_company_metals on public.companies;
create trigger trg_seed_company_metals
  after insert on public.companies
  for each row execute function public.trg_seed_company_metals();

-- ---- 5. Backfill existing companies (idempotent; only fills gaps) --------
do $$
declare
  c record;
begin
  for c in select id from public.companies loop
    perform public.seed_company_metals(c.id);
  end loop;
end $$;
