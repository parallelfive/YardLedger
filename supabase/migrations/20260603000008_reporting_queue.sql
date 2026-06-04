-- Foundation for state/LeadsOnline reporting (NM 57-30-8: upload each purchase
-- by the 2nd business day). NM's database is reached via LeadsOnline; there is
-- no public API, so the actual transmit (a scheduled server-side SFTP batch)
-- is added once LeadsOnline issues a per-company file spec + credentials.
--
-- This migration is the provider-agnostic substrate: track what's been
-- reported, log upload runs, and store the dealer's registration number. It
-- immediately supports the manual LeadsOnline workflow (export the unreported
-- set, upload, mark sent) and is exactly what the automated job will reuse.

-- What's been reported. (Not listed in enforce_receipt_immutability, so it is
-- freely settable post-insert.)
alter table public.receipts
  add column if not exists reported_at timestamptz;

-- Fast lookup of the unreported buy queue per company.
create index if not exists idx_receipts_unreported
  on public.receipts (company_id)
  where reported_at is null;

-- Dealer's NMRLD registration number (and the LeadsOnline account is created
-- per business during onboarding).
alter table public.company_settings
  add column if not exists nmrld_registration_number text not null default '';

-- Audit log of reporting runs (manual or automated).
create table if not exists public.compliance_upload_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id(),
  method text not null default 'manual',
  receipt_count int not null default 0,
  status text not null default 'success',
  detail text,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.compliance_upload_log enable row level security;

create policy "Members read their company upload log"
  on public.compliance_upload_log for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Members log uploads for their company"
  on public.compliance_upload_log for insert
  to authenticated
  with check (company_id = public.current_company_id());
