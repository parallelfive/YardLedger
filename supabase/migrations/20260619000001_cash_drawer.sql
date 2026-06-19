-- Day-end cash reconciliation ("the till").
--
-- A scrap yard's drawer is driven by cash PAID OUT to sellers on buys. An
-- operator opens the drawer with a starting float, cash buys draw it down
-- through the day, and at close they count the physical cash; the variance
-- (counted − expected) flags an over/short. Sales aren't counted here — they
-- carry no payment method and scrap sales to processors are typically by
-- check/wire (cash-in can be added later).
--
-- Open/close go through SECURITY DEFINER RPCs so "expected" is computed from the
-- receipts on the server (not trusted from the client). Operational, so any
-- staffer in the company can run it; opened_by/closed_by record who.

create table if not exists public.cash_drawer_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id()
    references public.companies(id) on delete cascade,
  opened_at timestamptz not null default now(),
  opened_by uuid references public.users(id),
  opening_float numeric(12, 2) not null default 0,
  closed_at timestamptz,
  closed_by uuid references public.users(id),
  cash_paid_out numeric(12, 2), -- cash buys during the session (set at close)
  expected_cash numeric(12, 2), -- opening_float − cash_paid_out
  counted_cash numeric(12, 2), -- operator's physical count
  variance numeric(12, 2), -- counted − expected (negative = short)
  note text not null default '',
  created_at timestamptz not null default now()
);

-- At most one open drawer per company.
create unique index if not exists cash_drawer_one_open_per_company
  on public.cash_drawer_sessions (company_id)
  where closed_at is null;

create index if not exists cash_drawer_company_time_idx
  on public.cash_drawer_sessions (company_id, opened_at desc);

alter table public.cash_drawer_sessions enable row level security;

-- Reads: any staffer in the company. Writes happen only via the RPCs below.
create policy "Staff read cash drawer in their company"
  on public.cash_drawer_sessions for select
  to authenticated
  using (company_id = public.current_company_id());

-- ── open ─────────────────────────────────────────────────────────────────────
create or replace function public.open_cash_drawer(
  p_opening_float numeric,
  p_worker_id uuid
)
returns public.cash_drawer_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.cash_drawer_sessions;
begin
  if not exists (
    select 1 from public.users
    where id = p_worker_id and company_id = public.current_company_id()
  ) then
    raise exception 'worker must be a member of the current company';
  end if;

  insert into public.cash_drawer_sessions (opening_float, opened_by)
    values (coalesce(p_opening_float, 0), p_worker_id)
    returning * into v;
  return v;
exception when unique_violation then
  raise exception 'A cash drawer is already open for this company';
end;
$$;

revoke all on function public.open_cash_drawer(numeric, uuid) from public;
grant execute on function public.open_cash_drawer(numeric, uuid) to authenticated;

-- ── close (computes expected from cash buys since the drawer opened) ──────────
create or replace function public.close_cash_drawer(
  p_session_id uuid,
  p_counted_cash numeric,
  p_worker_id uuid,
  p_note text default ''
)
returns public.cash_drawer_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.cash_drawer_sessions;
  v_company uuid := public.current_company_id();
  v_paid_out numeric(12, 2);
  v_expected numeric(12, 2);
begin
  if not exists (
    select 1 from public.users
    where id = p_worker_id and company_id = v_company
  ) then
    raise exception 'worker must be a member of the current company';
  end if;

  select * into v from public.cash_drawer_sessions
    where id = p_session_id and company_id = v_company and closed_at is null;
  if v.id is null then
    raise exception 'No open drawer session to close';
  end if;

  select coalesce(sum(subtotal), 0) into v_paid_out
    from public.receipts
    where company_id = v_company
      and type = 'buy'
      and payment_method = 'cash'
      and created_at >= v.opened_at;

  v_expected := v.opening_float - v_paid_out;

  update public.cash_drawer_sessions
    set closed_at = now(),
        closed_by = p_worker_id,
        cash_paid_out = v_paid_out,
        expected_cash = v_expected,
        counted_cash = coalesce(p_counted_cash, 0),
        variance = coalesce(p_counted_cash, 0) - v_expected,
        note = coalesce(p_note, '')
    where id = p_session_id
    returning * into v;
  return v;
end;
$$;

revoke all on function public.close_cash_drawer(uuid, numeric, uuid, text) from public;
grant execute on function public.close_cash_drawer(uuid, numeric, uuid, text) to authenticated;

-- ── current open drawer with live (uncommitted) paid-out + expected ──────────
create or replace function public.current_cash_drawer()
returns table (
  id uuid,
  opened_at timestamptz,
  opening_float numeric,
  cash_paid_out numeric,
  expected_cash numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    s.id,
    s.opened_at,
    s.opening_float,
    coalesce((
      select sum(r.subtotal) from public.receipts r
      where r.company_id = s.company_id
        and r.type = 'buy'
        and r.payment_method = 'cash'
        and r.created_at >= s.opened_at
    ), 0) as cash_paid_out,
    s.opening_float - coalesce((
      select sum(r.subtotal) from public.receipts r
      where r.company_id = s.company_id
        and r.type = 'buy'
        and r.payment_method = 'cash'
        and r.created_at >= s.opened_at
    ), 0) as expected_cash
  from public.cash_drawer_sessions s
  where s.company_id = public.current_company_id()
    and s.closed_at is null
  limit 1;
$$;

revoke all on function public.current_cash_drawer() from public;
grant execute on function public.current_cash_drawer() to authenticated;
