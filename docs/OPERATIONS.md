# Operations & Deploy

How the **backend + web app** are deployed and operated. (Mobile app
distribution — EAS / TestFlight / unlisted App Store — lives in
[DISTRIBUTION_GUIDE.md](./DISTRIBUTION_GUIDE.md); this doc is the server side.)

The web app and Supabase stack are **self-hosted on Coolify**, reachable over an
SSH tunnel. All commands below assume an SSH alias `coolify-macbook` (a
cloudflared tunnel) is configured on your machine — ask the maintainer for
access; nothing here contains a credential.

> Discover the concrete IDs on the host — they carry a hash and change if a
> service is recreated:
>
> ```
> ssh coolify-macbook 'docker ps --format "{{.Names}}"'   # DB + edge-fn containers
> ```
>
> Below, `<db-container>` = the `supabase-db-…` container, `<edge-container>` =
> the `supabase-edge-functions-…` container, and `<web-uuid>` = the web app's
> Coolify resource UUID (from the Coolify dashboard).

---

## 1. Deploy the web app

Auto-deploy from `main` is **off** — deploys are manual (a token-authenticated
API call triggers a build of the current `main`):

```
ssh coolify-macbook \
  'curl -s -H "Authorization: Bearer $(cat ~/.ink_coolify_token)" \
   "http://localhost:8000/api/v1/deploy?uuid=<web-uuid>"'
```

Poll status via `GET /api/v1/deployments/<deployment-uuid>` (the deploy call
returns the uuid). A build takes a few minutes. Verify a change actually shipped
by grepping the served bundle for a known string:

```
curl -s https://tare-test.parallel5.com/ | grep -oE 'index-[a-f0-9]+\.js'
curl -s "https://tare-test.parallel5.com/_expo/static/js/web/<bundle>.js" | grep -oF "Some New String"
```

## 2. Apply database migrations

There is **no `schema_migrations` ledger** on the self-hosted DB — apply only
the NEW migration files (the ones added since the last deploy), in order. Pipe
the SQL over stdin so `$$`-quoted function bodies aren't mangled by the shell:

```
cat supabase/migrations/<NEW_FILE>.sql | ssh coolify-macbook \
  "docker exec -i <db-container> psql -U postgres -d postgres"
```

Migrations are idempotent-friendly (`create or replace`, `add column if not
exists`, guarded constraint blocks) but **not automatically re-run** — track
what's applied yourself. Verify a trigger/function landed:

```
ssh coolify-macbook "docker exec <db-container> psql -U postgres -d postgres \
  -c \"select pg_get_functiondef('public.<fn>'::regproc)\""
```

## 3. Deploy edge functions

Edge functions live on a Docker volume; there's no CLI push. Write the file and
recreate the container:

```
cat supabase/functions/<name>/index.ts | ssh coolify-macbook \
  'cat > /data/coolify/services/<service-id>/volumes/functions/<name>/index.ts'
ssh coolify-macbook 'docker restart <edge-container>'
```

- `report-to-state` (state compliance upload) is the main one. Its
  reportability rule + NMRLD CSV columns are **duplicated** from
  `src/compliance/jurisdictions/nm.ts` (Deno can't import app code) — keep them
  in sync when you change either.
- Automated (cron) reporting setup: see
  [../supabase/functions/report-to-state/CRON_SETUP.md](../supabase/functions/report-to-state/CRON_SETUP.md).
  Edge-fn env (`CRON_SECRET`, service-role key) is set in Coolify.

## 4. Seed / reset demo data

For a demo or a fresh test company, seed realistic data (scoped + tagged to the
`GR-2026` company, idempotent):

```
cat supabase/seed/demo_seed.sql     | ssh coolify-macbook "docker exec -i <db-container> psql -U postgres -d postgres"
cat supabase/seed/demo_teardown.sql | ssh coolify-macbook "docker exec -i <db-container> psql -U postgres -d postgres"   # to reset
```

The seed routes through the real triggers (inventory, receipt numbers, holds,
subtotals), so seeded rows behave exactly like app-entered data.

## 5. Provisioning a new company

No in-app signup for the first owner — the operator provisions via SQL (see the
"Bootstrapping a new company" block in [../CLAUDE.md](../CLAUDE.md)): insert the
`companies` row, then an owner `invite_codes` row so they can sign up in-app.

## 6. Post-deploy smoke test

Prefer a **rolled-back transaction** to exercise money/inventory triggers
without leaving test rows (see the per-piece sell verification in the project
history): `begin; …insert…; select …; rollback;`.

---

## Release checklist

1. `npm run typecheck && npm run lint && npm run format:check && npm test` — all clean.
2. Merge the PR to `main` (the author doesn't self-merge).
3. Apply any **new** migrations (§2).
4. Redeploy the web app (§1); redeploy affected **edge functions** (§3).
5. Smoke-test the changed path (§6).
