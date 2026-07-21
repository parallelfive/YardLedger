-- The no-theft attestation (added in 20260721000002) is a statutory field like
-- seller_affirmed, but it postdates the immutability trigger so it wasn't in the
-- frozen set — meaning it could be flipped after the receipt was created.
-- Redefine the guard to also freeze seller_no_theft_affirmed. Everything else is
-- verbatim from 20260603000006; only the one new column check is added.

create or replace function public.enforce_receipt_immutability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.receipt_number       is distinct from old.receipt_number
  or new.customer_name        is distinct from old.customer_name
  or new.customer_phone       is distinct from old.customer_phone
  or new.customer_id          is distinct from old.customer_id
  or new.type                 is distinct from old.type
  or new.signature_uri        is distinct from old.signature_uri
  or new.worker_id            is distinct from old.worker_id
  or new.company_id           is distinct from old.company_id
  or new.created_at           is distinct from old.created_at
  or new.vehicle_plate        is distinct from old.vehicle_plate
  or new.vehicle_year         is distinct from old.vehicle_year
  or new.vehicle_make         is distinct from old.vehicle_make
  or new.vehicle_model        is distinct from old.vehicle_model
  or new.vehicle_color        is distinct from old.vehicle_color
  or new.vehicle_description   is distinct from old.vehicle_description
  or new.seller_name          is distinct from old.seller_name
  or new.seller_dl_number     is distinct from old.seller_dl_number
  or new.seller_dob           is distinct from old.seller_dob
  or new.seller_state_of_issue is distinct from old.seller_state_of_issue
  or new.seller_address       is distinct from old.seller_address
  or new.seller_city          is distinct from old.seller_city
  or new.seller_state         is distinct from old.seller_state
  or new.seller_zip           is distinct from old.seller_zip
  or new.seller_affirmed      is distinct from old.seller_affirmed
  or new.seller_no_theft_affirmed is distinct from old.seller_no_theft_affirmed
  or new.seller_id_photo_uri  is distinct from old.seller_id_photo_uri
  or new.seller_photo_uri     is distinct from old.seller_photo_uri
  or new.material_photo_uri   is distinct from old.material_photo_uri
  or new.cat_converter_numbers is distinct from old.cat_converter_numbers
  or new.transport_vin        is distinct from old.transport_vin
  or new.cat_converter_photo_uri is distinct from old.cat_converter_photo_uri
  or new.cat_title_photo_uri  is distinct from old.cat_title_photo_uri
  or new.payment_method       is distinct from old.payment_method
  or new.is_catalytic         is distinct from old.is_catalytic
  then
    raise exception
      'Receipt records are immutable once created (NM 57-30); only subtotal, disposal, and hold status may change.';
  end if;
  return new;
end;
$$;
