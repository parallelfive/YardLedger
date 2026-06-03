-- CRITICAL multi-tenancy blocker: metals.name and metal_categories.name carry
-- a GLOBAL unique constraint (from the original single-tenant schema). Once one
-- company has a "Copper #1" metal or an "Aluminum" category, NO other company
-- can ever create the same name — so onboarding a second tenant breaks.
--
-- Replace the global unique with a per-company unique. This is strictly more
-- permissive than the existing global unique (any data that satisfied the
-- global constraint trivially satisfies the per-company one), so it is safe to
-- apply to existing data without conflict.

alter table public.metals drop constraint if exists metals_name_key;
alter table public.metals add constraint metals_company_name_key unique (company_id, name);

alter table public.metal_categories drop constraint if exists metal_categories_name_key;
alter table public.metal_categories add constraint metal_categories_company_name_key unique (company_id, name);
