-- =============================================================================
-- Multi-tenancy verification snippets.
--
-- Run these in Studio's SQL Editor against the local DB. Each block is a
-- separate test you can run independently. Copy-paste the section, run it,
-- and check the result against the "Expect" comment.
--
-- Assumes:
--   - Legacy Yard already exists (LEGAC-2026)
--   - Gorilla Recycling already exists (GR-2026)
--   - TESTOWNR invite code exists for Gorilla, role = owner
-- =============================================================================


-- =============================================================================
-- 1. Confirm both companies exist with proper prefixes
-- =============================================================================
select name, prefix from public.companies order by name;
-- Expect: 2 rows: Gorilla Recycling/GR-2026, Legacy Yard/LEGAC-2026


-- =============================================================================
-- 2. Confirm the bootstrap invite is ready
-- =============================================================================
select code, role, is_used, c.name as company
  from public.invite_codes ic
  join public.companies c on c.id = ic.company_id
  where ic.is_used = false;
-- Expect: TESTOWNR / owner / false / Gorilla Recycling


-- =============================================================================
-- 3. Simulate sign-up via the auth trigger (the way the app does it).
-- This creates an auth.users row with the invite code in metadata; the
-- handle_new_user trigger should consume the invite, create a profile,
-- and mark the invite used.
-- =============================================================================

-- 3a. Create the auth user
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, aud, role, instance_id
) values (
  gen_random_uuid(),
  'gorilla.owner@test.com',
  crypt('password123', gen_salt('bf')),
  now(),
  jsonb_build_object('invite_code', 'TESTOWNR'),
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
);

-- 3b. Verify the profile got created with correct role + company
select u.email, u.role, u.is_active, c.name as company
  from public.users u
  join public.companies c on c.id = u.company_id
  where u.email = 'gorilla.owner@test.com';
-- Expect: gorilla.owner@test.com / owner / true / Gorilla Recycling

-- 3c. Verify the invite was consumed
select code, is_used, used_at is not null as has_used_at
  from public.invite_codes
  where code = 'TESTOWNR';
-- Expect: TESTOWNR / true / true


-- =============================================================================
-- 4. Verify reusing the invite code fails (it's been consumed)
-- =============================================================================
do $$
begin
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, aud, role, instance_id
  ) values (
    gen_random_uuid(),
    'second.attempt@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    jsonb_build_object('invite_code', 'TESTOWNR'),
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );
  raise notice 'FAIL: reused invite was accepted';
exception when others then
  raise notice 'PASS: reused invite was rejected (%)', sqlerrm;
end $$;


-- =============================================================================
-- 5. Verify sign-up without an invite code fails
-- =============================================================================
do $$
begin
  insert into auth.users (
    id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, aud, role, instance_id
  ) values (
    gen_random_uuid(),
    'no.invite@test.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{}'::jsonb,
    'authenticated',
    'authenticated',
    '00000000-0000-0000-0000-000000000000'
  );
  raise notice 'FAIL: missing invite was accepted';
exception when others then
  raise notice 'PASS: missing invite was rejected (%)', sqlerrm;
end $$;


-- =============================================================================
-- 6. As the new Gorilla owner, generate a worker invite code, then redeem
-- it as a second user.
-- =============================================================================

-- 6a. Set role to authenticated and impersonate the Gorilla owner
set local role authenticated;
set local "request.jwt.claims" to '{}';
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select supabase_id from public.users where email = 'gorilla.owner@test.com'))::text,
  true
);

-- 6b. Generate a worker invite
select public.create_invite_code('worker');
-- Expect: an 8-char code returned

-- 6c. List invite codes (should see the one just generated)
select code, role, is_used from public.invite_codes order by created_at desc;

reset role;


-- =============================================================================
-- 7. Receipt-number generation per company. Insert a buy receipt as the
-- Gorilla owner, then verify the receipt number format.
-- =============================================================================

-- 7a. Get the Gorilla owner's profile id and company id
\set gorilla_owner_id (select id from public.users where email = 'gorilla.owner@test.com')
\set gorilla_company_id (select id from public.companies where prefix = 'GR-2026')

-- 7b. Insert a receipt for Gorilla
insert into public.receipts (customer_name, type, worker_id, company_id)
values (
  'Test Customer',
  'buy',
  (select id from public.users where email = 'gorilla.owner@test.com'),
  (select id from public.companies where prefix = 'GR-2026')
);

-- 7c. Verify the receipt number matches GR-2026-MMDDYYYY-1
select receipt_number, customer_name
  from public.receipts
  where company_id = (select id from public.companies where prefix = 'GR-2026')
  order by created_at desc
  limit 1;
-- Expect: GR-2026-MMDDYYYY-1 (today's date)


-- =============================================================================
-- 8. Cross-tenant isolation check (the big one).
-- Impersonate the Gorilla owner and verify they can only see GR data.
-- =============================================================================

set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select supabase_id from public.users where email = 'gorilla.owner@test.com'))::text,
  true
);

-- Should see only Gorilla's company
select name, prefix from public.companies;

-- Should see only Gorilla's receipts
select receipt_number, company_id from public.receipts;

-- Helper sanity check: who am I?
select public.current_company_id();
-- Expect: Gorilla's UUID

select public.is_admin(), public.is_owner();
-- Expect: t / t

reset role;
