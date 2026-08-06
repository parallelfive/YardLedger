-- Make the PIN lockout actually trip (#142).
--
-- validate_pin / assert_admin_pin recorded a failed attempt and then RAISED in
-- the same statement:
--     insert into pin_attempts ...;
--     raise exception 'Wrong passcode';
-- The RAISE aborts the calling transaction, which rolls back the INSERT on the
-- line above it — so pin_attempts stayed permanently EMPTY, the 5-fails/15-min
-- count was always 0, and the lockout never fired. (This is why the guard code
-- "looks right but never runs": the ledger it counts is never fed.)
--
-- Fix: on a wrong PIN, record the attempt and SIGNAL FAILURE BY RETURNING
-- (empty set / null) instead of raising, so the INSERT commits. The lockout and
-- no-context paths keep raising — they persist nothing, so the rollback is
-- harmless there. The outermost RPC must be the one that returns (a raise at any
-- level aborts the whole transaction), so admin_elevate — not assert_admin_pin —
-- is where the admin path resolves the failure.

-- ── validate_pin: return an empty result on a wrong PIN ───────────────────────
-- Its only caller (services/pin.ts) already treats zero rows as 'Wrong passcode',
-- so this needs no client change.
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
    -- Record the failure and RETURN empty (no raise) so the insert survives.
    insert into public.pin_attempts (company_id) values (v_company);
    return;
  end if;

  -- Success: do NOT clear the failure ledger (anti-refill, see 20260612000001).
  return query select v_id, v_name, v_role;
end;
$$;

revoke all on function public.validate_pin(text) from public;
grant execute on function public.validate_pin(text) to authenticated;

-- ── assert_admin_pin: return null on a wrong PIN (don't raise) ─────────────────
-- Returning null (instead of raising) lets the pin_attempts insert commit. Its
-- ONLY caller is admin_elevate, updated below to treat null as failure. The
-- lockout path still raises (nothing to persist there).
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
    -- Record the failure and RETURN NULL (no raise) so the insert survives.
    -- admin_elevate turns this null into the user-facing failure.
    insert into public.pin_attempts (company_id) values (v_company);
    return null;
  end if;

  return v_id;
end;
$$;

-- CONTRACT: assert_admin_pin now RETURNS NULL (not raises) on a wrong PIN, so its
-- attempt insert can commit. It is NOT an authorization gate on its own — server
-- authz keys on has_admin_elevation()/admin_elevations. Any future caller must
-- treat a null return as failure; never proceed on it.
revoke all on function public.assert_admin_pin(text, boolean) from public;
grant execute on function public.assert_admin_pin(text, boolean) to authenticated;

-- ── admin_elevate: resolve a wrong PIN by RETURNING null (not raising) ─────────
-- This is the outermost RPC of the admin path, so it must be the one that
-- returns on failure — otherwise its raise would roll back the attempt insert
-- assert_admin_pin just made. On a wrong PIN it opens no elevation window and
-- returns null; the client (services/admin.ts) throws 'Wrong admin passcode'.
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
  v_uid := public.assert_admin_pin(p_pin, p_owner);
  if v_uid is null then
    -- Wrong/insufficient PIN. Return null (NOT raise) so the recorded attempt
    -- commits and the lockout can actually accumulate.
    return null;
  end if;

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
