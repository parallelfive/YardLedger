-- Harden the scale-ticket (draft_tickets) staging layer against three issues:
--   #112 concurrent inserts can assign duplicate daily claim numbers
--   #113 finalized/voided tickets remain freely mutable/deletable by any staffer
--   #114 drafts accept spoofed worker attribution + unvalidated financials
--
-- draft_tickets is a lightweight pre-cashier stub — no money/inventory moves
-- until the cashier finalizes through create_receipt_with_items, which already
-- re-validates pricing/subtotal/worker membership on the LEGAL receipt. These
-- guards close the staging-layer gaps (attribution, audit integrity, races)
-- without duplicating that heavy path. All functions follow the repo convention
-- (security definer + pinned search_path).

-- ── #114a: tamper-evident authorship ──────────────────────────────────────
-- worker_id is the attributed staffer (chosen by PIN) and is client-supplied,
-- so it can be forged. Record WHICH session actually wrote the row, server-side
-- from auth.uid(), mirroring receipts/sales (20260612000002). Reuse that same
-- stamp function.
alter table public.draft_tickets
  add column if not exists created_by_session uuid references public.users(id);

drop trigger if exists draft_tickets_stamp_session on public.draft_tickets;
create trigger draft_tickets_stamp_session
  before insert on public.draft_tickets
  for each row execute function public.stamp_created_by_session();

-- ── #112: race-free daily claim number ────────────────────────────────────
-- The old body used count(*)+1 with no locking, so two simultaneous inserts
-- both produced e.g. 'T-42'. Serialize per (company, day) with an advisory
-- xact lock and take max(trailing digits)+1 — the exact pattern receipt
-- numbering uses (20260422000006). max() over the digit run (not count) also
-- means a deleted pending draft never causes reuse.

-- The daily uniqueness index below needs an IMMUTABLE key, but timestamptz::date
-- is only STABLE (session-timezone dependent) and Postgres rejects it in an index
-- expression. Store the session-tz calendar day the trigger stamps next to the
-- claim number so the two always agree, and index that plain column instead.
alter table public.draft_tickets
  add column if not exists created_day date;

create or replace function public.set_draft_claim_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  lock_key bigint;
begin
  -- Stamp the calendar day this ticket belongs to (session tz), matching the day
  -- the claim number resets on, so the daily unique index can key on it.
  new.created_day := current_date;
  if new.claim_number is null or new.claim_number = '' then
    lock_key := hashtext(new.company_id::text || '-' || to_char(now(), 'YYYYMMDD'));
    perform pg_advisory_xact_lock(lock_key);
    select coalesce(max(substring(claim_number from '([0-9]+)$')::int), 0) + 1
      into n
      from public.draft_tickets
      where company_id = new.company_id
        and created_at::date = current_date;
    new.claim_number := 'T-' || n;
  end if;
  return new;
end;
$$;

-- Backfill created_day for rows that predate the column so the index covers them
-- (best-effort: the session-tz date of their created_at).
update public.draft_tickets
  set created_day = created_at::date
  where created_day is null;

-- Belt-and-suspenders: a per-company/day unique claim number, keyed on the stored
-- created_day (a plain column — IMMUTABLE, unlike created_at::date). Guarded so
-- the migration never fails on legacy duplicates the old racy trigger may have
-- left (the advisory lock above already prevents new collisions).
do $$
begin
  if exists (
    select 1
    from public.draft_tickets
    where claim_number <> ''
    group by company_id, created_day, claim_number
    having count(*) > 1
  ) then
    raise notice 'draft_tickets: legacy duplicate claim numbers present; skipping unique index (advisory lock still prevents new races)';
  else
    create unique index if not exists draft_tickets_company_day_claim_uidx
      on public.draft_tickets (company_id, created_day, claim_number)
      where claim_number <> '';
  end if;
end $$;

-- ── #114b: reject negative financial payloads (INSERT and UPDATE) ──────────
-- Full recompute of the jsonb line_items is deferred to finalize (the trusted
-- RPC re-derives every total). Here we only reject nonsensical values a client
-- could stuff into the queue stub.
create or replace function public.validate_draft_ticket_financials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.subtotal < 0 then
    raise exception 'draft ticket subtotal cannot be negative';
  end if;
  if new.weight < 0 then
    raise exception 'draft ticket weight cannot be negative';
  end if;
  return new;
end;
$$;

drop trigger if exists draft_tickets_validate_financials on public.draft_tickets;
create trigger draft_tickets_validate_financials
  before insert or update on public.draft_tickets
  for each row execute function public.validate_draft_ticket_financials();

-- ── #113: terminal-state immutability + frozen identity columns ────────────
-- Once a ticket is finalized (an audit link to a legal receipt) or voided it is
-- frozen; before that, only pending → finalized/voided transitions are allowed.
-- Identity/audit columns never change, and the receipt link is write-once.
-- Mirrors enforce_receipt_immutability (20260603000006).
create or replace function public.enforce_draft_ticket_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('finalized', 'voided') then
    raise exception 'draft ticket % is % and cannot be modified', old.id, old.status;
  end if;
  if new.status not in ('pending', 'finalized', 'voided') then
    raise exception 'invalid draft ticket status: %', new.status;
  end if;
  if new.company_id is distinct from old.company_id
     or new.claim_number is distinct from old.claim_number
     or new.worker_id is distinct from old.worker_id
     or new.created_by_session is distinct from old.created_by_session
     or new.created_at is distinct from old.created_at then
    raise exception 'draft ticket identity columns are immutable';
  end if;
  if old.receipt_id is not null and new.receipt_id is distinct from old.receipt_id then
    raise exception 'draft ticket receipt link is immutable once set';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists draft_tickets_immutable on public.draft_tickets;
create trigger draft_tickets_immutable
  before update on public.draft_tickets
  for each row execute function public.enforce_draft_ticket_immutable();

-- ── #114c: constrain who a draft can be attributed to ─────────────────────
-- The old INSERT policy checked only company_id, so a client could attribute a
-- draft to ANY uuid (another tenant's user, or a nonexistent one). Require
-- worker_id to be a user in the caller's company — mirror receipts
-- (20260605000002). worker_id stays nullable (scale ticket before PIN).
drop policy if exists "Staff create draft tickets in their company" on public.draft_tickets;
create policy "Staff create draft tickets in their company"
  on public.draft_tickets for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and (
      worker_id is null
      or worker_id in (
        select id from public.users where company_id = public.current_company_id()
      )
    )
  );

-- ── #113b: don't let finalized/voided audit rows be hard-deleted ──────────
-- Only pending drafts are disposable; terminal rows are the audit trail.
drop policy if exists "Staff delete draft tickets in their company" on public.draft_tickets;
create policy "Staff delete pending draft tickets in their company"
  on public.draft_tickets for delete
  to authenticated
  using (
    company_id = public.current_company_id()
    and status = 'pending'
  );
