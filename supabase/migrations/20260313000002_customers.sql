-- Customers table: track repeat visitors
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.update_updated_at();

-- Add customer_id FK to receipts (nullable — existing receipts don't have it)
alter table public.receipts
  add column customer_id uuid references public.customers(id);

-- Indexes
create index idx_customers_name on public.customers(name);
create index idx_receipts_customer_id on public.receipts(customer_id);

-- RLS
alter table public.customers enable row level security;

-- All authenticated users can read customers
create policy "Authenticated users can read customers"
  on public.customers for select
  to authenticated
  using (true);

-- All authenticated users can insert customers
create policy "Authenticated users can insert customers"
  on public.customers for insert
  to authenticated
  with check (true);

-- All authenticated users can update customers
create policy "Authenticated users can update customers"
  on public.customers for update
  to authenticated
  using (true);
