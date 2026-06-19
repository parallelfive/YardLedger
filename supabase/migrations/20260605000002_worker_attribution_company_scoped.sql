-- Shared-terminal worker attribution.
--
-- In the Tare counter model the device holds the company Supabase session, but
-- a buy/sale is attributed to the PIN'd staff member (activeIdentity), who is
-- generally NOT the session user. The phase-4 INSERT policies pinned worker_id
-- to the session user (`worker_id in (select id from users where supabase_id =
-- auth.uid())`), which would block recording any other staffer.
--
-- Relax that to: worker_id must be active staff IN THE DEVICE'S COMPANY. Still
-- fully tenant-safe — company_id is pinned to current_company_id() in the same
-- WITH CHECK, so cross-tenant attribution remains impossible.

-- receipts ------------------------------------------------------------------
drop policy if exists "Workers can create their own receipts" on public.receipts;
create policy "Staff can create receipts in their company"
  on public.receipts for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and worker_id in (
      select id from public.users where company_id = public.current_company_id()
    )
  );

-- line_items ----------------------------------------------------------------
drop policy if exists "Users can create line items on their own receipts" on public.line_items;
create policy "Staff can create line items in their company"
  on public.line_items for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1 from public.receipts r
      where r.id = receipt_id
        and r.company_id = public.current_company_id()
    )
  );

-- sales ---------------------------------------------------------------------
drop policy if exists "Workers can create their own sales" on public.sales;
create policy "Staff can create sales in their company"
  on public.sales for insert
  to authenticated
  with check (
    company_id = public.current_company_id()
    and worker_id in (
      select id from public.users where company_id = public.current_company_id()
    )
  );
