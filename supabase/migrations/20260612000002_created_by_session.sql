-- Tamper-evident authorship on buys and sales.
--
-- worker_id is the *attributed* staffer (chosen via PIN at the counter), and
-- since the shared-terminal model lets a buy be attributed to any colleague in
-- the company, worker_id alone can be forged client-side. Add an independent
-- created_by_session that records WHICH Supabase session actually wrote the
-- row — set server-side from auth.uid(), never from client input, and frozen
-- on receipts. This makes mis-attribution detectable on the legal record even
-- though attribution itself stays flexible.

alter table public.receipts
  add column if not exists created_by_session uuid references public.users(id);
alter table public.sales
  add column if not exists created_by_session uuid references public.users(id);

-- Stamp the creating session on insert, overriding anything the client sent.
create or replace function public.stamp_created_by_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by_session :=
    (select id from public.users where supabase_id = auth.uid());
  return new;
end;
$$;

drop trigger if exists receipts_stamp_session on public.receipts;
create trigger receipts_stamp_session
  before insert on public.receipts
  for each row execute function public.stamp_created_by_session();

drop trigger if exists sales_stamp_session on public.sales;
create trigger sales_stamp_session
  before insert on public.sales
  for each row execute function public.stamp_created_by_session();

-- Freeze created_by_session on receipts (companion to enforce_receipt_immutability,
-- which predates this column). Kept as its own guard so we don't have to
-- re-declare that large function.
create or replace function public.enforce_created_by_session_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by_session is distinct from old.created_by_session then
    raise exception 'created_by_session is immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists receipts_freeze_session on public.receipts;
create trigger receipts_freeze_session
  before update on public.receipts
  for each row execute function public.enforce_created_by_session_immutable();
