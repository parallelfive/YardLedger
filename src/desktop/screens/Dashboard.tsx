import { useMemo } from 'react';
import { useReceipts } from '../../hooks/useReceipts';
import { useInventory } from '../../hooks/useInventory';
import { useSales } from '../../hooks/useSales';
import Icon from '../Icon';
import {
  Card,
  PanelHead,
  StatTile,
  Table,
  TR,
  Pill,
  Btn,
  money,
  money0,
  lbs,
  toneColor,
  tierTone,
  type Col,
  type Tone,
} from '../ui';
import type { TabId } from '../Rail';

type ReceiptRow = ReturnType<typeof useReceipts>['receipts'][number];

const isToday = (iso: string) => {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
};

const rWeight = (r: ReceiptRow) =>
  (r.line_items ?? []).reduce((a, li) => a + Number(li.weight || 0), 0);
const rRestricted = (r: ReceiptRow) =>
  (r.line_items ?? []).some((li) => li.is_restricted) || !!r.is_catalytic;
const rTier = (r: ReceiptRow): string =>
  r.is_catalytic ? 'catalytic' : rRestricted(r) ? 'restricted' : 'buy';

function AreaChart({
  data,
  h = 156,
  color = 'var(--accent)',
  fill = false,
}: {
  data: number[];
  h?: number;
  color?: string;
  /** Stretch to fill the parent's height instead of a fixed pixel height.
   * preserveAspectRatio="none" already lets the viewBox scale vertically. */
  fill?: boolean;
}) {
  const w = 760;
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const rng = max - min || 1;
  const pad = 8;
  const pts = data.map(
    (v, i) =>
      [
        (i / Math.max(1, data.length - 1)) * w,
        h - pad - ((v - min) / rng) * (h - pad * 2.4),
      ] as const
  );
  const line = pts
    .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const gid = 'ac' + Math.round(min + max + data.length);
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: fill ? '100%' : h }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1="0"
          x2={w}
          y1={h * g}
          y2={h * g}
          stroke="var(--line)"
          strokeWidth="1"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="4"
        fill={color}
      />
    </svg>
  );
}

export default function Dashboard({
  nav,
  canReport,
  reportBy,
  act,
  registry,
}: {
  nav: {
    go: (t: TabId) => void;
    openBuy: () => void;
    openSale: () => void;
    openTicket: (r: ReceiptRow) => void;
    openCloseDay: () => void;
  };
  canReport: boolean;
  reportBy: string;
  act: string;
  registry: string;
}) {
  const { receipts } = useReceipts();
  const { inventory } = useInventory();
  const { sales } = useSales();

  const m = useMemo(() => {
    const buys = receipts.filter((r) => r.type === 'buy');
    const todayBuys = buys.filter((r) => isToday(r.created_at));
    const bought = todayBuys.reduce((a, r) => a + Number(r.subtotal || 0), 0);
    const boughtWeight = todayBuys.reduce((a, r) => a + rWeight(r), 0);

    // 14-day net-buy series
    const series: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const total = buys
        .filter((r) => {
          const d = new Date(r.created_at);
          return (
            d.getFullYear() === day.getFullYear() &&
            d.getMonth() === day.getMonth() &&
            d.getDate() === day.getDate()
          );
        })
        .reduce((a, r) => a + Number(r.subtotal || 0), 0);
      series.push(total);
    }

    // queued = unreported buys that need reporting (restricted/catalytic)
    const queued = buys.filter((r) => !r.reported_at && rRestricted(r)).length;

    // on-hand value + metal mix from inventory
    const inv = inventory as unknown as {
      weight: number;
      avg_cost_per_lb?: number | null;
      metals?: {
        price_per_lb?: number | null;
        metal_categories?: { name?: string } | null;
      } | null;
    }[];
    let onHandValue = 0;
    const byCat: Record<string, number> = {};
    let totalWt = 0;
    for (const it of inv) {
      const wt = Number(it.weight || 0);
      // Value inventory at its cost basis (weighted-avg cost), not the current
      // buying price — matches the Inventory screen's on-hand-value.
      const unit = Number(it.avg_cost_per_lb ?? it.metals?.price_per_lb ?? 0);
      onHandValue += wt * unit;
      const cat = it.metals?.metal_categories?.name || 'Other';
      byCat[cat] = (byCat[cat] || 0) + wt;
      totalWt += wt;
    }
    const TONES: Tone[] = ['copper', 'steel', 'gold', 'moss', 'rust', 'steel2'];
    const mix = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, wt], i) => ({
        name,
        pct: totalWt ? wt / totalWt : 0,
        tone: TONES[i % TONES.length],
      }));

    // sold today
    const sl = sales as unknown as {
      created_at: string;
      total_amount?: number;
      total?: number;
      weight?: number;
    }[];
    const todaySales = sl.filter((s) => isToday(s.created_at));
    const sold = todaySales.reduce(
      (a, s) => a + Number(s.total_amount ?? s.total ?? 0),
      0
    );
    const soldWeight = todaySales.reduce(
      (a, s) => a + Number(s.weight ?? 0),
      0
    );

    return {
      bought,
      boughtWeight,
      boughtCount: todayBuys.length,
      series,
      seriesTotal: series.reduce((a, b) => a + b, 0),
      queued,
      onHandValue,
      onHandMetals: inv.length,
      mix,
      sold,
      soldWeight,
      recent: todayBuys.slice(0, 8),
    };
  }, [receipts, inventory, sales]);

  const cents = String(Math.round((m.bought % 1) * 100)).padStart(2, '0');
  const intakeCols: Col[] = [
    { key: 'customer', label: 'Seller', w: '1.6fr' },
    { key: 'no', label: 'Receipt', w: '1.4fr' },
    { key: 'tier', label: 'Tier', w: '0.9fr' },
    { key: 'weight', label: 'Weight', w: '0.8fr', align: 'right' },
    { key: 'total', label: 'Paid', w: '0.9fr', align: 'right' },
    { key: 'pay', label: 'Pay', w: '0.7fr', align: 'right' },
  ];

  return (
    <div
      className="stagger in"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <StatTile
          big
          label="Bought today"
          value={money0(m.bought)}
          cents={cents}
          sub={`${lbs(m.boughtWeight)} lb · ${m.boughtCount} receipts`}
          tone="copper"
          icon="receipt"
        />
        <StatTile
          label="Sold today"
          value={money0(m.sold)}
          sub={`${lbs(m.soldWeight)} lb shipped out`}
          tone="steel"
          icon="truck"
        />
        <StatTile
          label="Gross profit"
          value={money0(Math.max(0, m.sold - m.bought))}
          sub="buys vs sales today"
          tone="moss"
          icon="sales"
        />
        <StatTile
          label="On-hand value"
          value={money0(m.onHandValue)}
          sub={`${m.onHandMetals} metal${m.onHandMetals === 1 ? '' : 's'} in yard`}
          tone="gold"
          icon="stack"
        />
      </div>

      {/* two-column body */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.85fr) minmax(0,1fr)',
          gap: 18,
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 0,
          }}
        >
          <Card
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 220,
            }}
          >
            <PanelHead
              title="Buy volume"
              sub="Net $ bought · 14 days"
              icon="up"
              right={
                <div style={{ textAlign: 'right' }}>
                  <div
                    className="exp num"
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: 'var(--ink)',
                      letterSpacing: -0.5,
                    }}
                  >
                    {money0(m.seriesTotal)}
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: 'var(--ink-3)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                    }}
                  >
                    14-day total
                  </div>
                </div>
              }
            />
            <div style={{ flex: 1, minHeight: 120, marginTop: 6 }}>
              <AreaChart data={m.series} fill />
            </div>
          </Card>

          <Card pad={0}>
            <div style={{ padding: '18px 20px 14px' }}>
              <PanelHead
                title="Recent intake"
                sub="Today's buys"
                icon="receipt"
                right={
                  <Btn
                    variant="subtle"
                    size="sm"
                    icon="chev"
                    onClick={() => nav.go('compliance')}
                  >
                    View all
                  </Btn>
                }
              />
            </div>
            {m.recent.length === 0 ? (
              <div
                className="mono"
                style={{
                  padding: '8px 20px 26px',
                  fontSize: 12.5,
                  color: 'var(--ink-3)',
                }}
              >
                No buys yet today.
              </div>
            ) : (
              <Table cols={intakeCols}>
                {m.recent.map((t) => {
                  const restricted = rRestricted(t);
                  const pay = (t.payment_method || '').toString();
                  return (
                    <TR
                      key={t.id}
                      cols={intakeCols}
                      onClick={() => nav.openTicket(t)}
                      accent={restricted ? 'var(--rust)' : 'transparent'}
                      cells={[
                        <div
                          key="seller"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: 'var(--ink)',
                            }}
                          >
                            {t.customer_name || 'Walk-in'}
                          </span>
                          {restricted && (
                            <Icon
                              name="alert"
                              size={13}
                              color="var(--rust)"
                              stroke={2.2}
                            />
                          )}
                        </div>,
                        <span
                          key="no"
                          className="mono"
                          style={{ fontSize: 11.5, color: 'var(--ink-3)' }}
                        >
                          {t.receipt_number} ·{' '}
                          {new Date(t.created_at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>,
                        <Pill key="tier" tone={tierTone(rTier(t))}>
                          {rTier(t)}
                        </Pill>,
                        <span
                          key="wt"
                          className="mono num"
                          style={{ fontSize: 13, color: 'var(--ink-2)' }}
                        >
                          {lbs(rWeight(t))} lb
                        </span>,
                        <span
                          key="paid"
                          className="mono num"
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 'var(--ink)',
                          }}
                        >
                          {money(Number(t.subtotal || 0))}
                        </span>,
                        <span
                          key="pay"
                          className="mono"
                          style={{
                            fontSize: 11.5,
                            textTransform: 'capitalize',
                            color:
                              pay === 'check' ? 'var(--teal)' : 'var(--ink-3)',
                          }}
                        >
                          {pay || '—'}
                        </span>,
                      ]}
                    />
                  );
                })}
              </Table>
            )}
          </Card>
        </div>

        {/* right column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            minHeight: 0,
          }}
        >
          {/* State reporting */}
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
                padding: '15px 20px',
                background:
                  'color-mix(in oklab, var(--gold) 8%, var(--surface))',
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
                  <Icon
                    name="upload"
                    size={19}
                    color="var(--gold)"
                    stroke={2}
                  />
                  <span
                    className="exp"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--ink)',
                    }}
                  >
                    State reporting
                  </span>
                </div>
                <Pill tone="var(--rust)" icon="clock">
                  due {reportBy}
                </Pill>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 9,
                  marginTop: 10,
                }}
              >
                <span
                  className="exp num"
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: 'var(--gold)',
                    letterSpacing: -1,
                  }}
                >
                  {m.queued}
                </span>
                <span
                  style={{
                    fontSize: 13.5,
                    color: 'var(--ink-2)',
                    fontWeight: 550,
                  }}
                >
                  buys awaiting upload to {registry}
                </span>
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}
              >
                {act}
              </div>
            </div>
            <button
              className="tap"
              onClick={() => nav.go('compliance')}
              disabled={!canReport}
              style={{
                width: '100%',
                padding: '14px',
                background: canReport ? 'var(--gold)' : 'var(--chip)',
                color: canReport ? '#fff' : 'var(--ink-3)',
                fontSize: 14.5,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Icon
                name={canReport ? 'upload' : 'lock'}
                size={17}
                color={canReport ? '#fff' : 'var(--ink-3)'}
                stroke={2.2}
              />
              {canReport ? 'Review & upload' : 'Admin required'}
            </button>
          </Card>

          {/* Metal mix */}
          <Card pad={16}>
            <PanelHead title="Metal mix" sub="On hand · by weight" />
            {m.mix.length === 0 ? (
              <div
                className="mono"
                style={{ fontSize: 12, color: 'var(--ink-3)' }}
              >
                No inventory yet.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    height: 12,
                    borderRadius: 7,
                    overflow: 'hidden',
                    gap: 2,
                    marginBottom: 16,
                  }}
                >
                  {m.mix.map((x) => (
                    <div
                      key={x.name}
                      className="ml-bar"
                      style={{
                        width: x.pct * 100 + '%',
                        background: toneColor(x.tone),
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 11 }}
                >
                  {m.mix.map((x) => (
                    <div
                      key={x.name}
                      style={{ display: 'flex', alignItems: 'center', gap: 9 }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 99,
                          background: toneColor(x.tone),
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: 'var(--ink-2)',
                          fontWeight: 550,
                        }}
                      >
                        {x.name}
                      </span>
                      <span
                        className="mono num"
                        style={{
                          fontSize: 12.5,
                          color: 'var(--ink)',
                          fontWeight: 600,
                        }}
                      >
                        {Math.round(x.pct * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>

          {/* Quick actions — anchored to the bottom so the right column
              reaches the viewport floor alongside the left. */}
          <Card pad={16} style={{ marginTop: 'auto' }}>
            <PanelHead title="Quick actions" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Btn
                variant="primary"
                icon="plus"
                full
                size="lg"
                onClick={() => nav.openBuy()}
              >
                New buy
              </Btn>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn
                  variant="ghost"
                  icon="truck"
                  full
                  onClick={() => nav.openSale()}
                >
                  New sale
                </Btn>
                <Btn
                  variant="ghost"
                  icon="stack"
                  full
                  onClick={() => nav.go('inventory')}
                >
                  Stock
                </Btn>
              </div>
              <Btn
                variant="ghost"
                icon="reports"
                full
                onClick={() => nav.openCloseDay()}
              >
                Close day
              </Btn>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
