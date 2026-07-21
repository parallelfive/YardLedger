-- Carry vehicle info on the scale ticket so it's captured where the vehicle
-- actually is — at the scale, by the worker, who's standing next to the truck.
-- The cashier at the front desk never has to walk outside: plate + VIN ride
-- along on the draft and pre-fill the finalize step (still editable there, so a
-- missed field can be corrected at the counter — hybrid capture).
--
-- These are staging columns only. The compliance gate still fires at finalize
-- through create_receipt_with_items (unchanged) — this just moves the *capture*
-- of vehicle data to the station that can see the vehicle.

alter table public.draft_tickets
  add column if not exists vehicle_plate text not null default '',
  add column if not exists transport_vin text not null default '';
