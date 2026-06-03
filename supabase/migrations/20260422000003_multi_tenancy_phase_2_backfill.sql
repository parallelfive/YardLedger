-- Multi-tenancy phase 2: backfill existing data into a "Legacy Yard"
-- company, promote the first existing admin to owner, and flip every
-- company_id column to NOT NULL.
--
-- After this migration every row in every business table has a
-- non-null company_id, and the schema guarantees that going forward.

do $$
declare
  legacy_id uuid;
  legacy_owner_id uuid;
begin
  -- Create the Legacy company. Prefix conforms to the phase 1 regex
  -- (^[A-Z]{2,5}-[0-9]{4}$). Year is hard-coded so this migration is
  -- deterministic regardless of when it runs.
  insert into public.companies (name, prefix)
    values ('Legacy Yard', 'LEGAC-2026')
    returning id into legacy_id;

  -- Stamp every existing row with the Legacy company.
  update public.users set company_id = legacy_id where company_id is null;
  update public.metals set company_id = legacy_id where company_id is null;
  update public.metal_categories set company_id = legacy_id where company_id is null;
  update public.receipts set company_id = legacy_id where company_id is null;
  update public.line_items set company_id = legacy_id where company_id is null;
  update public.inventory set company_id = legacy_id where company_id is null;
  update public.sales set company_id = legacy_id where company_id is null;
  update public.customers set company_id = legacy_id where company_id is null;
  update public.access_codes set company_id = legacy_id where company_id is null;
  update public.price_history set company_id = legacy_id where company_id is null;
  update public.company_settings set company_id = legacy_id where company_id is null;

  -- Promote the oldest existing admin to owner of Legacy.
  -- If no admin exists yet (fresh install), skip — phase 8 onboarding
  -- handles provisioning the first owner via invite codes.
  select id into legacy_owner_id
    from public.users
    where role = 'admin'
      and company_id = legacy_id
    order by created_at asc
    limit 1;

  if legacy_owner_id is not null then
    update public.users
      set role = 'owner'
      where id = legacy_owner_id;
  end if;
end $$;

-- Flip company_id to NOT NULL on every business table. Safe now that
-- the backfill above has filled every row.
alter table public.users alter column company_id set not null;
alter table public.metals alter column company_id set not null;
alter table public.metal_categories alter column company_id set not null;
alter table public.receipts alter column company_id set not null;
alter table public.line_items alter column company_id set not null;
alter table public.inventory alter column company_id set not null;
alter table public.sales alter column company_id set not null;
alter table public.customers alter column company_id set not null;
alter table public.access_codes alter column company_id set not null;
alter table public.price_history alter column company_id set not null;
alter table public.company_settings alter column company_id set not null;

-- company_settings used to be a singleton; now each company gets exactly
-- one row. Enforce the invariant at the DB so services don't need to
-- defensively `limit 1`.
alter table public.company_settings
  add constraint company_settings_company_id_unique unique (company_id);
