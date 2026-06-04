# Automated state reporting — setup

The `report-to-state` edge function uploads each company's unreported buy
transactions to its configured LeadsOnline SFTP account, stamps them
`reported_at`, and logs the run to `compliance_upload_log`.

## One-time deploy

```bash
supabase functions deploy report-to-state
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to the function
# automatically; do NOT set them manually.
```

## Per-yard onboarding (no code, done in the app)

The yard **owner** opens **Company Profile → State Reporting** and enters the
LeadsOnline SFTP host / port / username / password / remote folder, then
toggles **Automated reporting enabled** and saves. Credentials are stored
write-only (the app can never read the password back); only this function,
via the service role, can read them.

Owners/admins can also hit **Send Now** to trigger an immediate upload.

## Nightly cron (run once in the SQL editor — fill in the placeholders)

Requires the `pg_cron` and `pg_net` extensions (enable them in the dashboard).
Schedule a daily run well before the NM 2-business-day deadline, e.g. 6am:

```sql
select cron.schedule(
  'report-to-state-daily',
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/report-to-state',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<THE_CRON_SECRET_YOU_SET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

The `x-cron-secret` header tells the function to run in cron mode (report
every enabled company); without it the function only reports the authenticated
caller's own company.

## ⚠️ Validate before relying on it

This was written before onboarding a real LeadsOnline account. Confirm with
LeadsOnline / NMRLD and adjust `index.ts` if needed:

1. **File format** — `buildCsv` emits our NMRLD field set; LeadsOnline issues
   an account-specific layout (CSV/XML). Match it.
2. **Transport** — assumed SFTP to the issued host. If they use a different
   channel, swap `uploadViaSftp`.
3. **SFTP in the edge runtime** — verify `npm:ssh2-sftp-client` works under
   Supabase's Deno runtime; if not, use an SFTP-capable relay.
