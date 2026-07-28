import { useEffect, useMemo, useState } from 'react';
import {
  fetchComplianceReport,
  fetchUnreportedReceipts,
  buildNmrldExportCsv,
  fetchNmrldRegistrationNumber,
  fetchCompanyTimezone,
  fetchCompanyState,
  markReceiptsReported,
  type ComplianceReceiptRow,
} from '../../services/reports';
import {
  getJurisdiction,
  type Jurisdiction,
} from '../../compliance/jurisdictions';
import {
  getReportingConfig,
  saveReportingConfig,
  testReportingConnection,
  fetchLastComplianceUpload,
  sendReportNow,
  type ReportingConfig,
  type ComplianceUploadLogEntry,
} from '../../services/reporting';
import { shareTextFile } from '../../utils/shareFile';
import { useAppSelector, type RootState } from '../../store';
import { useDeskAdmin } from '../AdminActions';
import { printComplianceRecord } from '../print';
import Icon, { type IconName } from '../Icon';
import { receiptIsReportable } from '../../utils/reporting';
import {
  Card,
  Banner,
  PanelHead,
  Table,
  TR,
  Pill,
  Btn,
  Field,
  TextInput,
  Segmented,
  GroupLabel,
  SlideOver,
  SlideHead,
  money,
  lbs,
  type Col,
} from '../ui';
import { signPrivatePath } from '../../services/storage';

// 'Outstanding' is date-unbounded — every unreported buy, so an old one that
// fell outside Today/Week/Month (e.g. missed over a month rollover) is still
// reachable and filable. Without it the rail's "N to report" badge could count
// buys this screen could never actually display or export (#64).
const COMP_RANGES = ['Today', 'Week', 'Month', 'Outstanding'] as const;
type Range = (typeof COMP_RANGES)[number];
type Filter = 'all' | 'queued' | 'restricted';

// Local 'YYYY-MM-DD' from a Date.
const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const rangeDates = (range: Range): { start: string; end: string } => {
  const now = new Date();
  const end = ymd(now);
  if (range === 'Today') return { start: end, end };
  if (range === 'Week') {
    const s = new Date(now);
    s.setDate(s.getDate() - 6);
    return { start: ymd(s), end };
  }
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: ymd(s), end };
};

// Derived per-record view-model from a ComplianceReceiptRow.
interface RecordVM {
  id: string;
  no: string;
  seller: string;
  dob: string;
  address: string;
  dl: string;
  plate: string;
  vehicle: string;
  materials: string;
  weight: number;
  pieces: number;
  paid: number;
  restricted: boolean; // material TYPE (burnt/utility/catalytic) — for the filter
  reportable: boolean; // state-reporting obligation (Kennon rule) — for the queue
  reported: boolean;
  affirmed: boolean;
  pay: string;
  // Evidence photo paths (private bucket) — signed on demand in the slide-over.
  photos: { label: string; path: string }[];
}

const toVM = (r: ComplianceReceiptRow): RecordVM => {
  const items = r.line_items ?? [];
  const vehicle =
    [r.vehicle_year, r.vehicle_make, r.vehicle_model]
      .filter(Boolean)
      .join(' ') || '—';
  return {
    id: r.id,
    no: r.receipt_number,
    seller: r.seller_name || r.customer_name || 'Walk-in',
    dob: r.seller_dob || '—',
    address:
      [
        r.seller_address,
        [r.seller_city, r.seller_state, r.seller_zip].filter(Boolean).join(' '),
      ]
        .filter(Boolean)
        .join(', ') || '—',
    dl: r.seller_dl_number || '—',
    plate: r.vehicle_plate || '—',
    vehicle,
    materials: items
      .map((li) =>
        li.unit === 'each'
          ? `${li.metal_name} (${Number(li.quantity || 0)} pc${Number(li.quantity) === 1 ? '' : 's'})`
          : `${li.metal_name} (${lbs(li.weight)} lb)`
      )
      .join(', '),
    weight: items.reduce((a, li) => a + Number(li.weight || 0), 0),
    pieces: items.reduce(
      (a, li) => a + (li.unit === 'each' ? Number(li.quantity || 0) : 0),
      0
    ),
    paid: Number(r.subtotal || 0),
    restricted: items.some((li) => li.is_restricted) || !!r.is_catalytic,
    reportable: receiptIsReportable(r),
    reported: !!r.reported_at,
    affirmed: !!r.seller_affirmed,
    pay: r.payment_method || '—',
    photos: (
      [
        ['ID scan', r.seller_id_photo_uri],
        ['Driver license', r.dl_photo_uri],
        ['Seller', r.seller_photo_uri],
        ['Material', r.material_photo_uri],
        ['Converter', r.cat_converter_photo_uri],
        ['Title', r.cat_title_photo_uri],
        ['Signature', r.signature_uri],
      ] as [string, string | null][]
    )
      .filter((p): p is [string, string] => !!p[1])
      .map(([label, path]) => ({ label, path })),
  };
};

// Compliance evidence photos live in a private bucket as object PATHS; mint a
// short-lived signed URL per photo at render time (#107 — the panel used to show
// hardcoded placeholders instead of the stored evidence).
function CompliancePhotos({
  photos,
}: {
  photos: { label: string; path: string }[];
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let active = true;
    Promise.all(
      photos.map(async (p) => [p.label, await signPrivatePath(p.path)] as const)
    ).then((pairs) => {
      if (active) setUrls(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [photos]);

  if (photos.length === 0) {
    return (
      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        No photos captured for this record.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {photos.map((p) => {
        const url = urls[p.label];
        return (
          <div key={p.label} style={{ width: 104 }}>
            <div
              style={{
                height: 88,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {url === undefined ? (
                <span
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-3)' }}
                >
                  …
                </span>
              ) : url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', width: '100%', height: '100%' }}
                >
                  <img
                    src={url}
                    alt={p.label}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </a>
              ) : (
                <span
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-3)' }}
                >
                  unavailable
                </span>
              )}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                color: 'var(--ink-3)',
                marginTop: 5,
                textAlign: 'center',
              }}
            >
              {p.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExportTile({
  icon,
  tone,
  label,
  sub,
  locked,
  onClick,
}: {
  icon: IconName;
  tone: string;
  label: string;
  sub: string;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className="tap lift"
      onClick={onClick}
      disabled={locked}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '13px 15px',
        borderRadius: 13,
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        boxShadow: 'var(--shadow)',
        textAlign: 'left',
        opacity: locked ? 0.55 : 1,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `color-mix(in oklab, ${tone} 14%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon
          name={locked ? 'lock' : icon}
          size={18}
          color={tone}
          stroke={1.9}
        />
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 650,
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}
        >
          {sub}
        </div>
      </div>
    </button>
  );
}

export default function Compliance({ canReport }: { canReport: boolean }) {
  const [range, setRange] = useState<Range>('Today');
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<RecordVM | null>(null);
  const [records, setRecords] = useState<ComplianceReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  // Active compliance jurisdiction (from company_settings.state); NM until loaded.
  const [jur, setJur] = useState<Jurisdiction>(() => getJurisdiction());
  const { ensureElevated } = useDeskAdmin();
  const userId = useAppSelector(
    (s: RootState) => s.auth.activeIdentity?.user_id ?? s.auth.profile?.id ?? ''
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 'Outstanding' loads every unreported buy (date-unbounded); the fixed
    // ranges load that calendar window.
    const load =
      range === 'Outstanding'
        ? fetchUnreportedReceipts()
        : (() => {
            const { start, end } = rangeDates(range);
            return fetchComplianceReport(start, end);
          })();
    load
      .then((rows) => {
        if (!cancelled) setRecords(rows);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, reloadTick]);

  const vms = useMemo(() => records.map(toVM), [records]);
  // The state-reporting queue: buys that must reach LeadsOnline (the Kennon rule
  // — regulated material minus below-a-ton aluminum/steel) and aren't reported
  // yet. Matches the rail badge (DesktopShell) and the report-to-state edge fn.
  const queued = useMemo(
    () => vms.filter((r) => r.reportable && !r.reported),
    [vms]
  );
  const sent = useMemo(() => vms.filter((r) => r.reported), [vms]);
  const restrictedRows = useMemo(() => vms.filter((r) => r.restricted), [vms]);

  const rows =
    filter === 'queued'
      ? queued
      : filter === 'restricted'
        ? restrictedRows
        : vms;

  // Export the NMRLD upload CSV. It must contain ONLY the buys that will be
  // marked reported (reportable & unreported = the queue) — building it from
  // every record in range would re-file already-reported rows on a repeat
  // export, double-filing them to the state.
  // Returns true only if the file was actually produced/shared, so the caller
  // never stamps receipts "reported" after a failed or cancelled export (#47).
  const exportCsv = async (): Promise<boolean> => {
    try {
      const queuedIds = new Set(queued.map((r) => r.id));
      const toFile = records.filter((r) => queuedIds.has(r.id));
      const [registration, timezone] = await Promise.all([
        fetchNmrldRegistrationNumber(),
        fetchCompanyTimezone(),
      ]);
      const csv = buildNmrldExportCsv(toFile, registration, timezone);
      await shareTextFile(
        'compliance.csv',
        csv,
        'text/csv',
        'public.comma-separated-values-text'
      );
      return true;
    } catch {
      return false;
    }
  };

  // Stamp the given buys as reported to the state (after export/upload) so they
  // leave the queue. Admin-gated — prompts for the PIN via the elevation flow.
  const [reporting, setReporting] = useState(false);
  const markReported = async (ids: string[]) => {
    if (ids.length === 0 || reporting) return;
    if (!(await ensureElevated())) return;
    setReporting(true);
    try {
      await markReceiptsReported(ids, userId);
      setSel(null);
      setReloadTick((t) => t + 1);
    } catch {
      /* best effort */
    } finally {
      setReporting(false);
    }
  };

  // "Export & mark reported": download the CSV, then — ONLY if it actually
  // exported — flag the buys that were in the reporting queue. A cancelled or
  // failed export must not stamp records reported (#47).
  const exportAndReport = async () => {
    const ok = await exportCsv();
    if (!ok) return;
    await markReported(queued.map((r) => r.id));
  };

  // ── Automated SFTP send (LeadsOnline) — separate from the manual CSV path ──
  // Connection status + last upload, loaded on mount and refreshed after a send.
  const [repCfg, setRepCfg] = useState<ReportingConfig | null>(null);
  const [lastUpload, setLastUpload] = useState<ComplianceUploadLogEntry | null>(
    null
  );
  const [sendOpen, setSendOpen] = useState(false); // confirm modal
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  const loadReportingStatus = async () => {
    try {
      const [cfg, last, state] = await Promise.all([
        getReportingConfig(),
        fetchLastComplianceUpload(),
        fetchCompanyState(),
      ]);
      setRepCfg(cfg);
      setLastUpload(last);
      setJur(getJurisdiction(state));
    } catch {
      /* status is best-effort; the manual export path never depends on it */
    }
  };
  useEffect(() => {
    loadReportingStatus();
  }, [reloadTick]);

  // A send is only offered when reporting is actually wired up AND enabled —
  // so nothing can transmit by accident. The confirm modal is the final gate.
  const canSend =
    canReport &&
    !!repCfg?.enabled &&
    !!repCfg?.has_credentials &&
    queued.length > 0;

  const doSend = async () => {
    if (!canSend || sending) return;
    if (!(await ensureElevated())) return;
    setSending(true);
    setSendMsg(null);
    try {
      await sendReportNow();
      setSendOpen(false);
      setReloadTick((t) => t + 1); // reloads records + status
      setSendMsg('Uploaded to ' + jur.copy.registry + '.');
    } catch (e) {
      setSendMsg((e as Error).message || 'Upload failed.');
    } finally {
      setSending(false);
    }
  };

  // ── SFTP connection editor (owner-gated) — set up the registry connection
  // from the desktop terminal (previously mobile-only). Password is write-only.
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgHost, setCfgHost] = useState('');
  const [cfgPort, setCfgPort] = useState('22');
  const [cfgUser, setCfgUser] = useState('');
  const [cfgPass, setCfgPass] = useState('');
  const [cfgDir, setCfgDir] = useState('');
  const [cfgEnabled, setCfgEnabled] = useState(false);
  const [cfgBusy, setCfgBusy] = useState(false);
  const [cfgMsg, setCfgMsg] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const openConfig = async () => {
    if (!(await ensureElevated(true))) return; // owner only
    setCfgHost(repCfg?.sftp_host ?? '');
    setCfgPort(String(repCfg?.sftp_port ?? 22));
    setCfgUser(repCfg?.sftp_username ?? '');
    setCfgPass(''); // never round-trips; blank keeps the stored secret
    setCfgDir(repCfg?.remote_dir ?? '');
    setCfgEnabled(!!repCfg?.enabled);
    setCfgMsg(null);
    setCfgOpen(true);
  };

  const saveConfig = async () => {
    if (cfgBusy) return;
    setCfgBusy(true);
    setCfgMsg(null);
    try {
      await saveReportingConfig({
        sftpHost: cfgHost.trim(),
        sftpPort: parseInt(cfgPort, 10) || 22,
        sftpUsername: cfgUser.trim(),
        sftpPassword: cfgPass, // blank leaves the stored password unchanged
        remoteDir: cfgDir.trim(),
        enabled: cfgEnabled,
      });
      setCfgOpen(false);
      setReloadTick((t) => t + 1);
    } catch (e) {
      setCfgMsg((e as Error).message || 'Could not save.');
    } finally {
      setCfgBusy(false);
    }
  };

  // Dry-run the connection. Save first (so the edge fn tests the current values),
  // then connect + list without uploading.
  const testConfig = async () => {
    if (testing || cfgBusy) return;
    setTesting(true);
    setCfgMsg('Saving & testing…');
    try {
      await saveReportingConfig({
        sftpHost: cfgHost.trim(),
        sftpPort: parseInt(cfgPort, 10) || 22,
        sftpUsername: cfgUser.trim(),
        sftpPassword: cfgPass,
        remoteDir: cfgDir.trim(),
        enabled: cfgEnabled,
      });
      setCfgPass(''); // saved; don't keep it in the field
      const res = await testReportingConnection();
      setCfgMsg((res.ok ? '✓ ' : '✕ ') + res.detail);
      setReloadTick((t) => t + 1);
    } catch (e) {
      setCfgMsg('✕ ' + ((e as Error).message || 'Test failed.'));
    } finally {
      setTesting(false);
    }
  };

  const cols: Col[] = [
    { key: 'no', label: 'Receipt', w: '1.5fr' },
    { key: 'seller', label: 'Seller · ID', w: '1.6fr' },
    { key: 'vehicle', label: 'Vehicle · Plate', w: '1.6fr' },
    { key: 'materials', label: 'Materials', w: '2.2fr' },
    { key: 'weight', label: 'Weight', w: '0.8fr', align: 'right' },
    { key: 'paid', label: 'Paid', w: '0.9fr', align: 'right' },
    { key: 'status', label: 'State report', w: '1.1fr', align: 'right' },
  ];

  return (
    <div
      className="stagger in"
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      {/* top: report hub + pipeline */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)',
          gap: 16,
        }}
      >
        <Card
          pad={0}
          style={{
            overflow: 'hidden',
            border:
              '1px solid color-mix(in oklab, var(--gold) 30%, var(--line))',
          }}
        >
          <div
            style={{
              padding: '20px 22px',
              background: 'color-mix(in oklab, var(--gold) 8%, var(--surface))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Icon name="upload" size={20} color="var(--gold)" stroke={2} />
                <span
                  className="exp"
                  style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}
                >
                  State reporting
                </span>
              </div>
              <Pill tone="var(--rust)" icon="clock">
                due {jur.copy.reportBy}
              </Pill>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                marginTop: 14,
              }}
            >
              <span
                className="exp num"
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: 'var(--gold)',
                  letterSpacing: -1.2,
                }}
              >
                {queued.length}
              </span>
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--ink-2)',
                  fontWeight: 550,
                  lineHeight: 1.3,
                }}
              >
                buy awaiting upload to
                <br />
                <b style={{ color: 'var(--ink)' }}>{jur.copy.registry}</b>
              </span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}
            >
              {jur.copy.act} · {jur.copy.stateName}
            </div>
          </div>
          <button
            className="tap"
            disabled={!canReport || reporting}
            onClick={canReport ? exportAndReport : undefined}
            style={{
              width: '100%',
              padding: '15px',
              background: canReport ? 'var(--gold)' : 'var(--chip)',
              color: canReport ? '#fff' : 'var(--ink-3)',
              fontSize: 15,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Icon
              name={canReport ? 'upload' : 'lock'}
              size={18}
              color={canReport ? '#fff' : 'var(--ink-3)'}
              stroke={2.2}
            />
            {canReport ? 'Export & mark reported' : 'Admin required to upload'}
          </button>
        </Card>

        <Card>
          <PanelHead
            title="Reporting pipeline"
            sub={`${range} · ${jur.copy.registry}`}
            icon="shield"
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 18,
            }}
          >
            {(
              [
                ['Captured', vms.length, 'var(--ink-3)'],
                ['Queued', queued.length, 'var(--gold)'],
                ['Reported', sent.length, 'var(--moss)'],
              ] as [string, number, string][]
            ).map((s, i, a) => (
              <div key={s[0]} style={{ display: 'contents' }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '6px 0' }}>
                  <div
                    className="exp num"
                    style={{
                      fontSize: 28,
                      fontWeight: 800,
                      color: s[2],
                      letterSpacing: -0.5,
                    }}
                  >
                    {s[1]}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 9.5,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                      marginTop: 3,
                    }}
                  >
                    {s[0]}
                  </div>
                </div>
                {i < a.length - 1 && (
                  <Icon name="chev" size={15} color="var(--ink-3)" stroke={2} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <ExportTile
              icon="printer"
              tone="var(--accent)"
              label="Purchase record"
              sub="Print / PDF"
              onClick={exportCsv}
            />
            <ExportTile
              icon="download"
              tone="var(--teal)"
              label="Export CSV"
              sub="Spreadsheet"
              onClick={exportCsv}
            />
            <ExportTile
              icon="upload"
              tone="var(--gold)"
              label="State upload"
              sub={canReport ? jur.copy.registry : 'Admin only'}
              locked={!canReport}
              onClick={canReport ? exportCsv : undefined}
            />
          </div>
        </Card>
      </div>

      {/* automated-send connection: status + manual "Send now" (no cron) */}
      {(() => {
        const configured = !!repCfg?.has_credentials;
        const on = configured && !!repCfg?.enabled;
        const dot = on
          ? 'var(--moss)'
          : configured
            ? 'var(--gold)'
            : 'var(--ink-3)';
        const statusText = on
          ? `Connected · ${repCfg?.provider || jur.copy.registry} SFTP`
          : configured
            ? 'Connection set up · disabled'
            : 'Automatic upload not set up';
        const last = lastUpload
          ? (lastUpload.status === 'success'
              ? `Last sent ${lastUpload.receipt_count} receipt${lastUpload.receipt_count === 1 ? '' : 's'}`
              : 'Last attempt failed') +
            ' · ' +
            new Date(lastUpload.created_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : 'No uploads yet';
        return (
          <Card
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 99,
                    background: dot,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{ fontSize: 14, fontWeight: 650, color: 'var(--ink)' }}
                >
                  {statusText}
                </span>
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}
              >
                {last} · automatic upload is off — sends are manual
              </div>
              {sendMsg && (
                <div
                  style={{
                    fontSize: 12,
                    color: sendMsg.toLowerCase().includes('fail')
                      ? 'var(--rust)'
                      : 'var(--moss)',
                    marginTop: 6,
                    fontWeight: 600,
                  }}
                >
                  {sendMsg}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              {canReport && (
                <Btn variant="ghost" icon="cog" onClick={openConfig}>
                  {configured ? 'Edit connection' : 'Set up connection'}
                </Btn>
              )}
              <Btn
                variant={canSend ? 'solid' : 'ghost'}
                tone="var(--gold)"
                icon="upload"
                disabled={!canSend}
                onClick={() => setSendOpen(true)}
              >
                {!configured
                  ? 'Not configured'
                  : !repCfg?.enabled
                    ? 'Disabled'
                    : queued.length === 0
                      ? 'Nothing to send'
                      : `Send ${queued.length} now`}
              </Btn>
            </div>
          </Card>
        );
      })()}

      {/* deadline strip */}
      {queued.length > 0 && (
        <Banner
          body="ink"
          icon="alert"
          action={
            <Btn
              variant="solid"
              size="sm"
              tone="var(--rust)"
              icon="chev"
              onClick={() => setFilter('queued')}
            >
              Review queue
            </Btn>
          }
        >
          <b style={{ color: 'var(--ink)' }}>
            {queued.length} unreported transaction
            {queued.length === 1 ? '' : 's'}
          </b>{' '}
          with regulated material must reach {jur.copy.registry} by the{' '}
          {jur.copy.reportBy}.
        </Banner>
      )}

      {/* records table */}
      <Card pad={0}>
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <PanelHead
            title="Purchase records"
            sub={`Audit trail · ${range}`}
            icon="reports"
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Segmented
              size="sm"
              value={filter}
              options={[
                { v: 'all', label: 'All' },
                { v: 'queued', label: `Queued · ${queued.length}` },
                {
                  v: 'restricted',
                  label: `Restricted · ${restrictedRows.length}`,
                },
              ]}
              onChange={setFilter}
            />
            <Segmented
              size="sm"
              value={range}
              options={COMP_RANGES as unknown as Range[]}
              onChange={setRange}
            />
          </div>
        </div>
        {loading ? (
          <div
            className="mono"
            style={{
              padding: '8px 20px 26px',
              fontSize: 12.5,
              color: 'var(--ink-3)',
            }}
          >
            Loading purchase records…
          </div>
        ) : rows.length === 0 ? (
          <div
            className="mono"
            style={{
              padding: '8px 20px 26px',
              fontSize: 12.5,
              color: 'var(--ink-3)',
            }}
          >
            No purchase records for this range.
          </div>
        ) : (
          <Table cols={cols}>
            {rows.map((r) => (
              <TR
                key={r.no}
                cols={cols}
                onClick={() => setSel(r)}
                active={!!sel && sel.no === r.no}
                accent={r.restricted ? 'var(--rust)' : 'transparent'}
                cells={[
                  <span
                    key="no"
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ink-2)',
                      fontWeight: 600,
                    }}
                  >
                    {r.no}
                  </span>,
                  <div key="seller" style={{ minWidth: 0 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <span
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: 'var(--ink)',
                        }}
                      >
                        {r.seller}
                      </span>
                      {r.restricted && (
                        <Icon
                          name="alert"
                          size={12}
                          color="var(--rust)"
                          stroke={2.2}
                        />
                      )}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: 'var(--ink-3)',
                        marginTop: 1,
                      }}
                    >
                      {r.dl}
                    </div>
                  </div>,
                  <div key="vehicle" style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      {r.vehicle}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: 'var(--ink-3)',
                        marginTop: 1,
                      }}
                    >
                      {r.plate}
                    </div>
                  </div>,
                  <span
                    key="materials"
                    style={{
                      fontSize: 12,
                      color: 'var(--ink-2)',
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.materials}
                  </span>,
                  <span
                    key="weight"
                    className="mono num"
                    style={{ fontSize: 12.5, color: 'var(--ink-2)' }}
                  >
                    {r.weight > 0 || r.pieces === 0
                      ? `${lbs(r.weight)} lb`
                      : `${r.pieces} pcs`}
                  </span>,
                  <span
                    key="paid"
                    className="mono num"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {money(r.paid)}
                  </span>,
                  <Pill
                    key="status"
                    tone={
                      r.reported
                        ? 'var(--moss)'
                        : r.reportable
                          ? 'var(--gold)'
                          : 'var(--ink-3)'
                    }
                    icon={r.reported ? 'check' : r.reportable ? 'clock' : 'x'}
                  >
                    {r.reported
                      ? 'Reported'
                      : r.reportable
                        ? 'Queued'
                        : 'Not required'}
                  </Pill>,
                ]}
              />
            ))}
          </Table>
        )}
      </Card>

      {/* record detail */}
      <SlideOver open={!!sel} onClose={() => setSel(null)} width={500}>
        {sel && (
          <>
            <SlideHead
              title={sel.seller}
              sub={sel.no}
              onClose={() => setSel(null)}
              icon="receipt"
              tone={sel.restricted ? 'var(--rust)' : 'var(--accent)'}
            />
            <div
              className="screen-scroll"
              style={{
                flex: 1,
                // A flex:1 scroll child needs an explicit overflow + min-height:0,
                // or it grows to fit its content and pushes the footer off-screen
                // instead of scrolling (#98).
                overflowY: 'auto',
                minHeight: 0,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', gap: 10 }}>
                <Pill
                  tone={sel.reported ? 'var(--moss)' : 'var(--gold)'}
                  icon={sel.reported ? 'check' : 'clock'}
                >
                  {sel.reported ? 'Reported to state' : 'Awaiting report'}
                </Pill>
                {sel.restricted && (
                  <Pill tone="var(--rust)" icon="shield">
                    Restricted
                  </Pill>
                )}
                <Pill
                  tone={sel.affirmed ? 'var(--ink-3)' : 'var(--rust)'}
                  icon={sel.affirmed ? 'check' : 'x'}
                >
                  {sel.affirmed ? 'Affirmed' : 'No affirm'}
                </Pill>
              </div>
              <Card pad={18}>
                <PanelHead title="Seller record" />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '13px 16px',
                  }}
                >
                  {(
                    [
                      ['Date of birth', sel.dob],
                      ['Driver license', sel.dl],
                      ['Address', sel.address],
                      ['Plate', sel.plate],
                      ['Vehicle', sel.vehicle],
                      ['Payment', sel.pay],
                      ...((sel.weight > 0 || sel.pieces === 0
                        ? [['Weight', lbs(sel.weight) + ' lb']]
                        : []) as [string, string][]),
                      ...((sel.pieces > 0
                        ? [['Pieces', `${sel.pieces} pcs`]]
                        : []) as [string, string][]),
                      ['Paid', money(sel.paid)],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <div key={k}>
                      <div
                        className="mono"
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          color: 'var(--ink-3)',
                        }}
                      >
                        {k}
                      </div>
                      <div
                        className="mono num"
                        style={{
                          fontSize: 13,
                          color: 'var(--ink)',
                          marginTop: 3,
                          fontWeight: 600,
                        }}
                      >
                        {v}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <Card pad={18}>
                <PanelHead title="Materials purchased" />
                <div
                  style={{
                    fontSize: 13.5,
                    color: 'var(--ink-2)',
                    lineHeight: 1.6,
                  }}
                >
                  {sel.materials || '—'}
                </div>
              </Card>
              <Card pad={16}>
                <GroupLabel style={{ marginBottom: 10 }}>
                  Compliance photos
                </GroupLabel>
                <CompliancePhotos photos={sel.photos} />
              </Card>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn
                  variant="primary"
                  icon="printer"
                  full
                  onClick={() =>
                    printComplianceRecord({
                      no: sel.no,
                      seller: sel.seller,
                      dl: sel.dl,
                      plate: sel.plate,
                      vehicle: sel.vehicle,
                      materials: sel.materials,
                      weight: sel.weight,
                      pieces: sel.pieces,
                      paid: sel.paid,
                      pay: sel.pay,
                      affirmed: sel.affirmed,
                    }).catch(() => {})
                  }
                >
                  Print record
                </Btn>
                {!sel.reported && canReport && (
                  <Btn
                    variant="solid"
                    tone="var(--gold)"
                    icon="upload"
                    full
                    onClick={() => markReported([sel.id])}
                  >
                    Report now
                  </Btn>
                )}
              </div>
            </div>
          </>
        )}
      </SlideOver>

      {/* SFTP connection editor (owner-gated). Password is write-only — leave it
          blank to keep the stored one. "Test" saves + dry-runs the connection. */}
      {cfgOpen && (
        <div
          onClick={() => !cfgBusy && !testing && setCfgOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 460,
              maxWidth: '92vw',
              maxHeight: '88vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 4,
              }}
            >
              <Icon name="cog" size={19} color="var(--gold)" stroke={2} />
              <span
                className="exp"
                style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}
              >
                {jur.copy.registry} connection
              </span>
            </div>
            <p
              style={{
                fontSize: 12.5,
                color: 'var(--ink-3)',
                margin: '0 0 16px',
              }}
            >
              SFTP credentials the state registry issued for this yard. Use{' '}
              <b>Test</b> to confirm them, and export the queue CSV to send a
              sample for format validation before enabling.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="SFTP host">
                <TextInput
                  value={cfgHost}
                  onChange={setCfgHost}
                  placeholder="sftp.leadsonline.com"
                  mono
                />
              </Field>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 110 }}>
                  <Field label="Port">
                    <TextInput value={cfgPort} onChange={setCfgPort} mono />
                  </Field>
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Username">
                    <TextInput value={cfgUser} onChange={setCfgUser} mono />
                  </Field>
                </div>
              </div>
              <Field
                label={
                  repCfg?.has_credentials
                    ? 'Password (leave blank to keep current)'
                    : 'Password'
                }
              >
                <TextInput
                  value={cfgPass}
                  onChange={setCfgPass}
                  placeholder={repCfg?.has_credentials ? '••••••••' : ''}
                  type="password"
                  mono
                />
              </Field>
              <Field label="Remote directory">
                <TextInput
                  value={cfgDir}
                  onChange={setCfgDir}
                  placeholder="/uploads"
                  mono
                />
              </Field>
              <Field label="Automated upload">
                <div style={{ display: 'flex', gap: 8 }} role="tablist">
                  {(
                    [
                      [true, 'Enabled'],
                      [false, 'Disabled'],
                    ] as [boolean, string][]
                  ).map(([val, lbl]) => {
                    const on = cfgEnabled === val;
                    return (
                      <button
                        key={lbl}
                        role="tab"
                        aria-selected={on}
                        onClick={() => setCfgEnabled(val)}
                        style={{
                          flex: 1,
                          padding: '9px 0',
                          borderRadius: 9,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: on ? 'var(--ink)' : 'var(--surface-2)',
                          color: on ? 'var(--bg)' : 'var(--ink-2)',
                          border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                        }}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
            {cfgMsg && (
              <div
                style={{
                  fontSize: 12.5,
                  marginTop: 14,
                  fontWeight: 600,
                  color: cfgMsg.startsWith('✕')
                    ? 'var(--rust)'
                    : cfgMsg.startsWith('✓')
                      ? 'var(--moss)'
                      : 'var(--ink-3)',
                }}
              >
                {cfgMsg}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 18,
                justifyContent: 'space-between',
              }}
            >
              <Btn
                variant="ghost"
                icon="bolt"
                onClick={testConfig}
                disabled={testing || cfgBusy || !cfgHost.trim()}
              >
                {testing ? 'Testing…' : 'Test'}
              </Btn>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn
                  variant="ghost"
                  onClick={() => setCfgOpen(false)}
                  disabled={cfgBusy || testing}
                >
                  Cancel
                </Btn>
                <Btn
                  variant="primary"
                  icon="check"
                  onClick={saveConfig}
                  disabled={cfgBusy || testing}
                >
                  {cfgBusy ? 'Saving…' : 'Save'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send-now confirmation — the final, deliberate gate before anything
          transmits to the state. */}
      {sendOpen && (
        <div
          onClick={() => !sending && setSendOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.42)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440,
              maxWidth: '92vw',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 12,
              }}
            >
              <Icon name="upload" size={20} color="var(--gold)" stroke={2.2} />
              <span
                className="exp"
                style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}
              >
                Upload to {jur.copy.registry}?
              </span>
            </div>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.55,
                color: 'var(--ink-2)',
                margin: '0 0 18px',
              }}
            >
              This transmits{' '}
              <b style={{ color: 'var(--ink)' }}>
                {queued.length} unreported{' '}
                {queued.length === 1 ? 'buy' : 'buys'}
              </b>{' '}
              to {jur.copy.registry} over SFTP and marks them reported. This is
              a real state filing and <b>can’t be undone.</b>
            </p>
            {sendMsg && (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--rust)',
                  marginBottom: 14,
                  fontWeight: 600,
                }}
              >
                {sendMsg}
              </div>
            )}
            <div
              style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}
            >
              <Btn
                variant="ghost"
                onClick={() => setSendOpen(false)}
                disabled={sending}
              >
                Cancel
              </Btn>
              <Btn
                variant="solid"
                tone="var(--gold)"
                icon="upload"
                onClick={doSend}
                disabled={sending || !canSend}
              >
                {sending ? 'Uploading…' : `Send ${queued.length}`}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
