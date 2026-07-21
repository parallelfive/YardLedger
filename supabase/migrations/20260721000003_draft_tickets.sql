-- Scale-ticket handoff: a worker weighs the material and "sends to cashier"; the
-- cashier collects seller ID / photos / signature / payment and finalizes the
-- payout. A single operator can also flow straight through (no draft).
--
-- A draft_ticket holds ONLY the worker's half (materials + weights). It never
-- touches inventory, receipt numbering, reporting, or the immutability guard —
-- those all fire only when the cashier finalizes through the existing
-- create_receipt_with_items RPC. So the verified compliance/receipt path is
-- untouched; this is a lightweight staging layer in front of it.
--
-- Rows persist after finalize (status flips to 'finalized' + receipt_id link)
-- for audit AND so the daily claim number never reuses a value mid-day.

create table if not exists public.draft_tickets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id()
    references public.companies(id) on delete cascade,
  claim_number text not null default '',       -- daily scale-ticket #, e.g. 'T-42'
  worker_id uuid references public.users(id),   -- who weighed it
  seller_name text not null default '',         -- optional, if captured at the scale
  line_items jsonb not null default '[]'::jsonb, -- worker's materials + weights + pricing
  subtotal numeric(12, 2) not null default 0,
  weight numeric(12, 2) not null default 0,     -- total net lb (for the queue/stub)
  status text not null default 'pending'
    check (status in ('pending', 'finalized', 'voided')),
  receipt_id uuid references public.receipts(id), -- set when finalized (audit link)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists draft_tickets_company_status_idx
  on public.draft_tickets (company_id, status, created_at desc);

-- Daily per-company scale-ticket number: T-1, T-2, … resetting each day. Rows
-- persist through the day (finalized, not deleted), so count()+1 never reuses a
-- number. Best-effort under simultaneous inserts (fine for a counter); the id is
-- the true key.
create or replace function public.set_draft_claim_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if new.claim_number is null or new.claim_number = '' then
    select count(*) + 1 into n
      from public.draft_tickets
      where company_id = new.company_id
        and created_at::date = current_date;
    new.claim_number := 'T-' || n;
  end if;
  return new;
end;
$$;

drop trigger if exists draft_tickets_claim_number on public.draft_tickets;
create trigger draft_tickets_claim_number
  before insert on public.draft_tickets
  for each row execute function public.set_draft_claim_number();

alter table public.draft_tickets enable row level security;

-- Operational data — any staffer in the company can create/read/update/delete
-- their yard's drafts (no admin gate). Scoped to the caller's company via RLS.
create policy "Staff read draft tickets in their company"
  on public.draft_tickets for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Staff create draft tickets in their company"
  on public.draft_tickets for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "Staff update draft tickets in their company"
  on public.draft_tickets for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "Staff delete draft tickets in their company"
  on public.draft_tickets for delete
  to authenticated
  using (company_id = public.current_company_id());
