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

// ── Jurisdiction registry (Deno) ────────────────────────────────────────────
// Deno can't import the app's src/compliance/jurisdictions, so the per-state
// rules are MIRRORED here. Adding a state = add an entry below AND a module in
// the app; keep the two in sync (same reportability rule + column layout).
// getJurisdiction(company_settings.state) selects it; unknown/unset → NM.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface Jurisdiction {
  code: string;
  registry: string;
  headers: string[];
  // Is a single line reportable to the state registry?
  lineReportable: (li: any) => boolean;
  // One CSV row's cells for a (receipt, line) pair.
  buildRow: (r: any, li: any, registration: string) => unknown[];
}

const NM: Jurisdiction = {
  code: 'NM',
  registry: 'LeadsOnline',
  headers: [
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
    'seller_affirmed_no_theft',
    'vehicle_year',
    'vehicle_make',
    'vehicle_model',
    'vehicle_color',
    'vehicle_plate',
    'transport_vin',
    'material',
    'weight_lb',
    'quantity_pieces',
    'amount_paid',
    'payment_method',
    'is_catalytic_converter',
    'cat_converter_numbers',
    'hold_until',
  ],
  // Regulated material except aluminum/steel under one ton; restricted always.
  lineReportable: (li: any) => {
    if (li.is_restricted) return true;
    if (!li.is_regulated) return false;
    if (li.metals?.is_report_exempt) return Number(li.weight ?? 0) >= 2000;
    return true;
  },
  buildRow: (r: any, li: any, registration: string) => [
    registration,
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
    r.seller_no_theft_affirmed ? 'yes' : 'no',
    r.vehicle_year,
    r.vehicle_make,
    r.vehicle_model,
    r.vehicle_color,
    r.vehicle_plate,
    r.transport_vin,
    li?.metal_name ?? '',
    li?.unit === 'each' ? '' : (li?.weight ?? ''),
    li?.unit === 'each' ? (li?.quantity ?? '') : '',
    li ? li.total : r.subtotal,
    r.payment_method,
    r.is_catalytic ? 'yes' : 'no',
    r.cat_converter_numbers,
    r.hold_until,
  ],
};

const JURISDICTIONS: Record<string, Jurisdiction> = { NM };

function getJurisdiction(state?: string | null): Jurisdiction {
  const key = (state ?? '').trim().toUpperCase();
  return JURISDICTIONS[key] ?? JURISDICTIONS.NM;
}

// A receipt is reportable if it's catalytic or has any reportable line.
function receiptReportable(j: Jurisdiction, r: any): boolean {
  return !!r.is_catalytic || (r.line_items ?? []).some(j.lineReportable);
}

function buildCsv(j: Jurisdiction, rows: any[], registration: string): string {
  const lines = [j.headers.join(',')];
  for (const r of rows) {
    const items = r.line_items?.length ? r.line_items : [null];
    for (const li of items) {
      lines.push(j.buildRow(r, li, registration).map(csvCell).join(','));
    }
  }
  return lines.join('\n');
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

  // Dealer registration number + the company's compliance jurisdiction (which
  // state's reportability rule + file format to use). Unknown/unset → NM.
  const { data: settings } = await admin
    .from('company_settings')
    .select('nmrld_registration_number, state')
    .eq('company_id', companyId)
    .maybeSingle();
  const registration = settings?.nmrld_registration_number ?? '';
  const jurisdiction = getJurisdiction(settings?.state);

  // The SFTP password is encrypted at rest in Vault; fetch the decrypted value
  // via the service_role-only RPC (never stored/returned in plaintext elsewhere).
  // Fetch BEFORE claiming rows so a missing credential skips without stamping.
  const { data: sftpPassword } = await admin.rpc('get_reporting_secret', {
    p_company_id: companyId,
  });
  if (!sftpPassword) {
    return { companyId, status: 'skipped', reason: 'no SFTP credentials set' };
  }

  // Which unreported buys must be reported is the jurisdiction's call (the NM
  // rule: regulated except aluminum/steel under a ton; restricted/catalytic
  // always). MUST stay in sync with src/compliance/jurisdictions.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => receiptReportable(jurisdiction, r))
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
    .select('*, line_items(metal_name, weight, total, unit, quantity)')
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
      buildCsv(jurisdiction, rows, registration)
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

// Dry-run: connect to the yard's SFTP and list the remote dir WITHOUT uploading
// or stamping anything — so an operator can confirm credentials before flipping
// reporting on. Doesn't require `enabled` (you test before enabling).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function testConnection(admin: any, companyId: string) {
  const { data: cfg } = await admin
    .from('company_reporting_config')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (!cfg || !cfg.sftp_host) {
    return { ok: false, detail: 'No SFTP host configured yet.' };
  }
  const { data: pw } = await admin.rpc('get_reporting_secret', {
    p_company_id: companyId,
  });
  if (!pw) return { ok: false, detail: 'No SFTP password saved yet.' };

  const sftp = new SftpClient();
  try {
    await sftp.connect({
      host: cfg.sftp_host,
      port: cfg.sftp_port || 22,
      username: cfg.sftp_username,
      password: pw as string,
    });
    const dir = cfg.remote_dir?.replace(/\/$/, '') || '.';
    await sftp.list(dir);
    return {
      ok: true,
      detail: `Connected to ${cfg.sftp_host}, listed "${dir}".`,
    };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  } finally {
    try {
      await sftp.end();
    } catch {
      /* ignore close errors */
    }
  }
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
    const { data, error } = await admin
      .from('company_reporting_config')
      .select('company_id')
      .eq('enabled', true);
    // Fail loud — an empty list from a query error would look like "no company
    // needs reporting" while the whole scheduled run silently skipped (#78).
    if (error) {
      return new Response(
        JSON.stringify({
          error: `Failed to list reporting configs: ${error.message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
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
    // Test mode (?test=1): dry-run the SFTP connection, never upload.
    if (new URL(req.url).searchParams.get('test') === '1') {
      // Always 200 — the pass/fail is in the body so the client reads the detail
      // instead of a bare HTTP error.
      const result = await testConnection(admin, profile.company_id);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    companyIds = [profile.company_id];
  }

  const results = [];
  for (const id of companyIds) results.push(await reportCompany(admin, id));

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
