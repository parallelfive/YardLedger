-- Auto-create a company_settings row when a new company is inserted.
--
-- Without this, freshly bootstrapped companies (e.g. Gorilla Recycling)
-- have no company_settings row, so CompanyProfileScreen and any place
-- that reads company_settings.company_name shows blanks. Seed it from
-- the company's name so the owner sees their company filled in
-- immediately after sign-up.
--
-- Also backfills existing companies that don't have a settings row yet
-- (the Legacy company already has one from migration 20260311000002,
-- but anything bootstrapped via SQL since multi-tenancy landed won't).

create or replace function public.seed_company_settings()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.company_settings (company_id, company_name)
  values (new.id, new.name)
  on conflict (company_id) do nothing;
  return new;
end;
$$;

create trigger company_seed_settings
  after insert on public.companies
  for each row execute function public.seed_company_settings();

-- Backfill any companies that don't yet have a settings row.
insert into public.company_settings (company_id, company_name)
  select c.id, c.name
    from public.companies c
    left join public.company_settings cs on cs.company_id = c.id
    where cs.company_id is null;
