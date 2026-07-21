-- Correct the catalytic-converter hold to match NM law.
--
-- Migration 20260422000014 set cat_converter_hold_days = 60, but that was an
-- incorrect assumption. NM's Sale of Recycled Metals Act imposes a single
-- **24-hour** hold on all regulated material — there is no separate longer
-- catalytic hold. Fix the column default and correct any existing rows.
--
-- The other NM values from that migration are correct and left unchanged:
--   general_hold_hours = 24, general_retention_years = 1,
--   cat_converter_retention_years = 3 (§57-30-2.4),
--   cat_converter_check_only = true (§57-30-2.4 requires check payment for cats).

alter table public.company_settings
  alter column cat_converter_hold_days set default 1;

update public.company_settings
  set cat_converter_hold_days = 1
  where cat_converter_hold_days = 60;
