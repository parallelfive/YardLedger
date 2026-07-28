import { supabase } from '../config/supabase';

// Non-secret reporting config (the SFTP password is write-only and never
// returned — only `has_credentials` indicates whether one is stored).
export interface ReportingConfig {
  provider: string;
  sftp_host: string;
  sftp_port: number;
  sftp_username: string;
  remote_dir: string;
  enabled: boolean;
  has_credentials: boolean;
}

export async function getReportingConfig(): Promise<ReportingConfig | null> {
  const { data, error } = await supabase.rpc('get_reporting_config');
  if (error) throw error;
  return (data?.[0] as ReportingConfig | undefined) ?? null;
}

export async function saveReportingConfig(cfg: {
  provider?: string;
  sftpHost: string;
  sftpPort: number;
  sftpUsername: string;
  sftpPassword: string; // blank leaves the stored password unchanged
  remoteDir: string;
  enabled: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('upsert_reporting_config', {
    p_provider: cfg.provider ?? 'leadsonline',
    p_sftp_host: cfg.sftpHost,
    p_sftp_port: cfg.sftpPort,
    p_sftp_username: cfg.sftpUsername,
    p_sftp_password: cfg.sftpPassword,
    p_remote_dir: cfg.remoteDir,
    p_enabled: cfg.enabled,
  });
  if (error) throw error;
}

// Most recent automated-upload attempt for this company (RLS-scoped), so the
// UI can show "last sent / last failed" without exposing another company's log.
export interface ComplianceUploadLogEntry {
  id: string;
  method: string;
  receipt_count: number;
  status: string; // 'success' | 'failed'
  detail: string | null;
  created_at: string;
}

export async function fetchLastComplianceUpload(): Promise<ComplianceUploadLogEntry | null> {
  const { data, error } = await supabase
    .from('compliance_upload_log')
    .select('id, method, receipt_count, status, detail, created_at')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0] as ComplianceUploadLogEntry | undefined) ?? null;
}

// Trigger an immediate upload of this company's unreported transactions.
export async function sendReportNow(): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('report-to-state');
  if (error) throw error;
  return data;
}

// Dry-run the SFTP connection (connect + list remote dir, no upload) so an
// operator can confirm credentials before enabling automated reporting.
export async function testReportingConnection(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const { data, error } = await supabase.functions.invoke(
    'report-to-state?test=1'
  );
  if (error) return { ok: false, detail: (error as Error).message };
  return data as { ok: boolean; detail: string };
}
