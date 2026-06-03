-- 3-tier NM compliance system:
--   Tier 1: Non-regulated (aluminum cans, small quantities) — no docs needed
--   Tier 2: Regulated (copper, brass, bronze, lead, steel, aluminum products) — ID + vehicle + signature
--   Tier 3: Restricted (burned wire, utility property, catalytic converters, etc.) — tier 2 + additional docs

-- Add is_regulated flag to metals (separate from is_restricted)
alter table public.metals
  add column is_regulated boolean not null default false;

-- Break out vehicle description into separate fields for NM Purchase Record form
alter table public.receipts
  add column vehicle_year text not null default '',
  add column vehicle_make text not null default '',
  add column vehicle_model text not null default '',
  add column vehicle_color text not null default '',
  add column seller_state_of_issue text not null default '',
  add column seller_city text not null default '',
  add column seller_state text not null default '',
  add column seller_zip text not null default '';

-- Seed is_regulated on metals per NM 57-30-2 definitions:
-- Aluminum: products (NOT cans). "Aluminum Cans (UBC)" is explicitly excluded.
UPDATE public.metals SET is_regulated = true
WHERE category_id = (SELECT id FROM public.metal_categories WHERE name = 'Aluminum')
  AND name != 'Aluminum Cans (UBC)';

-- Copper: all copper wire, tubing, hardware
UPDATE public.metals SET is_regulated = true
WHERE category_id = (SELECT id FROM public.metal_categories WHERE name = 'Copper');

-- Brass: all brass items
UPDATE public.metals SET is_regulated = true
WHERE category_id = (SELECT id FROM public.metal_categories WHERE name = 'Brass');

-- Steel: alloys of iron/chromium/nickel/manganese (includes stainless)
UPDATE public.metals SET is_regulated = true
WHERE category_id IN (
  SELECT id FROM public.metal_categories WHERE name IN ('Steel', 'Stainless Steel')
);

-- Lead: batteries, pipe, etc.
UPDATE public.metals SET is_regulated = true
WHERE category_id = (SELECT id FROM public.metal_categories WHERE name = 'Lead');

-- Bronze is under Brass category in this DB. If a Bronze category exists, flag it too.
-- Nickel, Zinc, Titanium are not explicitly listed in NM 57-30-2 as regulated.
-- Motors & Mixed: flag individually — transformers/motors contain regulated metals
UPDATE public.metals SET is_regulated = true
WHERE category_id = (SELECT id FROM public.metal_categories WHERE name = 'Motors & Mixed');

-- All restricted metals are also regulated by definition
UPDATE public.metals SET is_regulated = true WHERE is_restricted = true;
