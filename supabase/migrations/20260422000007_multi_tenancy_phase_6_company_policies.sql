-- Multi-tenancy phase 6: minimal policies on the companies table so the
-- client can read its own company info (name, prefix) and owners can
-- update it. Deferred from phase 4 because we only need these once the
-- app starts reading company data in phase 7.
--
-- invite_codes policies still deferred until phase 8.

create policy "Users can read their own company"
  on public.companies for select
  to authenticated
  using (id = public.current_company_id());

create policy "Owners can update their own company"
  on public.companies for update
  to authenticated
  using (
    public.is_owner()
    and id = public.current_company_id()
  )
  with check (
    public.is_owner()
    and id = public.current_company_id()
  );
