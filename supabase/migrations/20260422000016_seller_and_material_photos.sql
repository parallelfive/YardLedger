-- NM 57-30-5(C) / 57-30-4(A)(4): the dealer may take (and the seller must
-- allow) a date/time-stamped photograph of BOTH the seller and the material
-- in the form purchased. The app captured an ID-document photo and catalytic
-- converter photos, but had no field for the live seller photo or the
-- material photo. The receipt's created_at provides the date/time stamp.
alter table public.receipts
  add column if not exists seller_photo_uri text,
  add column if not exists material_photo_uri text;
