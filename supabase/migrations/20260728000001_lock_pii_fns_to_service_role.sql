-- #49 (security): the PII purge/redact RPCs are only ever called by the
-- purge-expired-pii edge function (service_role) — no authenticated app path.
-- They were granted to `authenticated` and only revoked from `public`, which
-- does NOT strip Supabase's default `anon` execute grant. So an UNAUTHENTICATED
-- anon caller could enumerate past-window receipt/customer IDs + private photo
-- object paths and drive cross-tenant redaction (they gate on
-- current_company_id(), which is null for anon and was treated as a trusted
-- service caller). Lock all four to service_role ONLY — the same fix applied to
-- get_reporting_secret in 20260624000001.

revoke all on function public.pii_to_purge(uuid) from anon, authenticated;
grant execute on function public.pii_to_purge(uuid) to service_role;

revoke all on function public.redact_receipt_pii(uuid[]) from anon, authenticated;
grant execute on function public.redact_receipt_pii(uuid[]) to service_role;

revoke all on function public.customers_pii_to_purge(uuid) from anon, authenticated;
grant execute on function public.customers_pii_to_purge(uuid) to service_role;

revoke all on function public.redact_customer_pii(uuid[]) from anon, authenticated;
grant execute on function public.redact_customer_pii(uuid[]) to service_role;
