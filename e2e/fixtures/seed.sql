-- Deterministic E2E fixture: a signed-in-able owner + a full catalog, applied on
-- top of a freshly-migrated local Supabase stack (`supabase db reset`). Verified
-- against supabase/postgres 17 via the local stack.
--
-- Login: owner@e2e.test / Passw0rd!   ·   shift PIN: 1379
--
-- Notes learned building this:
--  * Inserting a company auto-seeds a full catalog (categories + ~55 metals) via
--    a company-bootstrap trigger, so we DON'T seed metals here.
--  * We create the auth user with the invite code in raw_user_meta_data so the
--    real handle_new_user path creates the public.users row (role from invite).
--  * GoTrue can't scan NULL token columns ("Database error querying schema" on
--    login) — so confirmation_token/recovery_token/etc. MUST be '' not NULL.

insert into public.companies (id, name, prefix)
  values ('aaaaaaaa-0000-0000-0000-00000000000a', 'E2E Yard', 'EE-2026');

insert into public.invite_codes (code, company_id, role, is_used)
  values ('E2EOWNER1', 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner', false);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '0e2e0e2e-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'owner@e2e.test',
  extensions.crypt('Passw0rd!', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"invite_code":"E2EOWNER1"}'::jsonb, now(), now(),
  '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '0e2e0e2e-0000-0000-0000-000000000001',
  '0e2e0e2e-0000-0000-0000-000000000001',
  jsonb_build_object('sub', '0e2e0e2e-0000-0000-0000-000000000001', 'email', 'owner@e2e.test'),
  'email', now(), now(), now()
);

-- handle_new_user created the public.users row (name ''); set a display name + PIN.
update public.users
  set name = 'E2E Owner',
      pin_hash = extensions.crypt('1379', extensions.gen_salt('bf'))
  where email = 'owner@e2e.test';
