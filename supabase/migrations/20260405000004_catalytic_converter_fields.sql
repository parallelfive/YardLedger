-- Additional fields for catalytic converter transactions per NM 57-30-2.4
-- and the NMRLD Catalytic Converter Additional Documentation form (Rev. 03/2026).
-- These are required ON TOP of the standard regulated material fields.

alter table public.receipts
  add column cat_converter_numbers text not null default '',
  add column transport_vin text not null default '',
  add column cat_converter_photo_uri text,
  add column cat_title_photo_uri text;
