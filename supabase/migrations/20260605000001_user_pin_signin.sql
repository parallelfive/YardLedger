-- Per-shift PIN sign-in for the shared "Tare" counter terminal.
--
-- Model: the device holds a company-scoped Supabase session; staff PIN-in to
-- select the attributed in-app identity for their shift. Each user has an
-- optional bcrypt PIN hash. PINs are 4 digits, UNIQUE within a company (so a
-- PIN actually identifies one person), and the pad locks out after 5 wrong
-- tries in 15 minutes. The plaintext PIN is never stored or returned.

create extension if not exists pgcrypto with schema extensions;

alter table public.users
  add column if not exists pin_hash text;

-- Failed-attempt ledger for per-company lockout (mirrors access_code_attempts).
create table if not exists public.pin_attempts (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index if not exists pin_attempts_company_time_idx
  on public.pin_attempts (company_id, attempted_at);

-- RLS on, NO client policies — only the SECURITY DEFINER RPCs below touch it.
alter table public.pin_attempts enable row level security;

-- ── Set/replace the CURRENT user's PIN ───────────────────────────────────────
-- 4 digits, and unique among the company's staff so it's identifying.
create or replace function public.set_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_company uuid;
  v_clash int;
begin
  select id, company_id into v_uid, v_company
    from public.users where supabase_id = auth.uid();
  if v_uid is null then
    raise exception 'No user in context';
  end if;
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  -- Reject a PIN already in use by another staff member in this company.
  select count(*) into v_clash
    from public.users u
    where u.company_id = v_company
      and u.id <> v_uid
      and u.pin_hash is not null
      and u.pin_hash = extensions.crypt(p_pin, u.pin_hash);
  if v_clash > 0 then
    raise exception 'That PIN is already in use — choose another';
  end if;

  update public.users
    set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_uid;
end;
$$;

revoke all on function public.set_pin(text) from public;
grant execute on function public.set_pin(text) to authenticated;

-- ── Validate a PIN for this device's company → attributed identity ───────────
-- Returns the matched active user, or raises. Locks out after 5 fails / 15 min.
create or replace function public.validate_pin(p_pin text)
returns table (user_id uuid, name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid;
  v_fails int;
  v_id uuid;
  v_name text;
  v_role text;
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

  select u.id, u.name, u.role
    into v_id, v_name, v_role
    from public.users u
    where u.company_id = v_company
      and u.is_active
      and u.pin_hash is not null
      and u.pin_hash = extensions.crypt(p_pin, u.pin_hash)
    limit 1;

  if v_id is null then
    insert into public.pin_attempts (company_id) values (v_company);
    raise exception 'Wrong passcode';
  end if;

  -- Success — clear the company's recent failures.
  delete from public.pin_attempts where company_id = v_company;
  return query select v_id, v_name, v_role;
end;
$$;

revoke all on function public.validate_pin(text) from public;
grant execute on function public.validate_pin(text) to authenticated;
