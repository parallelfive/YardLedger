-- Make invite_codes.created_by nullable.
--
-- The bootstrap case for a brand-new company has no creator: the service
-- operator inserts the first owner's invite directly via SQL before any
-- user exists in the company. Phase 1 created the column as NOT NULL,
-- which made that flow impossible. Drop the constraint; the FK reference
-- still ensures it points at a real users.id when set.

alter table public.invite_codes
  alter column created_by drop not null;
