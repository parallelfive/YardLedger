-- NM LeadsOnline reporting scope (per RLD inspector, 2026-07-23):
-- Regulated material must be reported EXCEPT aluminum (cans) and steel purchased
-- BELOW one ton — unless bought alongside a reportable metal, in which case the
-- whole purchase record is reported. Copper/brass/bronze/lead/catalytic and the
-- restricted materials always report.
--
-- This flag marks the below-a-ton-exempt categories (aluminum, steel). The
-- reporting code (utils/reporting.ts + report-to-state edge function) applies the
-- 2000 lb (1 ton) threshold to exempt lines and reports the whole receipt when
-- any line is reportable. Capture (seller ID / vehicle / affidavit) is unchanged
-- and still fires for ALL regulated material, incl. aluminum/steel.

alter table public.metals
  add column if not exists is_report_exempt boolean not null default false;
alter table public.metal_catalog_template_metals
  add column if not exists is_report_exempt boolean not null default false;

-- Aluminum + Steel categories are the below-a-ton exemptions. Stainless Steel is
-- intentionally NOT exempt (higher value / theft-prone — report it).
update public.metals set is_report_exempt = true
  where category_id in (
    select id from public.metal_categories where name in ('Aluminum', 'Steel')
  );
update public.metal_catalog_template_metals set is_report_exempt = true
  where category_name in ('Aluminum', 'Steel');

-- Carry the flag into new companies seeded from the catalog template.
create or replace function public.seed_company_metals(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.metal_categories (company_id, name, display_order, image_url, is_active)
  select p_company_id, t.name, t.display_order, t.image_url, true
  from public.metal_catalog_template_categories t
  on conflict (company_id, name) do nothing;

  insert into public.metals
    (company_id, name, category_id, price_per_lb, is_regulated, is_restricted, is_catalytic, is_report_exempt, is_active)
  select
    p_company_id, t.name, c.id, t.default_price,
    t.is_regulated, t.is_restricted, t.is_catalytic, t.is_report_exempt, true
  from public.metal_catalog_template_metals t
  left join public.metal_categories c
    on c.company_id = p_company_id and c.name = t.category_name
  on conflict (company_id, name) do nothing;
end;
$$;
