-- LeadsOnline (the NM registry) assigns each yard a unique numeric STORE ID that
-- must accompany every report submission; a company may instead use its own
-- strictly-numeric yard number. This is the per-tenant reporting identity behind
-- the multi-tenant model LeadsOnline described (yard-level or company-level
-- credentials keyed to store IDs). Capture it per company; it's format-independent
-- (the exact CSV/XML file spec is still pending an NDA), so safe to add now.
alter table public.company_settings
  add column if not exists leadsonline_store_id text not null default '';
