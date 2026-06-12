// Edge function: upload unreported buy transactions to the state / LeadsOnline
// database over SFTP, per company, then stamp them reported.
//
// Two invocation modes:
//   1. Authenticated owner/admin from the app ("Send now") — reports their own
//      company. Pass the user's JWT in the Authorization header.
//   2. Cron — pass header `x-cron-secret: <CRON_SECRET>` to report EVERY
//      company that has reporting enabled.
//
// Secrets come from the function environment (auto-provided SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY; set CRON_SECRET yourself). Per-company SFTP
// credentials are read from company_reporting_config via the service role.
//
// ⚠️ NOT YET VALIDATED against a live LeadsOnline account. Two things to
// confirm at onboarding and tweak here if needed: (a) the exact file FORMAT /
// column layout LeadsOnline expects for the account (buildCsv below is our
// NMRLD field set as a sensible default), and (b) that the transport is SFTP
// to the issued host (swap `uploadViaSftp` if they use a different channel).

import { createClient } from 'npm:@supabase/supabase-js@2';
import SftpClient from 'npm:ssh2-sftp-client';
import { Buffer } from 'node:buffer';

interface ReportingConfig {
  company_id: string;
  sftp_host: string;
  sftp_port: number;
  sftp_username: string;
  sftp_password: string;
  remote_dir: string;
  enabled: boolean;
}

// Constant-time string compare so the cron-secret check can't be probed byte
// by byte via response timing.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  'receipt_number',
  'transaction_datetime',
  'seller_name',
  'seller_address',
  'seller_dl_number',
  'seller_dl_state',
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'vehicle_plate',
  'transport_vin',
  'material',
  'weight_lb',
  'amount_paid',
  'payment_method',
  'is_catalytic_converter',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCsv(rows: any[]): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const items = r.line_items?.length ? r.line_items : [null];
    for (const li of items) {
      lines.push(
        [
          r.receipt_number,
          r.created_at,
          r.seller_name,
          r.seller_address,
          r.seller_dl_number,
          r.seller_state_of_issue,
          r.vehicle_year,
          r.vehicle_make,
          r.vehicle_model,
          r.vehicle_plate,
          r.transport_vin,
          li?.metal_name ?? '',
          li?.weight ?? '',
          li ? li.total : r.subtotal,
          r.payment_method,
          r.is_catalytic ? 'yes' : 'no',
        ]
          .map(csvCell)
          .join(',')
      );
    }
  }
  return lines.join('\n');
}

async function uploadViaSftp(
  cfg: ReportingConfig,
  fileName: string,
  contents: string
): Promise<void> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: cfg.sftp_host,
      port: cfg.sftp_port || 22,
      username: cfg.sftp_username,
      password: cfg.sftp_password,
    });
    const dir = cfg.remote_dir?.replace(/\/$/, '') ?? '';
    await sftp.put(Buffer.from(contents, 'utf8'), `${dir}/${fileName}`);
  } finally {
    await sftp.end();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reportCompany(admin: any, companyId: string) {
  const { data: cfg } = await admin
    .from('company_reporting_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (!cfg || !cfg.enabled || !cfg.sftp_host) {
    return { companyId, status: 'skipped', reason: 'not configured/enabled' };
  }

  // Atomically CLAIM the unreported buys by stamping reported_at as part of the
  // same UPDATE that returns them. A concurrent invocation (cron racing a
  // manual "Send now") running the identical update matches zero already-claimed
  // rows, so the same receipts can never be uploaded to the state twice.
  const claimedAt = new Date().toISOString();
  const { data: rows, error } = await admin
    .from('receipts')
    .update({ reported_at: claimedAt })
    .eq('company_id', companyId)
    .eq('type', 'buy')
    .is('reported_at', null)
    .select('*, line_items(metal_name, weight, total)')
    .order('created_at', { ascending: true });
  if (error) return { companyId, status: 'error', reason: error.message };
  if (!rows || rows.length === 0) {
    return { companyId, status: 'nothing-to-report', count: 0 };
  }

  const ids = rows.map((r: { id: string }) => r.id);
  const stamp = claimedAt.replace(/[:.]/g, '-');
  const fileName = `yardledger_${companyId}_${stamp}.csv`;

  try {
    await uploadViaSftp(cfg as ReportingConfig, fileName, buildCsv(rows));
  } catch (e) {
    // Upload failed — release the claim so these rows are retried next run.
    await admin.from('receipts').update({ reported_at: null }).in('id', ids);
    await admin.from('compliance_upload_log').insert({
      company_id: companyId,
      method: 'sftp',
      receipt_count: rows.length,
      status: 'failed',
      detail: `Upload failed: ${(e as Error).message}`,
    });
    return { companyId, status: 'error', reason: (e as Error).message };
  }

  await admin.from('compliance_upload_log').insert({
    company_id: companyId,
    method: 'sftp',
    receipt_count: ids.length,
    status: 'success',
    detail: `Uploaded ${fileName}`,
  });

  return { companyId, status: 'success', count: ids.length };
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const CRON_SECRET = Deno.env.get('CRON_SECRET');
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let companyIds: string[] = [];

  const cronHeader = req.headers.get('x-cron-secret');
  if (cronHeader !== null) {
    // Cron mode: require a configured, high-entropy secret and a constant-time
    // match. Fail closed — never fall through to another path when a cron
    // header is present but unverified.
    if (!CRON_SECRET || !timingSafeEqual(cronHeader, CRON_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }
    const { data } = await admin
      .from('company_reporting_config')
      .select('company_id')
      .eq('enabled', true);
    companyIds = (data ?? []).map((r: { company_id: string }) => r.company_id);
  } else {
    // Authenticated user → report their own company only.
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
    if (!profile || !['owner', 'admin'].includes(profile.role)) {
      return new Response('Forbidden', { status: 403 });
    }
    companyIds = [profile.company_id];
  }

  const results = [];
  for (const id of companyIds) results.push(await reportCompany(admin, id));

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
