-- Fix company_settings update policy: was checking users.id = auth.uid()
-- but should use supabase_id (or just use the is_admin() helper)
drop policy if exists "Admins can update company settings" on public.company_settings;

create policy "Admins can update company settings"
  on public.company_settings for update
  using (public.is_admin());

-- Also fix insert policy to use is_admin()
drop policy if exists "Admins can insert company settings" on public.company_settings;

create policy "Admins can insert company settings"
  on public.company_settings for insert
  with check (public.is_admin());
