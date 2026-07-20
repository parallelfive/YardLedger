-- Friendly invite-code pre-check for the sign-up screen.
--
-- handle_new_user() is the real gate — it atomically finds+consumes the invite
-- and raise-exceptions on a missing/invalid/used code. But that runs inside the
-- auth.users insert, so when it throws, Supabase's auth path returns an opaque
-- "Database error saving new user" with the real reason hidden. Testers just
-- see a scary DB error (the #1 onboarding papercut).
--
-- This lets the client check a code BEFORE calling signUp and show a clear
-- message ("already used" vs "invalid"). It's ADVISORY only — a 'valid' result
-- can still lose a race to a concurrent sign-up; the trigger stays authoritative.
--
-- anon-callable (sign-up happens pre-auth). SECURITY DEFINER so it can read
-- invite_codes past RLS, but it returns only a status string — no company or
-- role details leak.

create or replace function public.validate_invite_code(p_code text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when p_code is null or btrim(p_code) = '' then 'invalid'
    when exists (
      select 1 from public.invite_codes
      where code = btrim(p_code) and is_used = true
    ) then 'used'
    when exists (
      select 1 from public.invite_codes
      where code = btrim(p_code)
        and is_used = false
        and (expires_at is null or expires_at > now())
    ) then 'valid'
    else 'invalid'
  end;
$$;

revoke all on function public.validate_invite_code(text) from public;
grant execute on function public.validate_invite_code(text) to anon, authenticated;
