-- Users/profiles table (extends Supabase auth.users)
create table public.users (
  id uuid primary key default gen_random_uuid(),
  supabase_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null default 'worker' check (role in ('admin', 'worker')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a user profile on sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (supabase_id, email, name, role)
  values (new.id, new.email, '', 'worker');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-update updated_at on any row change
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at
  before update on public.users
  for each row execute function public.update_updated_at();

-- Helper to check admin role without triggering RLS recursion
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = ''
stable
as $$
  select exists (
    select 1 from public.users
    where supabase_id = auth.uid() and role = 'admin'
  );
$$;

-- RLS
alter table public.users enable row level security;

-- Workers can read their own profile
create policy "Users can read own profile"
  on public.users for select
  using (supabase_id = auth.uid());

-- Admins can read all users
create policy "Admins can read all users"
  on public.users for select
  using (public.is_admin());

-- Admins can update any user (role, is_active, etc.)
create policy "Admins can update users"
  on public.users for update
  using (public.is_admin());

-- Users can update their own name
create policy "Users can update own name"
  on public.users for update
  using (supabase_id = auth.uid())
  with check (supabase_id = auth.uid());
-- Metal catalog: admin-managed with pricing
create table public.metals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_per_lb numeric(10,4) not null default 0,
  is_active boolean not null default true,
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger metals_updated_at
  before update on public.metals
  for each row execute function public.update_updated_at();

-- RLS
alter table public.metals enable row level security;

-- Everyone can read active metals
create policy "All authenticated users can read metals"
  on public.metals for select
  to authenticated
  using (true);

-- Only admins can insert metals
create policy "Admins can insert metals"
  on public.metals for insert
  with check (public.is_admin());

-- Only admins can update metals (pricing, active status)
create policy "Admins can update metals"
  on public.metals for update
  using (public.is_admin());

-- Seed default metals
insert into public.metals (name, price_per_lb) values
  ('Steel', 0.08),
  ('Aluminum', 0.50),
  ('Copper', 3.50),
  ('Brass', 1.75),
  ('Stainless Steel', 0.35),
  ('Cast Iron', 0.06),
  ('Lead', 0.45),
  ('Zinc', 0.55);
-- Receipts: one per customer visit
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_number text not null unique,
  customer_name text not null,
  customer_phone text not null default '',
  type text not null check (type in ('buy', 'sell')),
  subtotal numeric(12,2) not null default 0,
  signature_uri text,
  worker_id uuid not null references public.users(id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger receipts_updated_at
  before update on public.receipts
  for each row execute function public.update_updated_at();

-- Auto-generate receipt numbers: YL-YYYYMMDD-NNNN
create or replace function public.generate_receipt_number()
returns trigger
language plpgsql
as $$
declare
  today_str text;
  seq int;
begin
  today_str := to_char(now(), 'YYYYMMDD');
  select count(*) + 1 into seq
    from public.receipts
    where receipt_number like 'YL-' || today_str || '-%';
  new.receipt_number := 'YL-' || today_str || '-' || lpad(seq::text, 4, '0');
  return new;
end;
$$;

create trigger receipts_auto_number
  before insert on public.receipts
  for each row
  when (new.receipt_number is null or new.receipt_number = '')
  execute function public.generate_receipt_number();

-- Line items: individual metals on a receipt
create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts(id) on delete cascade,
  metal_id uuid not null references public.metals(id),
  metal_name text not null, -- denormalized
  weight numeric(10,2) not null,
  price_per_lb numeric(10,4) not null,
  original_price_per_lb numeric(10,4) not null,
  is_price_override boolean not null default false,
  override_approved_by uuid references public.users(id),
  total numeric(12,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger line_items_updated_at
  before update on public.line_items
  for each row execute function public.update_updated_at();

-- RLS
alter table public.receipts enable row level security;
alter table public.line_items enable row level security;

-- Workers can read their own receipts; admins can read all
create policy "Workers read own receipts"
  on public.receipts for select
  using (
    worker_id in (select id from public.users where supabase_id = auth.uid())
    or public.is_admin()
  );

-- Authenticated users can create receipts
create policy "Authenticated users can create receipts"
  on public.receipts for insert
  to authenticated
  with check (true);

-- Line items follow receipt access
create policy "Line items follow receipt access"
  on public.line_items for select
  using (
    exists (
      select 1 from public.receipts r
      where r.id = receipt_id
        and (
          r.worker_id in (select id from public.users where supabase_id = auth.uid())
          or public.is_admin()
        )
    )
  );

-- Authenticated users can create line items
create policy "Authenticated users can create line items"
  on public.line_items for insert
  to authenticated
  with check (true);

-- Indexes
create index idx_receipts_worker_id on public.receipts(worker_id);
create index idx_receipts_created_at on public.receipts(created_at desc);
create index idx_line_items_receipt_id on public.line_items(receipt_id);
create index idx_line_items_metal_id on public.line_items(metal_id);
-- Inventory: running totals per metal
create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  metal_id uuid not null unique references public.metals(id),
  metal_name text not null, -- denormalized
  weight numeric(12,2) not null default 0,
  avg_cost_per_lb numeric(10,4) not null default 0,
  updated_at timestamptz not null default now()
);

create trigger inventory_updated_at
  before update on public.inventory
  for each row execute function public.update_updated_at();

-- RLS
alter table public.inventory enable row level security;

-- All authenticated users can read inventory
create policy "All authenticated users can read inventory"
  on public.inventory for select
  to authenticated
  using (true);

-- Only admins can manually adjust inventory
create policy "Admins can update inventory"
  on public.inventory for update
  using (public.is_admin());

-- System can insert inventory rows (via trigger/function)
create policy "System can insert inventory"
  on public.inventory for insert
  to authenticated
  with check (true);

-- Auto-update inventory when a buy receipt line item is created
create or replace function public.update_inventory_on_buy()
returns trigger
language plpgsql
security definer
as $$
declare
  receipt_type text;
  current_weight numeric;
  current_avg_cost numeric;
  new_total_weight numeric;
  new_avg_cost numeric;
begin
  select r.type into receipt_type
    from public.receipts r where r.id = new.receipt_id;

  if receipt_type = 'buy' then
    select i.weight, i.avg_cost_per_lb
      into current_weight, current_avg_cost
      from public.inventory i where i.metal_id = new.metal_id;

    if current_weight is null then
      -- First purchase of this metal
      insert into public.inventory (metal_id, metal_name, weight, avg_cost_per_lb)
      values (new.metal_id, new.metal_name, new.weight, new.price_per_lb);
    else
      -- Weighted average cost
      new_total_weight := current_weight + new.weight;
      new_avg_cost := ((current_weight * current_avg_cost) + (new.weight * new.price_per_lb)) / new_total_weight;
      update public.inventory
        set weight = new_total_weight, avg_cost_per_lb = new_avg_cost, metal_name = new.metal_name
        where metal_id = new.metal_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger line_item_updates_inventory
  after insert on public.line_items
  for each row execute function public.update_inventory_on_buy();
-- Sales: outgoing metal sales with profit tracking
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  metal_id uuid not null references public.metals(id),
  metal_name text not null, -- denormalized
  weight numeric(10,2) not null,
  sale_price_per_lb numeric(10,4) not null,
  cost_basis_per_lb numeric(10,4) not null,
  total_revenue numeric(12,2) not null,
  profit numeric(12,2) not null,
  buyer_name text,
  worker_id uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sales_updated_at
  before update on public.sales
  for each row execute function public.update_updated_at();

-- RLS
alter table public.sales enable row level security;

-- Workers can read their own sales; admins can read all
create policy "Workers read own sales"
  on public.sales for select
  using (
    worker_id in (select id from public.users where supabase_id = auth.uid())
    or public.is_admin()
  );

-- Authenticated users can create sales
create policy "Authenticated users can create sales"
  on public.sales for insert
  to authenticated
  with check (true);

-- Auto-deduct inventory on sale
create or replace function public.update_inventory_on_sale()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.inventory
    set weight = weight - new.weight
    where metal_id = new.metal_id;
  return new;
end;
$$;

create trigger sale_deducts_inventory
  after insert on public.sales
  for each row execute function public.update_inventory_on_sale();

-- Indexes
create index idx_sales_worker_id on public.sales(worker_id);
create index idx_sales_created_at on public.sales(created_at desc);
create index idx_sales_metal_id on public.sales(metal_id);
-- New users start inactive — require admin approval before access
alter table public.users alter column is_active set default false;

-- Update the trigger function to explicitly set is_active = false
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.users (supabase_id, email, name, role, is_active)
  values (new.id, new.email, '', 'worker', false);
  return new;
end;
$$;

-- Admins can approve users (update is_active)
-- (Already covered by "Admins can update users" policy from migration 1)

-- Inactive users can still read their own profile (to check approval status)
-- (Already covered by "Users can read own profile" policy from migration 1)
-- Metal categories for grouping metals (e.g. Copper, Aluminum, Steel)
create table public.metal_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger metal_categories_updated_at
  before update on public.metal_categories
  for each row execute function public.update_updated_at();

-- RLS
alter table public.metal_categories enable row level security;

create policy "All authenticated users can read categories"
  on public.metal_categories for select
  to authenticated
  using (true);

create policy "Admins can insert categories"
  on public.metal_categories for insert
  with check (public.is_admin());

create policy "Admins can update categories"
  on public.metal_categories for update
  using (public.is_admin());

-- Add category_id FK to metals
alter table public.metals
  add column category_id uuid references public.metal_categories(id);

-- Seed categories and assign metals
insert into public.metal_categories (name, display_order) values
  ('Copper', 1),
  ('Aluminum', 2),
  ('Steel', 3),
  ('Brass', 4),
  ('Other', 5);

-- Assign existing metals to categories
update public.metals set category_id = (
  select id from public.metal_categories where name = 'Copper'
) where name = 'Copper';

update public.metals set category_id = (
  select id from public.metal_categories where name = 'Aluminum'
) where name = 'Aluminum';

update public.metals set category_id = (
  select id from public.metal_categories where name = 'Steel'
) where name in ('Steel', 'Stainless Steel');

update public.metals set category_id = (
  select id from public.metal_categories where name = 'Brass'
) where name = 'Brass';

update public.metals set category_id = (
  select id from public.metal_categories where name = 'Other'
) where name in ('Cast Iron', 'Lead', 'Zinc');
-- Add metal grades/sub-types under each category
-- Deactivate the generic top-level metals and replace with specific grades

-- ============================================================
-- Add new categories: Stainless Steel, Lead, Zinc, Nickel, Titanium, Motors/Mixed
-- ============================================================
-- Rename "Other" to something more specific, and add new categories
UPDATE public.metal_categories SET name = 'Motors & Mixed', display_order = 10 WHERE name = 'Other';

INSERT INTO public.metal_categories (name, display_order) VALUES
  ('Stainless Steel', 3),
  ('Lead', 6),
  ('Zinc', 7),
  ('Nickel', 8),
  ('Titanium', 9)
ON CONFLICT (name) DO NOTHING;

-- Reorder existing categories
UPDATE public.metal_categories SET display_order = 1 WHERE name = 'Copper';
UPDATE public.metal_categories SET display_order = 2 WHERE name = 'Aluminum';
UPDATE public.metal_categories SET display_order = 4 WHERE name = 'Steel';
UPDATE public.metal_categories SET display_order = 5 WHERE name = 'Brass';

-- ============================================================
-- Deactivate all generic top-level metals
-- ============================================================
UPDATE public.metals SET is_active = false
WHERE name IN ('Copper', 'Aluminum', 'Steel', 'Brass', 'Cast Iron', 'Lead', 'Zinc');

-- Move Stainless Steel to its own category and deactivate (will be replaced by grades)
UPDATE public.metals SET
  category_id = (SELECT id FROM public.metal_categories WHERE name = 'Stainless Steel'),
  is_active = false
WHERE name = 'Stainless Steel';

-- Move Cast Iron to Steel category
UPDATE public.metals SET
  category_id = (SELECT id FROM public.metal_categories WHERE name = 'Steel')
WHERE name = 'Cast Iron';

-- Move Lead to Lead category
UPDATE public.metals SET
  category_id = (SELECT id FROM public.metal_categories WHERE name = 'Lead')
WHERE name = 'Lead';

-- Move Zinc to Zinc category
UPDATE public.metals SET
  category_id = (SELECT id FROM public.metal_categories WHERE name = 'Zinc')
WHERE name = 'Zinc';

-- ============================================================
-- COPPER grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Bare Bright',          3.80, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('#1 Copper',            3.50, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('#2 Copper',            3.20, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('Copper Tubing / Pipe', 3.30, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('Insulated Copper Wire',2.00, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('Romex Wire',           2.10, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('THHN Wire',            2.20, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('Low-Grade Insulated',  1.20, (SELECT id FROM public.metal_categories WHERE name = 'Copper')),
  ('Burnt Copper Wire',    2.80, (SELECT id FROM public.metal_categories WHERE name = 'Copper'));

-- ============================================================
-- ALUMINUM grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Aluminum Cans (UBC)',     0.45, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Aluminum Wheels / Rims',  0.60, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Clean Aluminum Sheet',    0.50, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Aluminum Extrusions',     0.55, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Painted Aluminum Ext.',   0.45, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Cast Aluminum',           0.40, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Aluminum Siding',         0.42, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Aluminum Radiators',      0.35, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Aluminum Breakage',       0.25, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')),
  ('Dirty Aluminum',          0.15, (SELECT id FROM public.metal_categories WHERE name = 'Aluminum'));

-- ============================================================
-- STAINLESS STEEL grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('304 Stainless Steel',      0.45, (SELECT id FROM public.metal_categories WHERE name = 'Stainless Steel')),
  ('316 Stainless Steel',      0.65, (SELECT id FROM public.metal_categories WHERE name = 'Stainless Steel')),
  ('Mixed Stainless Steel',    0.35, (SELECT id FROM public.metal_categories WHERE name = 'Stainless Steel')),
  ('Stainless Turnings',       0.25, (SELECT id FROM public.metal_categories WHERE name = 'Stainless Steel'));

-- ============================================================
-- STEEL (Ferrous) grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Light Iron / Sheet Iron',  0.05, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('HMS #1',                   0.08, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('HMS #2',                   0.06, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('Prepared Steel',           0.09, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('Unprepared Steel',         0.05, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('Rebar',                    0.07, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('Auto Bodies',              0.04, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('Appliance Steel',          0.05, (SELECT id FROM public.metal_categories WHERE name = 'Steel')),
  ('Steel Turnings',           0.03, (SELECT id FROM public.metal_categories WHERE name = 'Steel'));

-- Reactivate Cast Iron (already exists from initial seed) under Steel
UPDATE public.metals SET
  is_active = true,
  price_per_lb = 0.06,
  category_id = (SELECT id FROM public.metal_categories WHERE name = 'Steel')
WHERE name = 'Cast Iron';

-- ============================================================
-- BRASS grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Yellow Brass',              1.75, (SELECT id FROM public.metal_categories WHERE name = 'Brass')),
  ('Red Brass',                 2.10, (SELECT id FROM public.metal_categories WHERE name = 'Brass')),
  ('Mixed Brass',               1.50, (SELECT id FROM public.metal_categories WHERE name = 'Brass')),
  ('Brass Shell Casings',       1.60, (SELECT id FROM public.metal_categories WHERE name = 'Brass')),
  ('Brass Radiators',           1.30, (SELECT id FROM public.metal_categories WHERE name = 'Brass')),
  ('Brass Faucets / Plumbing',  1.40, (SELECT id FROM public.metal_categories WHERE name = 'Brass'));

-- ============================================================
-- LEAD grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Lead Acid Batteries',  0.20, (SELECT id FROM public.metal_categories WHERE name = 'Lead')),
  ('Soft Lead',             0.50, (SELECT id FROM public.metal_categories WHERE name = 'Lead')),
  ('Wheel Weights',         0.25, (SELECT id FROM public.metal_categories WHERE name = 'Lead')),
  ('Roofing Lead',          0.45, (SELECT id FROM public.metal_categories WHERE name = 'Lead')),
  ('Lead Pipe',             0.40, (SELECT id FROM public.metal_categories WHERE name = 'Lead'));

-- ============================================================
-- ZINC grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Die-Cast Zinc',   0.55, (SELECT id FROM public.metal_categories WHERE name = 'Zinc')),
  ('Zinc Sheet',      0.50, (SELECT id FROM public.metal_categories WHERE name = 'Zinc'));

-- ============================================================
-- NICKEL grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('High-Nickel Alloys',  3.00, (SELECT id FROM public.metal_categories WHERE name = 'Nickel')),
  ('Monel Scrap',          4.50, (SELECT id FROM public.metal_categories WHERE name = 'Nickel'));

-- ============================================================
-- TITANIUM grades
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Titanium Solids',     2.00, (SELECT id FROM public.metal_categories WHERE name = 'Titanium')),
  ('Titanium Turnings',   1.50, (SELECT id FROM public.metal_categories WHERE name = 'Titanium'));

-- ============================================================
-- MOTORS & MIXED items
-- ============================================================
INSERT INTO public.metals (name, price_per_lb, category_id) VALUES
  ('Electric Motors',      0.15, (SELECT id FROM public.metal_categories WHERE name = 'Motors & Mixed')),
  ('Sealed Units (AC)',    0.12, (SELECT id FROM public.metal_categories WHERE name = 'Motors & Mixed')),
  ('Ballasts',             0.08, (SELECT id FROM public.metal_categories WHERE name = 'Motors & Mixed')),
  ('Transformers',         0.10, (SELECT id FROM public.metal_categories WHERE name = 'Motors & Mixed'));
-- One-time access codes for pricing edits
create table public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid not null references public.users(id),
  is_used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.access_codes enable row level security;

-- Only admins can create codes
create policy "Admins can insert access codes"
  on public.access_codes for insert
  with check (public.is_admin());

-- Authenticated users can read codes (to validate them)
create policy "Authenticated users can read access codes"
  on public.access_codes for select
  to authenticated
  using (true);

-- Authenticated users can mark codes as used
create policy "Authenticated users can update access codes"
  on public.access_codes for update
  to authenticated
  using (true);
-- Prevent inventory weight from going negative
alter table public.inventory
  add constraint inventory_weight_non_negative check (weight >= 0);
-- Company settings (one row per installation)
create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default '',
  address text not null default '',
  phone text not null default '',
  logo_url text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

-- Insert a single default row
insert into public.company_settings (company_name) values ('');

-- RLS
alter table public.company_settings enable row level security;

-- Everyone can read company settings
create policy "Anyone can read company settings"
  on public.company_settings for select
  using (true);

-- Only admins can update
create policy "Admins can update company settings"
  on public.company_settings for update
  using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.is_active = true
    )
  );

-- Auto-update timestamp
create or replace function public.update_company_settings_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_company_settings_timestamp
  before update on public.company_settings
  for each row
  execute function public.update_company_settings_timestamp();

-- Storage bucket for company logos
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;

-- Anyone authenticated can upload to company-logos (admin check in app layer)
create policy "Authenticated users can upload logos"
  on storage.objects for insert
  with check (bucket_id = 'company-logos' and auth.role() = 'authenticated');

create policy "Anyone can read logos"
  on storage.objects for select
  using (bucket_id = 'company-logos');

create policy "Authenticated users can update logos"
  on storage.objects for update
  using (bucket_id = 'company-logos' and auth.role() = 'authenticated');
