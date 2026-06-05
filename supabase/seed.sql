-- Seed data is now applied directly from migrations (see
-- 20260310000002_metals.sql, 20260310000007_metal_categories.sql, and
-- 20260310000008_seed_metal_grades.sql). Those migrations create the
-- canonical set of categories and metals, and phase 2 of the multi-
-- tenancy migration stamps them with the Legacy company's id.
--
-- Add dev-only test data below (sample users, test receipts, etc.) as
-- needed. Any inserts into multi-tenant tables must include a
-- company_id — look up the Legacy row if you want to pile test data
-- there, e.g.:
--
--   insert into public.customers (name, phone, company_id) values
--     ('Test Customer', '555-0000',
--      (select id from public.companies where prefix = 'LEGAC-2026'));

-- ── Dev bootstrap (LOCAL only) ───────────────────────────────────────────────
-- A company + an owner invite code so you can register on the local stack.
-- Inserting the company fires the auto-seed triggers (company_settings + the
-- per-company metal catalog), so a fresh local DB is immediately usable.
-- Register in the app with invite code: GORILLA1
insert into public.companies (name, prefix)
select 'Gorilla Recycling (local)', 'GR-2026'
where not exists (select 1 from public.companies where prefix = 'GR-2026');

insert into public.invite_codes (code, company_id, role, created_by)
select 'GORILLA1', c.id, 'owner', null
from public.companies c
where c.prefix = 'GR-2026'
  and not exists (select 1 from public.invite_codes where code = 'GORILLA1');
