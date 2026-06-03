-- Hardening from the second security sweep:
--
--   1. company-logos storage bucket: write policies gated only on bucket_id
--      + auth.role(), and the client uploads a flat `logo_${ts}.jpg` with
--      upsert — so any tenant can overwrite any other company's logo. Scope
--      to a per-company folder (mirrors the customer-ids fix in mig. 13).
--
--   2. Price overrides were enforced CLIENT-SIDE ONLY. The line_items insert
--      policy checked company/receipt ownership but never that an override
--      was authorized, so a crafted insert could set any price with
--      is_price_override=false and no audit. Make price authoritative on the
--      server and require a recently-consumed approval code (or admin) for
--      any deviation from the metal's market price.
--
--   3. Access codes were 4 digits (10k space) with no throttling on
--      validate_access_code → brute-forceable in seconds. Widen to 6 digits
--      and add per-user attempt lockout.

-- ---- 1. company-logos: scope writes by company folder ------------------
drop policy if exists "Authenticated users can upload logos" on storage.objects;
drop policy if exists "Authenticated users can update logos" on storage.objects;

create policy "Company members can upload their logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "Company members can update their logo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  )
  with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

-- ---- 2. Server-authoritative line-item pricing -------------------------
create or replace function public.enforce_line_item_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_market      numeric(10,4);
  v_uid         uuid;
  v_recent_code boolean;
begin
  select price_per_lb into v_market
    from public.metals
    where id = new.metal_id
      and company_id = coalesce(new.company_id, public.current_company_id());

  if v_market is null then
    raise exception 'Unknown metal % for this company', new.metal_id;
  end if;

  select id into v_uid from public.users where supabase_id = auth.uid();

  -- Never trust client-supplied "original" price, override flag, or total.
  new.original_price_per_lb := v_market;
  new.is_price_override := (new.price_per_lb is distinct from v_market);
  new.total := round(new.weight * new.price_per_lb, 2);

  if new.is_price_override then
    -- Admins/owners may always override; everyone else needs an approval
    -- code consumed for this company within the last 15 minutes.
    if not public.is_admin() then
      select exists (
        select 1 from public.access_codes
        where company_id = coalesce(new.company_id, public.current_company_id())
          and used_by = v_uid
          and is_used = true
          and used_at > now() - interval '15 minutes'
      ) into v_recent_code;

      if not coalesce(v_recent_code, false) then
        raise exception
          'Price override requires a valid approval code (none consumed recently).';
      end if;
    end if;

    if new.override_approved_by is null then
      new.override_approved_by := v_uid::text;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_line_item_pricing on public.line_items;
create trigger trg_line_item_pricing
  before insert on public.line_items
  for each row execute function public.enforce_line_item_pricing();

-- ---- 3. Access code lockout + wider codes ------------------------------
create table if not exists public.access_code_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id),
  company_id uuid,
  succeeded boolean not null,
  created_at timestamptz not null default now()
);
-- Only the SECURITY DEFINER validate function touches this table.
alter table public.access_code_attempts enable row level security;

-- Widen generated codes from 4 to 6 digits (10k -> 1M space). 3 random
-- bytes give 0..16.7M; mod 1e6 yields a 6-digit code.
create or replace function public.create_access_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  current_user_id uuid;
  caller_company_id uuid;
  bytes bytea;
  num int;
  max_attempts int := 10;
  attempt int := 0;
begin
  if not public.is_admin() then
    raise exception 'Only admins can create access codes';
  end if;

  select id, company_id into current_user_id, caller_company_id
    from public.users
    where supabase_id = auth.uid();

  loop
    attempt := attempt + 1;
    bytes := extensions.gen_random_bytes(3);
    num := get_byte(bytes, 0) * 65536 + get_byte(bytes, 1) * 256 + get_byte(bytes, 2);
    new_code := lpad((num % 1000000)::text, 6, '0');

    begin
      insert into public.access_codes (code, created_by, company_id)
        values (new_code, current_user_id, caller_company_id);
      return new_code;
    exception when unique_violation then
      if attempt >= max_attempts then
        raise exception 'Unable to generate unique access code after % attempts', max_attempts;
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.validate_access_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  code_id uuid;
  current_user_id uuid;
  recent_failures int;
begin
  select id into current_user_id
    from public.users
    where supabase_id = auth.uid();

  -- Lockout: >= 10 failed attempts in the last 15 minutes.
  select count(*) into recent_failures
    from public.access_code_attempts
    where user_id = current_user_id
      and succeeded = false
      and created_at > now() - interval '15 minutes';

  if recent_failures >= 10 then
    raise exception 'Too many invalid code attempts; try again later.';
  end if;

  select id into code_id
    from public.access_codes
    where code = p_code
      and is_used = false
      and company_id = public.current_company_id()
    limit 1;

  if code_id is null then
    insert into public.access_code_attempts (user_id, company_id, succeeded)
      values (current_user_id, public.current_company_id(), false);
    return false;
  end if;

  update public.access_codes
    set is_used = true,
        used_at = now(),
        used_by = current_user_id
    where id = code_id
      and company_id = public.current_company_id();

  insert into public.access_code_attempts (user_id, company_id, succeeded)
    values (current_user_id, public.current_company_id(), true);

  return true;
end;
$$;
