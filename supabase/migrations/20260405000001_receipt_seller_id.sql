-- Store seller ID info directly on receipts for restricted material compliance.
-- Each receipt gets its own snapshot of the seller's ID at time of purchase,
-- independent of the customer profile (which may change over time).
alter table public.receipts
  add column seller_name text not null default '',
  add column seller_dl_number text not null default '',
  add column seller_dob text not null default '',
  add column seller_address text not null default '',
  add column seller_id_photo_uri text;
