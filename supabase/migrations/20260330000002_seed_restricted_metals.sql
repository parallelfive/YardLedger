-- Mark NM restricted metals (copper wire, bronze, burned wire)
-- Per NM Sale of Recycled Metals Act Section 57-30-2.4

-- All copper wire types are restricted
UPDATE public.metals SET is_restricted = true
WHERE name IN (
  'Insulated Copper Wire',
  'Romex Wire',
  'THHN Wire',
  'Low-Grade Insulated',
  'Burnt Copper Wire'
);

-- Bronze materials are restricted (cemetery vases, statuary, etc.)
-- Brass with bronze content also flagged
UPDATE public.metals SET is_restricted = true
WHERE name IN (
  'Yellow Brass',
  'Red Brass',
  'Mixed Brass'
);

-- Transformers and ballasts often contain restricted materials
UPDATE public.metals SET is_restricted = true
WHERE name IN (
  'Transformers',
  'Ballasts'
);
