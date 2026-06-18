-- Role enforcement, part 2: swap privileged-write RLS from session role to
-- elevation windows.
--
-- Every write policy below previously gated on is_admin()/is_owner(), which read
-- the SESSION user — so a worker PIN'd into an admin-signed terminal inherited
-- admin rights. Replace each with has_admin_elevation() (or the owner-grade
-- variant), which requires a window opened by a real admin/owner PIN
-- (20260618000002). Reads, tenant scoping, and worker buy/sale writes are
-- untouched.
--
-- Definer functions that still check session role (create_access_code,
-- create_invite_code, upsert_reporting_config, enforce_line_item_pricing) are
-- converted in 20260618000004.

-- ── metals ───────────────────────────────────────────────────────────────────
drop policy if exists "Admins can insert metals in their company" on public.metals;
drop policy if exists "Admins can update metals in their company" on public.metals;

create policy "Elevated admins can insert metals"
  on public.metals for insert to authenticated
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can update metals"
  on public.metals for update to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id())
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

-- ── metal_categories ─────────────────────────────────────────────────────────
drop policy if exists "Admins can insert metal categories in their company" on public.metal_categories;
drop policy if exists "Admins can update metal categories in their company" on public.metal_categories;

create policy "Elevated admins can insert metal categories"
  on public.metal_categories for insert to authenticated
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can update metal categories"
  on public.metal_categories for update to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id())
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

-- ── price_history ────────────────────────────────────────────────────────────
drop policy if exists "Admins can insert price history in their company" on public.price_history;

create policy "Elevated admins can insert price history"
  on public.price_history for insert to authenticated
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

-- ── company_settings (owner-grade) ───────────────────────────────────────────
drop policy if exists "Owners can insert company settings for their company" on public.company_settings;
drop policy if exists "Owners can update company settings in their company" on public.company_settings;

create policy "Elevated owners can insert company settings"
  on public.company_settings for insert to authenticated
  with check (public.has_admin_elevation(true) and company_id = public.current_company_id());

create policy "Elevated owners can update company settings"
  on public.company_settings for update to authenticated
  using (public.has_admin_elevation(true) and company_id = public.current_company_id())
  with check (public.has_admin_elevation(true) and company_id = public.current_company_id());

-- ── companies (owner-grade) ──────────────────────────────────────────────────
drop policy if exists "Owners can update their own company" on public.companies;

create policy "Elevated owners can update their own company"
  on public.companies for update to authenticated
  using (public.has_admin_elevation(true) and id = public.current_company_id())
  with check (public.has_admin_elevation(true) and id = public.current_company_id());

-- ── users (role matrix preserved) ────────────────────────────────────────────
-- Keep "Users can update own name" (self-service, guarded by the self-promotion
-- trigger). Convert the admin/owner management policies to elevation grades.
drop policy if exists "Admins can update non-owners in their company" on public.users;
drop policy if exists "Owners can update anyone in their company" on public.users;

create policy "Elevated admins can update non-owners"
  on public.users for update to authenticated
  using (
    public.has_admin_elevation()
    and company_id = public.current_company_id()
    and role = any (array['admin','worker'])
  )
  with check (
    company_id = public.current_company_id()
    and role = any (array['admin','worker'])
  );

create policy "Elevated owners can update anyone"
  on public.users for update to authenticated
  using (public.has_admin_elevation(true) and company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- ── access_codes (insert path is via create_access_code RPC) ─────────────────
drop policy if exists "Admins can insert access codes in their company" on public.access_codes;
drop policy if exists "Admins can delete their own access codes" on public.access_codes;

create policy "Elevated admins can insert access codes"
  on public.access_codes for insert to authenticated
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can delete access codes"
  on public.access_codes for delete to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id());

-- ── invite_codes ─────────────────────────────────────────────────────────────
drop policy if exists "Creators can delete their unused invite codes" on public.invite_codes;
drop policy if exists "Owners can delete any invite code in their company" on public.invite_codes;

create policy "Elevated admins can delete unused invite codes"
  on public.invite_codes for delete to authenticated
  using (
    public.has_admin_elevation()
    and company_id = public.current_company_id()
    and is_used = false
  );

create policy "Elevated owners can delete any invite code"
  on public.invite_codes for delete to authenticated
  using (public.has_admin_elevation(true) and company_id = public.current_company_id());

-- ── compliance_upload_log ────────────────────────────────────────────────────
drop policy if exists "Admins log manual uploads for their company" on public.compliance_upload_log;

create policy "Elevated admins log manual uploads"
  on public.compliance_upload_log for insert to authenticated
  with check (
    public.has_admin_elevation()
    and company_id = public.current_company_id()
    and method = 'manual'
  );

-- ── customers ────────────────────────────────────────────────────────────────
-- UPDATE was admin-only, but upsertCustomer (services/customers.ts) runs in the
-- WORKER buy flow to refresh a returning seller's phone — so customer edits are
-- staff-level, not privileged. DELETE stays privileged (elevation).
drop policy if exists "Admins can update customers in their company" on public.customers;
drop policy if exists "Admins can delete customers in their company" on public.customers;

create policy "Staff can update customers in their company"
  on public.customers for update to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "Elevated admins can delete customers"
  on public.customers for delete to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id());

-- ── corrections: receipts / line_items / sales / inventory ───────────────────
-- Admin corrections (edit/void/dispose/mark-reported/adjust). Trigger-driven
-- writes (receipt numbering, inventory on buy/sale, created_by_session) run
-- SECURITY DEFINER and bypass RLS, so they are unaffected.
drop policy if exists "Admins can update receipts in their company" on public.receipts;
drop policy if exists "Admins can delete receipts in their company" on public.receipts;
drop policy if exists "Admins can update line items in their company" on public.line_items;
drop policy if exists "Admins can delete line items in their company" on public.line_items;
drop policy if exists "Admins can update sales in their company" on public.sales;
drop policy if exists "Admins can update inventory in their company" on public.inventory;

create policy "Elevated admins can update receipts"
  on public.receipts for update to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id())
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can delete receipts"
  on public.receipts for delete to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can update line items"
  on public.line_items for update to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id())
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can delete line items"
  on public.line_items for delete to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can update sales"
  on public.sales for update to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id())
  with check (public.has_admin_elevation() and company_id = public.current_company_id());

create policy "Elevated admins can update inventory"
  on public.inventory for update to authenticated
  using (public.has_admin_elevation() and company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
