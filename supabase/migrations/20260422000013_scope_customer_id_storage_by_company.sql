-- Cross-tenant PII leak: the customer-ids bucket (scanned driver's licenses
-- and seller IDs) is private, but its RLS let ANY authenticated user from
-- ANY company read/list/overwrite every yard's ID photos. Files are now
-- uploaded under a `${company_id}/` prefix (see services/customers.ts and
-- services/receipts.ts); scope every storage policy to the caller's company
-- folder so each yard sees only its own IDs.

-- Ensure the helper is callable from the client via supabase.rpc().
grant execute on function public.current_company_id() to authenticated;

drop policy if exists "Authenticated users can upload customer IDs" on storage.objects;
drop policy if exists "Authenticated users can read customer IDs" on storage.objects;

create policy "Company members can read their customer IDs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'customer-ids'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "Company members can upload customer IDs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'customer-ids'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );

create policy "Company members can update their customer IDs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'customer-ids'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  )
  with check (
    bucket_id = 'customer-ids'
    and (storage.foldername(name))[1] = public.current_company_id()::text
  );
