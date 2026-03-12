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
