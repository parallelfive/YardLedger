import { useMemo, useState } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useReceipts } from '../../hooks/useReceipts';
import { updateCustomer, type Customer } from '../../services/customers';
import { shareTextFile } from '../../utils/shareFile';
import Icon from '../Icon';
import {
  Card,
  PanelHead,
  StatTile,
  Table,
  TR,
  Btn,
  SlideOver,
  SlideHead,
  SearchBox,
  money,
  money0,
  lbs,
  type Col,
} from '../ui';

type ReceiptRow = ReturnType<typeof useReceipts>['receipts'][number];

interface Stat {
  buys: number;
  weight: number;
  paid: number;
  lastAt: string | null;
}

const rWeight = (r: ReceiptRow) =>
  (r.line_items ?? []).reduce((a, li) => a + Number(li.weight || 0), 0);

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

// Customer directory — every seller the yard has bought from, their ID on
// file, lifetime volume, and a flag toggle for problem sellers. Per-customer
// stats are aggregated from the already-loaded receipts by name (the dedupe
// key upsertCustomer uses), so no extra round-trips.
export default function Customers({
  nav,
}: {
  nav: { openTicket: (r: ReceiptRow) => void };
}) {
  const { customers, refresh } = useCustomers();
  const { receipts } = useReceipts();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);

  // name(lowercased) → lifetime buy stats
  const statsByName = useMemo(() => {
    const m = new Map<string, Stat>();
    for (const r of receipts) {
      if (r.type !== 'buy') continue;
      const key = (r.customer_name || '').trim().toLowerCase();
      if (!key) continue;
      const s = m.get(key) || { buys: 0, weight: 0, paid: 0, lastAt: null };
      s.buys += 1;
      s.weight += rWeight(r);
      s.paid += Number(r.subtotal || 0);
      if (!s.lastAt || r.created_at > s.lastAt) s.lastAt = r.created_at;
      m.set(key, s);
    }
    return m;
  }, [receipts]);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return customers
      .filter((c) => !ql || c.name.toLowerCase().includes(ql))
      .map((c) => ({
        c,
        stat: statsByName.get(c.name.trim().toLowerCase()) || {
          buys: 0,
          weight: 0,
          paid: 0,
          lastAt: null,
        },
      }))
      .sort((a, b) => b.stat.paid - a.stat.paid);
  }, [customers, statsByName, q]);

  const flaggedCount = customers.filter((c) => c.is_flagged).length;
  const withId = customers.filter((c) => c.drivers_license).length;

  // History for the selected customer (their buys, newest first).
  const history = useMemo(() => {
    if (!sel) return [];
    const key = sel.name.trim().toLowerCase();
    return receipts
      .filter(
        (r) =>
          r.type === 'buy' &&
          (r.customer_name || '').trim().toLowerCase() === key
      )
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [sel, receipts]);

  const selStat = sel
    ? statsByName.get(sel.name.trim().toLowerCase())
    : undefined;

  const toggleFlag = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      const next = !sel.is_flagged;
      let reason = '';
      if (next) {
        reason =
          (typeof window !== 'undefined' && window.prompt
            ? window.prompt('Reason for flagging this seller')?.trim()
            : '') || '';
      }
      const updated = await updateCustomer(sel.id, {
        is_flagged: next,
        flag_reason: next ? reason : '',
      });
      setSel(updated);
      refresh();
    } catch {
      // Surface nothing fatal — the toggle just no-ops on error.
    } finally {
      setBusy(false);
    }
  };

  // Seller roster → CSV for the yard's records. Every field quoted, embedded
  // quotes doubled, so a comma in a name can't shift the columns.
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'seller',
      'drivers_license',
      'phone',
      'buys',
      'volume_lb',
      'paid',
      'last_visit',
      'flagged',
      'flag_reason',
    ];
    const lines = rows.map(({ c, stat }) =>
      [
        c.name,
        c.drivers_license,
        c.phone,
        stat.buys,
        stat.weight.toFixed(2),
        stat.paid.toFixed(2),
        stat.lastAt ? new Date(stat.lastAt).toISOString().slice(0, 10) : '',
        c.is_flagged ? 'yes' : 'no',
        c.is_flagged ? c.flag_reason : '',
      ]
        .map(cell)
        .join(',')
    );
    const csv = [header.map(cell).join(','), ...lines].join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    shareTextFile(
      `sellers-${stamp}.csv`,
      csv,
      'text/csv',
      'public.comma-separated-values-text'
    ).catch(() => {});
  };

  const cols: Col[] = [
    { key: 'name', label: 'Seller', w: '1.8fr' },
    { key: 'id', label: 'ID on file', w: '1.2fr' },
    { key: 'buys', label: 'Buys', w: '0.7fr', align: 'right' },
    { key: 'weight', label: 'Volume', w: '1fr', align: 'right' },
    { key: 'paid', label: 'Paid', w: '1fr', align: 'right' },
    { key: 'last', label: 'Last visit', w: '1fr', align: 'right' },
  ];

  return (
    <div
      className="stagger in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <StatTile
          big
          label="Sellers"
          value={customers.length}
          sub="on file"
          tone="copper"
          icon="user"
        />
        <StatTile
          label="With ID"
          value={withId}
          sub="license captured"
          tone="steel"
          icon="scan"
        />
        <StatTile
          label="Flagged"
          value={flaggedCount}
          sub="need review"
          tone={flaggedCount > 0 ? 'rust' : 'moss'}
          icon="alert"
        />
      </div>

      {/* table */}
      <Card pad={0} style={{ flex: 1 }}>
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
            title="Sellers"
            sub="Everyone the yard has bought from"
            icon="user"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SearchBox
              placeholder="Find seller…"
              value={q}
              onChange={setQ}
              width={240}
            />
            <Btn
              variant="ghost"
              size="sm"
              icon="download"
              onClick={exportCsv}
              disabled={rows.length === 0}
            >
              Export
            </Btn>
          </div>
        </div>
        {rows.length === 0 ? (
          <div
            className="mono"
            style={{
              padding: '8px 20px 26px',
              fontSize: 12.5,
              color: 'var(--ink-3)',
            }}
          >
            {customers.length === 0 ? 'No sellers yet.' : 'No matches.'}
          </div>
        ) : (
          <Table cols={cols}>
            {rows.map(({ c, stat }) => (
              <TR
                key={c.id}
                cols={cols}
                onClick={() => setSel(c)}
                active={!!sel && sel.id === c.id}
                accent={c.is_flagged ? 'var(--rust)' : 'transparent'}
                cells={[
                  <div
                    key="name"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {c.name}
                    </span>
                    {c.is_flagged && (
                      <Icon
                        name="alert"
                        size={13}
                        color="var(--rust)"
                        stroke={2.2}
                      />
                    )}
                  </div>,
                  <span
                    key="id"
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      color: c.drivers_license
                        ? 'var(--ink-2)'
                        : 'var(--ink-3)',
                    }}
                  >
                    {c.drivers_license || 'No ID'}
                  </span>,
                  <span
                    key="buys"
                    className="mono num"
                    style={{ fontSize: 13, color: 'var(--ink-2)' }}
                  >
                    {stat.buys}
                  </span>,
                  <span
                    key="weight"
                    className="mono num"
                    style={{ fontSize: 13, color: 'var(--ink-2)' }}
                  >
                    {lbs(stat.weight)} lb
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
                    {money0(stat.paid)}
                  </span>,
                  <span
                    key="last"
                    className="mono"
                    style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
                  >
                    {fmtDate(stat.lastAt)}
                  </span>,
                ]}
              />
            ))}
          </Table>
        )}
      </Card>

      {/* detail */}
      <SlideOver open={!!sel} onClose={() => setSel(null)} width={480}>
        {sel && (
          <>
            <SlideHead
              title={sel.name}
              sub={sel.is_flagged ? 'Flagged seller' : 'Seller'}
              onClose={() => setSel(null)}
              icon="user"
              tone={sel.is_flagged ? 'var(--rust)' : 'var(--accent)'}
            />
            <div
              className="screen-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {sel.is_flagged && (
                <Card
                  pad={14}
                  style={{
                    border:
                      '1px solid color-mix(in oklab, var(--rust) 32%, var(--line))',
                    background:
                      'color-mix(in oklab, var(--rust) 8%, var(--surface))',
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                  >
                    <Icon
                      name="alert"
                      size={16}
                      color="var(--rust)"
                      stroke={2.2}
                    />
                    <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                      Flagged{sel.flag_reason ? ` — ${sel.flag_reason}` : ''}
                    </span>
                  </div>
                </Card>
              )}

              {/* stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: 12,
                }}
              >
                <StatTile
                  label="Buys"
                  value={selStat?.buys ?? 0}
                  tone="copper"
                  icon="receipt"
                />
                <StatTile
                  label="Volume"
                  value={`${lbs(selStat?.weight ?? 0)}`}
                  sub="lb"
                  tone="steel"
                  icon="stack"
                />
                <StatTile
                  label="Paid"
                  value={money0(selStat?.paid ?? 0)}
                  tone="moss"
                  icon="sales"
                />
              </div>

              {/* identity */}
              <Card pad={18}>
                {(
                  [
                    ['Driver license', sel.drivers_license || '—'],
                    ['Phone', sel.phone || '—'],
                    ['Address', sel.address || '—'],
                    ['Last visit', fmtDate(selStat?.lastAt ?? null)],
                  ] as const
                ).map(([k, v], i, a) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '11px 0',
                      borderBottom:
                        i < a.length - 1 ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                      {k}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                        textAlign: 'right',
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </Card>

              {/* history */}
              <Card pad={0}>
                <div style={{ padding: '16px 20px 8px' }}>
                  <PanelHead
                    title="Buy history"
                    sub={`${history.length} ticket${history.length === 1 ? '' : 's'}`}
                    icon="receipt"
                  />
                </div>
                {history.length === 0 ? (
                  <div
                    className="mono"
                    style={{
                      padding: '4px 20px 20px',
                      fontSize: 12.5,
                      color: 'var(--ink-3)',
                    }}
                  >
                    No buys recorded.
                  </div>
                ) : (
                  <div style={{ paddingBottom: 8 }}>
                    {history.map((r) => (
                      <button
                        key={r.id}
                        className="tap trow"
                        onClick={() => nav.openTicket(r)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          textAlign: 'left',
                          padding: '11px 20px',
                          borderTop: '1px solid var(--line)',
                        }}
                      >
                        <div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 12.5,
                              color: 'var(--ink-2)',
                            }}
                          >
                            {r.receipt_number}
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 11,
                              color: 'var(--ink-3)',
                              marginTop: 2,
                            }}
                          >
                            {fmtDate(r.created_at)} · {lbs(rWeight(r))} lb
                          </div>
                        </div>
                        <span
                          className="mono num"
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--ink)',
                          }}
                        >
                          {money(Number(r.subtotal || 0))}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* footer: flag toggle */}
            <div
              style={{
                padding: '18px 22px',
                borderTop: '1px solid var(--line)',
                background: 'var(--surface)',
                flexShrink: 0,
              }}
            >
              <Btn
                variant={sel.is_flagged ? 'ghost' : 'primary'}
                tone={sel.is_flagged ? undefined : 'var(--rust)'}
                icon={sel.is_flagged ? 'check' : 'alert'}
                full
                disabled={busy}
                onClick={toggleFlag}
              >
                {sel.is_flagged ? 'Clear flag' : 'Flag this seller'}
              </Btn>
            </div>
          </>
        )}
      </SlideOver>
    </div>
  );
}
