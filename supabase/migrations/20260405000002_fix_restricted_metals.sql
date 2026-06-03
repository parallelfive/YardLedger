-- Fix restricted metal flags to match NM 57-30-2.4 exactly.
-- Previously brass, insulated wire, transformers, and ballasts were
-- incorrectly flagged as restricted.
--
-- Per NM law, restricted regulated material is:
--   1. Infrastructure-grade material BURNED to remove insulation
--   2. Material with ID marks removed/altered (situational, not per metal type)
--   3. Material marked as utility/railroad/government property (situational)
--   4. Utility access covers, water meter covers, guard rails, signs, signals
--   5. Beer kegs marked as brewery property
--   6. Catalytic converters not part of an entire motor vehicle
--
-- Only #1 and #6 can be flagged by metal type. The rest are identified
-- by the worker at the counter.

-- Remove incorrect restricted flags
UPDATE public.metals SET is_restricted = false
WHERE name IN (
  'Insulated Copper Wire',
  'Romex Wire',
  'THHN Wire',
  'Low-Grade Insulated',
  'Yellow Brass',
  'Red Brass',
  'Mixed Brass',
  'Transformers',
  'Ballasts'
);

-- Burnt Copper Wire stays restricted (already flagged)
-- Ensure it's set just in case
UPDATE public.metals SET is_restricted = true
WHERE name = 'Burnt Copper Wire';

-- Add Catalytic Converter as a restricted metal
INSERT INTO public.metals (name, price_per_lb, is_restricted, category_id)
VALUES (
  'Catalytic Converter',
  6.00,
  true,
  (SELECT id FROM public.metal_categories WHERE name = 'Motors & Mixed')
);
