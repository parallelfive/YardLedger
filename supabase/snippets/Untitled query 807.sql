-- Check that current_company_id() resolves your company
-- (this only works in auth context, but let's make sure the FK is intact)
select u.id, u.supabase_id, u.email, u.company_id, c.name, c.prefix
  from public.users u
  left join public.companies c on c.id = u.company_id
  where u.email = 'jayyxamian@gmail.com';
