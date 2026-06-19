// Edge function: purge seller PII from buy receipts whose retention window has
// closed (NM 57-30: 1yr general / 3yr catalytic). Data-minimization — we keep
// the ID only as long as the law requires, then scrub it. See
// docs/decisions/0001-id-retention-and-purge.md.
//
// Two invocation modes (mirrors report-to-state):
//   1. Cron — header `x-cron-secret: <CRON_SECRET>` → every company.
//   2. Authenticated OWNER from the app → their own company only.
//
// Per company, crash-safe ordering:
//   pii_to_purge(company)  → past-window receipts + their photo object paths
//   storage.remove(paths)  → delete the ID/seller/material photos from the bucket
//   redact_receipt_pii(ids)→ null the PII columns + stamp pii_purged_at
// Listing before deleting/redacting means a re-run re-lists the same receipts
// (still unpurged) and re-deletes already-gone paths as a harmless no-op.

import { createClient } from 'npm:@supabase/supabase-js@2';

const PRIVATE_BUCKET = 'customer-ids';

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function purgeCompany(admin: any, companyId: string) {
  const { data: rows, error } = await admin.rpc('pii_to_purge', {
    p_company: companyId,
  });
  if (error) return { companyId, status: 'error', reason: error.message };
  if (!rows || rows.length === 0) {
    return { companyId, status: 'nothing-to-purge', count: 0 };
  }

  // Collect every photo object path across the expired receipts, delete them.
  const paths = rows.flatMap(
    (r: { photo_paths: string[] }) => r.photo_paths ?? []
  );
  if (paths.length > 0) {
    const { error: rmErr } = await admin.storage
      .from(PRIVATE_BUCKET)
      .remove(paths);
    // A failed delete must NOT advance to redaction (we'd lose the paths and
    // orphan the files). Leave the receipts unpurged so the next run retries.
    if (rmErr) {
      return {
        companyId,
        status: 'error',
        reason: `storage: ${rmErr.message}`,
      };
    }
  }

  const ids = rows.map((r: { receipt_id: string }) => r.receipt_id);
  const { data: redacted, error: redErr } = await admin.rpc(
    'redact_receipt_pii',
    { p_receipt_ids: ids }
  );
  if (redErr) return { companyId, status: 'error', reason: redErr.message };

  await admin.from('compliance_upload_log').insert({
    company_id: companyId,
    method: 'purge',
    receipt_count: redacted ?? ids.length,
    status: 'success',
    detail: `Purged PII from ${redacted ?? ids.length} expired receipt(s); deleted ${paths.length} photo(s)`,
  });

  return {
    companyId,
    status: 'success',
    receipts: redacted ?? ids.length,
    photos: paths.length,
  };
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let companyIds: string[] = [];

  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader !== null) {
    if (!CRON_SECRET || !timingSafeEqual(cronHeader, CRON_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const { data } = await admin.from('companies').select('id');
    companyIds = (data ?? []).map((r: { id: string }) => r.id);
  } else {
    // Authenticated owner → their company only (purge is destructive).
    const token = (req.headers.get('Authorization') ?? '').replace(
      'Bearer ',
      ''
    );
    const {
      data: { user },
    } = await admin.auth.getUser(token);
    if (!user) return new Response('Unauthorized', { status: 401 });
    const { data: profile } = await admin
      .from('users')
      .select('company_id, role')
      .eq('supabase_id', user.id)
      .single();
    if (!profile || profile.role !== 'owner') {
      return new Response('Forbidden', { status: 403 });
    }
    companyIds = [profile.company_id];
  }

  const results = [];
  for (const id of companyIds) results.push(await purgeCompany(admin, id));

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
