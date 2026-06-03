-- Multi-tenancy phase 8: invite-code sign-up.
--
-- Sign-up now requires a valid invite code passed via Supabase auth
-- metadata (options.data.invite_code on the client). The code encodes
-- which company the new user joins and with what role. Valid invite =
-- user is created active and pre-approved; invalid/missing = sign-up
-- fails (auth.users insert rolls back via the trigger).
--
-- Bootstrap: when the service operator provisions a brand-new company,
-- they create it + generate the first owner's invite via SQL with the
-- service_role key. Example:
--
--   insert into public.companies (name, prefix)
--     values ('Gorilla Recycling', 'GR-2026')
--     returning id;
--   -- take that id, then:
--   insert into public.invite_codes (code, company_id, role, created_by)
--     values ('XXXXXXXX', '<company_id>', 'owner', null);
--
-- After that, the first owner signs up with the code and can use
-- create_invite_code() in-app to invite everyone else.

-- =========================================================================
-- invite_codes: policies
-- =========================================================================

-- Admins and owners can list and inspect codes in their company
-- (for a future management UI). INSERT flows through the RPC below,
-- UPDATE flows through handle_new_user (which runs SECURITY DEFINER).
create policy "Admins can read invite codes in their company"
  on public.invite_codes for select
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
  );

-- Creator can delete their own unused codes
create policy "Creators can delete their unused invite codes"
  on public.invite_codes for delete
  to authenticated
  using (
    public.is_admin()
    and company_id = public.current_company_id()
    and is_used = false
    and created_by in (select id from public.users where supabase_id = auth.uid())
  );

-- Owners can delete any code in their company (unused or otherwise)
create policy "Owners can delete any invite code in their company"
  on public.invite_codes for delete
  to authenticated
  using (
    public.is_owner()
    and company_id = public.current_company_id()
  );

-- =========================================================================
-- create_invite_code: admin/owner calls this to generate a code.
--   - 8-char uppercase alphanumeric from a 32-char alphabet (no 0/O/1/I)
--   - Admins can invite 'admin' or 'worker' but NOT 'owner'
--   - Owners can invite any role including another owner
-- =========================================================================
create or replace function public.create_invite_code(p_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_code text;
  current_user_id uuid;
  caller_role text;
  caller_company_id uuid;
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  i int;
  max_attempts int := 10;
  attempt int := 0;
begin
  if p_role not in ('owner', 'admin', 'worker') then
    raise exception 'Role must be owner, admin, or worker';
  end if;

  select role, company_id, id
    into caller_role, caller_company_id, current_user_id
    from public.users
    where supabase_id = auth.uid()
      and is_active = true
      and role in ('admin', 'owner');

  if caller_role is null then
    raise exception 'Only active admins or owners can create invite codes';
  end if;

  if caller_role = 'admin' and p_role = 'owner' then
    raise exception 'Admins cannot invite owners; only owners can';
  end if;

  loop
    attempt := attempt + 1;
    bytes := gen_random_bytes(8);
    new_code := '';
    for i in 0..7 loop
      new_code := new_code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
    end loop;

    begin
      insert into public.invite_codes (code, company_id, role, created_by)
        values (new_code, caller_company_id, p_role, current_user_id);
      return new_code;
    exception when unique_violation then
      if attempt >= max_attempts then
        raise exception 'Unable to generate unique invite code after % attempts', max_attempts;
      end if;
    end;
  end loop;
end;
$$;

revoke all on function public.create_invite_code(text) from public;
grant execute on function public.create_invite_code(text) to authenticated;

-- =========================================================================
-- handle_new_user: replace the phase-3 fallback with strict invite-code
-- validation. Raises on missing/invalid/expired codes, which rolls back
-- the auth.users insert in the same transaction.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  invite_code_text text;
  invite_id uuid;
  invite_role text;
  invite_company_id uuid;
  new_user_id uuid;
begin
  invite_code_text := new.raw_user_meta_data->>'invite_code';

  if invite_code_text is null or invite_code_text = '' then
    raise exception 'Sign-up requires an invite code';
  end if;

  -- Atomically find and lock the matching unused, non-expired invite so
  -- two concurrent sign-ups can't both redeem the same code.
  select id, role, company_id
    into invite_id, invite_role, invite_company_id
    from public.invite_codes
    where code = invite_code_text
      and is_used = false
      and (expires_at is null or expires_at > now())
    limit 1
    for update;

  if invite_id is null then
    raise exception 'Invalid or expired invite code';
  end if;

  insert into public.users (
    supabase_id, email, name, role, is_active, company_id
  )
  values (
    new.id, new.email, '', invite_role, true, invite_company_id
  )
  returning id into new_user_id;

  update public.invite_codes
    set is_used = true,
        used_at = now(),
        used_by = new_user_id
    where id = invite_id;

  return new;
end;
$$;
