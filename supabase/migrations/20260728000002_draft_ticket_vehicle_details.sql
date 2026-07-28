-- Draft (scale) tickets only carried the vehicle plate + transport VIN, so when
-- a worker captured the rig at the scale the year/make/model/color never rode to
-- the cashier — the desktop finalize step could only ever record a plate. The
-- receipts table already breaks the vehicle out into these columns (migration
-- 20260405000003); mirror them on draft_tickets so the worker's full capture
-- survives the handoff. Additive, defaulted, non-breaking.
alter table public.draft_tickets
  add column if not exists vehicle_year text not null default '',
  add column if not exists vehicle_make text not null default '',
  add column if not exists vehicle_model text not null default '',
  add column if not exists vehicle_color text not null default '';
