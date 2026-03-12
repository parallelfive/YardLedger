-- Prevent inventory weight from going negative
alter table public.inventory
  add constraint inventory_weight_non_negative check (weight >= 0);
