-- Harden PIN brute-force protection.
--
-- The original validate_pin() deleted the WHOLE company's failed-attempt
-- ledger on any successful PIN. Because every staffer knows at least their own
-- PIN, that let an insider refill the failure budget at will:
--   4 wrong guesses at a colleague's PIN → 1 correct self-PIN (wipes the ledger)
--   → 4 more guesses → … → unbounded search of the 4-digit (10k) space.
--
-- Fix: never clear the ledger on success. Failed attempts simply age out of
-- the rolling 15-minute window, so the 5-per-15-min cap can't be reset. A
-- successful sign-in no longer touches pin_attempts at all.

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

  -- Success: do NOT clear the failure ledger — recent failures must keep
  -- counting toward the lockout so the budget can't be refilled on demand.
  -- Stale rows fall out of the 15-minute window on their own.
  return query select v_id, v_name, v_role;
end;
$$;

revoke all on function public.validate_pin(text) from public;
grant execute on function public.validate_pin(text) to authenticated;
