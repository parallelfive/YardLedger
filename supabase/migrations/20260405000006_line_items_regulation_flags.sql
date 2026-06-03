-- Persist is_regulated and is_restricted flags on line_items so historical
-- compliance data is accurate even if metals table flags change later.

alter table public.line_items
  add column is_regulated boolean not null default false,
  add column is_restricted boolean not null default false;

-- Backfill existing line items from current metals flags
update public.line_items li
  set is_regulated = m.is_regulated,
      is_restricted = m.is_restricted
  from public.metals m
  where li.metal_id = m.id;

-- Drop the FK constraint on override_approved_by since access code flow
-- does not identify a specific admin user. Allow null or any text value.
alter table public.line_items
  drop constraint if exists line_items_override_approved_by_fkey;

alter table public.line_items
  alter column override_approved_by type text using override_approved_by::text;
