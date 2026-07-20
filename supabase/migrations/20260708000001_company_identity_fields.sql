-- The yard's own regulatory identity. NM (and most states') scrap laws require
-- the dealer's license/registration number on purchase records and state
-- uploads — until now these weren't captured, so Settings showed them as "—".
-- Additive, nullable-with-default so existing rows stay valid; written through
-- the existing elevated-admin company_settings update path (no RPC change).

alter table public.company_settings
  add column if not exists license_number text not null default '',
  add column if not exists ein text not null default '',
  add column if not exists registry_id text not null default '';
