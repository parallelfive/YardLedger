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

// IMPORTANT: keep this column set IN SYNC with the in-app exporter
// src/services/reports.ts (NMRLD_HEADERS + buildNmrldExportCsv) so the manual
// export and this automated SFTP upload file the IDENTICAL record.
const HEADERS = [
  'nmrld_registration_number',
  'receipt_number',
  'transaction_datetime',
  'seller_name',
  'seller_dob',
  'seller_address',
  'seller_city',
  'seller_state',
  'seller_zip',
  'seller_dl_number',
  'seller_dl_state',
  'seller_affirmed_ownership',
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'vehicle_color',
  'vehicle_plate',
  'transport_vin',
  'material',
  'weight_lb',
  'amount_paid',
  'payment_method',
  'is_catalytic_converter',
  'cat_converter_numbers',
  'hold_until',
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCsv(rows: any[], registrationNumber: string): string {
  const lines = [HEADERS.join(',')];
  for (const r of rows) {
    const items = r.line_items?.length ? r.line_items : [null];
    for (const li of items) {
      lines.push(
        [
          registrationNumber,
          r.receipt_number,
          r.created_at,
          r.seller_name,
          r.seller_dob,
          r.seller_address,
          r.seller_city,
          r.seller_state,
          r.seller_zip,
          r.seller_dl_number,
          r.seller_state_of_issue,
          r.seller_affirmed ? 'yes' : 'no',
          r.vehicle_year,
          r.vehicle_make,
          r.vehicle_model,
          r.vehicle_color,
          r.vehicle_plate,
          r.transport_vin,
          li?.metal_name ?? '',
          li?.weight ?? '',
          li ? li.total : r.subtotal,
          r.payment_method,
          r.is_catalytic ? 'yes' : 'no',
          r.cat_converter_numbers,
          r.hold_until,
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
  password: string,
  fileName: string,
  contents: string
): Promise<void> {
  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: cfg.sftp_host,
      port: cfg.sftp_port || 22,
      username: cfg.sftp_username,
      password,
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

  // Dealer registration number (identifies us in the state file).
  const { data: settings } = await admin
    .from('company_settings')
    .select('nmrld_registration_number')
    .eq('company_id', companyId)
    .maybeSingle();
  const registration = settings?.nmrld_registration_number ?? '';

  // The SFTP password is encrypted at rest in Vault; fetch the decrypted value
  // via the service_role-only RPC (never stored/returned in plaintext elsewhere).
  // Fetch BEFORE claiming rows so a missing credential skips without stamping.
  const { data: sftpPassword } = await admin.rpc('get_reporting_secret', {
    p_company_id: companyId,
  });
  if (!sftpPassword) {
    return { companyId, status: 'skipped', reason: 'no SFTP credentials set' };
  }

  // Which unreported buys must be reported (per RLD, 2026-07-23): regulated
  // material EXCEPT aluminum/steel below one ton — copper/brass/bronze/lead/
  // catalytic/restricted always; aluminum/steel only at >= 1 ton or riding along
  // on a receipt that has another reportable line. MUST stay in sync with the
  // in-app helper src/utils/reporting.ts.
  const REPORT_MIN_LBS = 2000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineReportable = (li: any): boolean => {
    if (li.is_restricted) return true;
    if (!li.is_regulated) return false;
    if (li.metals?.is_report_exempt)
      return Number(li.weight ?? 0) >= REPORT_MIN_LBS;
    return true;
  };
  const { data: candidates, error: candErr } = await admin
    .from('receipts')
    .select(
      'id, is_catalytic, line_items(is_restricted, is_regulated, weight, metals(is_report_exempt))'
    )
    .eq('company_id', companyId)
    .eq('type', 'buy')
    .is('reported_at', null);
  if (candErr) return { companyId, status: 'error', reason: candErr.message };
  const reportableIds = (candidates ?? [])
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => !!r.is_catalytic || (r.line_items ?? []).some(lineReportable)
    )
    .map((r: { id: string }) => r.id);
  if (reportableIds.length === 0) {
    return { companyId, status: 'nothing-to-report', count: 0 };
  }

  // Atomically CLAIM the reportable buys by stamping reported_at in the same
  // UPDATE that returns them. The `.is('reported_at', null)` guard is kept, so a
  // concurrent invocation (cron racing a manual "Send now") matches zero
  // already-claimed rows — the same receipts can never be uploaded twice.
  const claimedAt = new Date().toISOString();
  const { data: rows, error } = await admin
    .from('receipts')
    .update({ reported_at: claimedAt })
    .in('id', reportableIds)
    .eq('company_id', companyId)
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
    await uploadViaSftp(
      cfg as ReportingConfig,
      sftpPassword as string,
      fileName,
      buildCsv(rows, registration)
    );
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
