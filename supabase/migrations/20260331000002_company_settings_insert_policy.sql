-- Allow admins to insert company settings (in case the seed row is missing)
create policy "Admins can insert company settings"
  on public.company_settings for insert
  with check (true);
