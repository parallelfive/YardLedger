-- Role enforcement, part 1: admin authorization primitives.
--
-- The app is a shared counter terminal: one device session anchors the company,
-- and staff identify themselves by PIN. But every privileged DB check
-- (is_admin/is_owner) reads the SESSION user (auth.uid()), not the PIN'd-in
-- person — so whoever the terminal is signed in as sets the privilege ceiling,
-- and any worker who PINs in inherits the session's admin rights.
--
-- Fix (this migration adds the primitives; 20260618000003 swaps enforcement onto
-- them): an admin proves their identity with their PIN to open a short
-- "elevation window" for the company. Privileged writes are then gated on an
-- active window instead of on session role. The window is minted only by a real
-- admin/owner PIN, auto-expires, and a worker can't open one.
--
-- These are pure additions — no existing behavior changes until 003.

-- ── assert_admin_pin: verify a PIN belongs to an active admin/owner ──────────
-- Mirrors validate_pin's lockout (20260612000001): shares the pin_attempts
-- ledger and the 5-fails / rolling-15-min cap, and NEVER clears the ledger on
-- success (anti-refill). Raises on a bad/insufficient PIN; returns the user id.
create or replace function public.assert_admin_pin(
  p_pin text,
  p_require_owner boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_fails int;
  v_id uuid;
begin
  v_company := public.current_company_id();
  if v_company is null then
    raise exception 'No company context';
  end if;

  select count(*) into v_fails
    from public.pin_attempts
    where company_id = v_company
      and attempted_at > now() - interval '15 minutes';
  if v_fails >= 5 then
    raise exception 'Too many attempts — locked out. Try again in a few minutes.';
  end if;

  select u.id
    into v_id
    from public.users u
    where u.company_id = v_company
      and u.is_active
      and u.pin_hash is not null
      and u.pin_hash = extensions.crypt(p_pin, u.pin_hash)
      and case
            when p_require_owner then u.role = 'owner'
            else u.role in ('admin', 'owner')
          end
    limit 1;

  if v_id is null then
    -- Generic error: don't reveal wrong-PIN vs. PIN-belongs-to-a-worker.
    insert into public.pin_attempts (company_id) values (v_company);
    raise exception 'Wrong admin passcode';
  end if;

  -- Success: do NOT clear pin_attempts (same anti-refill rule as validate_pin).
  return v_id;
end;
$$;

revoke all on function public.assert_admin_pin(text, boolean) from public;
grant execute on function public.assert_admin_pin(text, boolean) to authenticated;

-- ── admin_action_log: who did privileged things, attributed to the PIN'd admin ─
create table if not exists public.admin_action_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  action text not null,
  target_table text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_action_log_company_time_idx
  on public.admin_action_log (company_id, created_at desc);

alter table public.admin_action_log enable row level security;

-- Readable by admins in the company (read isn't the vulnerability); inserts only
-- happen through SECURITY DEFINER functions/triggers below (no client insert).
create policy "Admins read admin action log in their company"
  on public.admin_action_log for select
  to authenticated
  using (public.is_admin() and company_id = public.current_company_id());

-- ── admin_elevations: short-lived per-company authorization windows ──────────
create table if not exists public.admin_elevations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.users(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  require_owner boolean not null default false
);

create index if not exists admin_elevations_company_exp_idx
  on public.admin_elevations (company_id, expires_at);

-- RLS on, NO client policies — only the SECURITY DEFINER functions below touch
-- it (same pattern as pin_attempts). A window can never be forged from a query.
alter table public.admin_elevations enable row level security;

-- ── admin_elevate: open a 5-minute window after a valid admin PIN ────────────
create or replace function public.admin_elevate(
  p_pin text,
  p_owner boolean default false
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
  v_uid uuid;
  v_expires timestamptz;
begin
  v_uid := public.assert_admin_pin(p_pin, p_owner); -- raises if not authorized

  -- Garbage-collect expired windows for this company; keep any still-valid ones
  -- (e.g. an owner window that also satisfies admin-grade checks).
  delete from public.admin_elevations
    where company_id = v_company and expires_at <= now();

  v_expires := now() + interval '5 minutes';
  insert into public.admin_elevations (company_id, user_id, expires_at, require_owner)
    values (v_company, v_uid, v_expires, p_owner);

  insert into public.admin_action_log (company_id, actor_user_id, action, detail)
    values (v_company, v_uid, 'elevate',
            jsonb_build_object('require_owner', p_owner, 'expires_at', v_expires));

  return v_expires;
end;
$$;

revoke all on function public.admin_elevate(text, boolean) from public;
grant execute on function public.admin_elevate(text, boolean) to authenticated;

-- ── has_admin_elevation: is there an active window for the caller's company? ──
-- Keyed to the company (not the session user — the session is the shared
-- terminal). An owner window (require_owner=true) satisfies both grades.
create or replace function public.has_admin_elevation(
  p_require_owner boolean default false
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admin_elevations
    where company_id = public.current_company_id()
      and expires_at > now()
      and (not p_require_owner or require_owner)
  );
$$;

revoke all on function public.has_admin_elevation(boolean) from public;
grant execute on function public.has_admin_elevation(boolean) to authenticated;

-- ── stamp_admin_action: attribute a privileged row change to the active admin ─
-- AFTER trigger for high-value config tables (003 attaches it). Attributes the
-- change to whichever admin currently holds an active elevation window.
create or replace function public.stamp_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.current_company_id();
  v_actor uuid;
begin
  select user_id into v_actor
    from public.admin_elevations
    where company_id = v_company and expires_at > now()
    order by granted_at desc
    limit 1;

  insert into public.admin_action_log
    (company_id, actor_user_id, action, target_table, target_id)
  values
    (v_company, v_actor, lower(tg_op), tg_table_name,
     case tg_op when 'DELETE' then old.id else new.id end);

  return null; -- AFTER trigger; return value ignored
end;
$$;
