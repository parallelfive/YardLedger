import { useEffect, useMemo, useState } from 'react';
import {
  fetchComplianceReport,
  buildNmrldExportCsv,
  fetchNmrldRegistrationNumber,
  type ComplianceReceiptRow,
} from '../../services/reports';
import { shareTextFile } from '../../utils/shareFile';
import Icon, { type IconName } from '../Icon';
import {
  Card,
  PanelHead,
  Table,
  TR,
  Pill,
  Btn,
  Segmented,
  GroupLabel,
  Placeholder,
  SlideOver,
  SlideHead,
  money,
  lbs,
  type Col,
} from '../ui';

// NM compliance copy — mirrors the mobile/desktop reporting strings.
const COMPANY = {
  act: 'NM Sale of Recycled Metals Act',
  registry: 'LeadsOnline',
  state: 'New Mexico',
  reportBy: '2nd business day',
};

const COMP_RANGES = ['Today', 'Week', 'Month'] as const;
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
  no: string;
  seller: string;
  dl: string;
  plate: string;
  vehicle: string;
  materials: string;
  weight: number;
  paid: number;
  restricted: boolean;
  reported: boolean;
  affirmed: boolean;
  pay: string;
}

const toVM = (r: ComplianceReceiptRow): RecordVM => {
  const items = r.line_items ?? [];
  const vehicle =
    [r.vehicle_year, r.vehicle_make, r.vehicle_model]
      .filter(Boolean)
      .join(' ') || '—';
  return {
    no: r.receipt_number,
    seller: r.seller_name || r.customer_name || 'Walk-in',
    dl: r.seller_dl_number || '—',
    plate: r.vehicle_plate || '—',
    vehicle,
    materials: items
      .map((li) => `${li.metal_name} (${lbs(li.weight)} lb)`)
      .join(', '),
    weight: items.reduce((a, li) => a + Number(li.weight || 0), 0),
    paid: Number(r.subtotal || 0),
    restricted: items.some((li) => li.is_restricted) || !!r.is_catalytic,
    reported: !!r.reported_at,
    affirmed: !!r.seller_affirmed,
    pay: r.payment_method || '—',
  };
};

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { start, end } = rangeDates(range);
    fetchComplianceReport(start, end)
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
  }, [range]);

  const vms = useMemo(() => records.map(toVM), [records]);
  const queued = useMemo(() => vms.filter((r) => !r.reported), [vms]);
  const sent = useMemo(() => vms.filter((r) => r.reported), [vms]);
  const restrictedRows = useMemo(() => vms.filter((r) => r.restricted), [vms]);

  const rows =
    filter === 'queued'
      ? queued
      : filter === 'restricted'
        ? restrictedRows
        : vms;

  // Export the current range's records as the NMRLD upload CSV. On web this
  // triggers a browser download; on native it opens the OS share sheet.
  const exportCsv = async () => {
    try {
      const csv = buildNmrldExportCsv(
        records,
        await fetchNmrldRegistrationNumber()
      );
      await shareTextFile(
        'compliance.csv',
        csv,
        'text/csv',
        'public.comma-separated-values-text'
      );
    } catch {
      /* best effort — surfaced via OS share / download failure */
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
                due {COMPANY.reportBy}
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
                <b style={{ color: 'var(--ink)' }}>{COMPANY.registry}</b>
              </span>
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}
            >
              {COMPANY.act} · {COMPANY.state}
            </div>
          </div>
          <button
            className="tap"
            disabled={!canReport}
            onClick={canReport ? exportCsv : undefined}
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
            sub={`${range} · ${COMPANY.registry}`}
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
              sub={canReport ? COMPANY.registry : 'Admin only'}
              locked={!canReport}
              onClick={canReport ? exportCsv : undefined}
            />
          </div>
        </Card>
      </div>

      {/* deadline strip */}
      {queued.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '13px 18px',
            borderRadius: 13,
            background: 'color-mix(in oklab, var(--rust) 8%, var(--surface))',
            border:
              '1px solid color-mix(in oklab, var(--rust) 24%, var(--line))',
          }}
        >
          <Icon name="alert" size={18} color="var(--rust)" stroke={2} />
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-2)' }}>
            <b style={{ color: 'var(--ink)' }}>
              {queued.length} unreported transaction
            </b>{' '}
            with a restricted item must reach {COMPANY.registry} by the{' '}
            {COMPANY.reportBy}.
          </span>
          <Btn
            variant="solid"
            size="sm"
            tone="var(--rust)"
            icon="chev"
            onClick={() => setFilter('queued')}
          >
            Review queue
          </Btn>
        </div>
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
                    {lbs(r.weight)} lb
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
                    tone={r.reported ? 'var(--moss)' : 'var(--gold)'}
                    icon={r.reported ? 'check' : 'clock'}
                  >
                    {r.reported ? 'Reported' : 'Queued'}
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
                      ['Driver license', sel.dl],
                      ['Plate', sel.plate],
                      ['Vehicle', sel.vehicle],
                      ['Payment', sel.pay],
                      ['Weight', lbs(sel.weight) + ' lb'],
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
                <div style={{ display: 'flex', gap: 10 }}>
                  <Placeholder label="ID scan" h={88} />
                  <Placeholder label="Material" h={88} />
                  <Placeholder label="Vehicle" h={88} />
                </div>
              </Card>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="primary" icon="printer" full>
                  Print record
                </Btn>
                {!sel.reported && canReport && (
                  <Btn variant="solid" tone="var(--gold)" icon="upload" full>
                    Report now
                  </Btn>
                )}
              </div>
            </div>
          </>
        )}
      </SlideOver>
    </div>
  );
}
