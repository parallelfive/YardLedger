import { useMemo, useState } from 'react';
import { useInventory } from '../../hooks/useInventory';
import { useDeskAdmin } from '../AdminActions';
import Icon from '../Icon';
import {
  Card,
  PanelHead,
  Table,
  TR,
  Pill,
  Btn,
  SearchBox,
  SlideOver,
  SlideHead,
  GroupLabel,
  Sparkline,
  DeltaTag,
  money,
  money0,
  lbs,
  toneColor,
  tierTone,
  type Col,
  type Tone,
} from '../ui';

interface InvRow {
  id: string;
  metal_id: string;
  metal_name: string;
  weight: number;
  avg_cost_per_lb: number;
  metals?: {
    price_per_lb?: number | null;
    is_restricted?: boolean | null;
    is_regulated?: boolean | null;
    is_catalytic?: boolean | null;
    metal_categories?: { name?: string } | null;
  } | null;
}

interface MetalView {
  id: string;
  name: string;
  cat: string;
  tier: string;
  tone: Tone;
  price: number;
  avg: number;
  onHand: number;
  value: number;
  spread: number;
}

const TIER_NOTES: Record<string, string> = {
  open: 'No documentation required.',
  regulated: 'Seller ID, vehicle & ownership affirmation required.',
  restricted: 'Adds written proof of ownership.',
  catalytic: 'Check only · VIN + serials · 60-day hold.',
};

const tierToneName = (tier: string): Tone =>
  tier === 'catalytic' || tier === 'restricted'
    ? 'rust'
    : tier === 'regulated'
      ? 'gold'
      : 'moss';

function MetalDetail({
  m,
  onClose,
  nav,
}: {
  m: MetalView | null;
  onClose: () => void;
  nav: { openBuy: () => void };
}) {
  const admin = useDeskAdmin();
  if (!m) return null;
  const spread = m.price - m.avg;
  const up = spread >= 0;
  const value = m.onHand * m.avg;
  const marginPct = m.avg ? Math.round((spread / m.avg) * 100) : 0;
  return (
    <SlideOver open={!!m} onClose={onClose} width={480}>
      <SlideHead
        title={m.name}
        sub={`${m.cat} · ${money(m.price)}/lb`}
        onClose={onClose}
        icon="stack"
        tone={toneColor(m.tone)}
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <Card pad={16}>
            <GroupLabel>On hand</GroupLabel>
            <div
              className="exp num"
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--ink)',
                marginTop: 6,
                letterSpacing: -0.5,
              }}
            >
              {lbs(m.onHand)}
              <span
                className="mono"
                style={{ fontSize: 13, color: 'var(--ink-3)' }}
              >
                {' '}
                lb
              </span>
            </div>
          </Card>
          <Card pad={16}>
            <GroupLabel>Inventory value</GroupLabel>
            <div
              className="exp num"
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: 'var(--accent)',
                marginTop: 6,
                letterSpacing: -0.5,
              }}
            >
              {money0(value)}
            </div>
          </Card>
        </div>
        <Card pad={18}>
          <PanelHead title="Pricing" sub="Live spread vs average cost" />
          {(
            [
              ['Buying now', money(m.price) + '/lb', 'var(--ink)'],
              ['Avg cost', money(m.avg) + '/lb', 'var(--ink-2)'],
              [
                'Spread',
                (up ? '+' : '−') + money(Math.abs(spread)) + ` (${marginPct}%)`,
                up ? 'var(--moss)' : 'var(--rust)',
              ],
            ] as const
          ).map(([k, v, c], i, a) => (
            <div
              key={k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '11px 0',
                borderBottom:
                  i < a.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{k}</span>
              <span
                className="mono num"
                style={{ fontSize: 14, fontWeight: 600, color: c }}
              >
                {v}
              </span>
            </div>
          ))}
        </Card>
        <Card
          pad={18}
          style={{
            border: `1px solid color-mix(in oklab, ${tierTone(m.tier)} 28%, var(--line))`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              marginBottom: 8,
            }}
          >
            <Icon name="shield" size={17} color={tierTone(m.tier)} stroke={2} />
            <Pill tone={tierTone(m.tier)}>{m.tier}</Pill>
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--ink-2)',
              lineHeight: 1.5,
            }}
          >
            {TIER_NOTES[m.tier] ?? TIER_NOTES.open}
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn
            variant="primary"
            icon="plus"
            full
            onClick={() => {
              onClose();
              nav.openBuy();
            }}
          >
            Buy this metal
          </Btn>
          <Btn
            variant="ghost"
            icon="edit"
            full
            onClick={() => {
              onClose();
              admin.editPrice({
                id: m.id,
                name: m.name,
                price_per_lb: m.price,
              });
            }}
          >
            Edit price
          </Btn>
        </div>
      </div>
    </SlideOver>
  );
}

export default function Inventory({ nav }: { nav: { openBuy: () => void } }) {
  const { inventory } = useInventory();
  const [cat, setCat] = useState('All');
  const [sortKey, setSortKey] = useState('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sel, setSel] = useState<MetalView | null>(null);
  const [q, setQ] = useState('');

  const metals = useMemo<MetalView[]>(() => {
    const rows = inventory as unknown as InvRow[];
    return rows.map((r) => {
      const flags = r.metals;
      const tier = flags?.is_catalytic
        ? 'catalytic'
        : flags?.is_restricted
          ? 'restricted'
          : flags?.is_regulated
            ? 'regulated'
            : 'open';
      const price = Number(flags?.price_per_lb ?? 0);
      const avg = Number(r.avg_cost_per_lb ?? price);
      const onHand = Number(r.weight ?? 0);
      return {
        id: r.metal_id,
        name: r.metal_name,
        cat: flags?.metal_categories?.name || 'Other',
        tier,
        tone: tierToneName(tier),
        price,
        avg,
        onHand,
        value: onHand * avg,
        spread: price - avg,
      };
    });
  }, [inventory]);

  const cats = useMemo(() => {
    const set = new Set<string>();
    for (const m of metals) set.add(m.cat);
    return ['All', ...Array.from(set).sort(), 'Restricted'];
  }, [metals]);

  const total = metals.reduce((s, m) => s + m.value, 0);
  const totalWeight = metals.reduce((s, m) => s + m.onHand, 0);
  const regulatedCount = metals.filter((m) => m.tier === 'regulated').length;
  const restrictedCount = metals.filter(
    (m) => m.tier === 'restricted' || m.tier === 'catalytic'
  ).length;
  const openCount = metals.filter((m) => m.tier === 'open').length;
  const spark = metals.slice(0, 12).map((m) => m.value);

  const onSort = (k: string) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir('desc');
    }
  };

  let rows =
    cat === 'All'
      ? metals
      : cat === 'Restricted'
        ? metals.filter(
            (m) => m.tier === 'restricted' || m.tier === 'catalytic'
          )
        : metals.filter((m) => m.cat === cat);
  if (q)
    rows = rows.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()));
  rows = [...rows].sort((a, b) => {
    const val = (m: MetalView): string | number =>
      sortKey === 'name'
        ? m.name
        : sortKey === 'price'
          ? m.price
          : sortKey === 'avg'
            ? m.avg
            : sortKey === 'spread'
              ? m.spread
              : sortKey === 'onHand'
                ? m.onHand
                : m.value;
    const av = val(a);
    const bv = val(b);
    if (typeof av === 'string' && typeof bv === 'string')
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc'
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number);
  });

  const cols: Col[] = [
    { key: 'name', label: 'Material', w: '2fr', sortable: true },
    { key: 'tier', label: 'Tier', w: '1fr' },
    {
      key: 'price',
      label: 'Price now',
      w: '1fr',
      align: 'right',
      sortable: true,
    },
    { key: 'avg', label: 'Avg cost', w: '1fr', align: 'right', sortable: true },
    {
      key: 'spread',
      label: 'Spread',
      w: '1fr',
      align: 'right',
      sortable: true,
    },
    {
      key: 'onHand',
      label: 'On hand',
      w: '1fr',
      align: 'right',
      sortable: true,
    },
    { key: 'value', label: 'Value', w: '1fr', align: 'right', sortable: true },
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
      {/* hero + filters row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <Card style={{ position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(110% 90% at 0% 0%, var(--accent-soft) 0%, transparent 50%)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <div>
              <GroupLabel>On-hand value</GroupLabel>
              <div
                className="exp num"
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  letterSpacing: -1,
                  color: 'var(--ink)',
                  marginTop: 6,
                  lineHeight: 1,
                }}
              >
                {money(total)}
              </div>
              <div
                className="mono num"
                style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 7 }}
              >
                {lbs(totalWeight)} lb across {metals.length} metals
              </div>
            </div>
            <DeltaTag up>4.2% wk</DeltaTag>
          </div>
          <div style={{ position: 'relative', marginTop: 14 }}>
            <Sparkline
              data={spark.length ? spark : [0, 0]}
              h={46}
              color="var(--accent)"
            />
          </div>
        </Card>
        <Card
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', gap: 22 }}>
            {(
              [
                ['Regulated', regulatedCount, 'var(--gold)'],
                ['Restricted', restrictedCount, 'var(--rust)'],
                ['Open buy', openCount, 'var(--moss)'],
              ] as const
            ).map(([k, n, c]) => (
              <div key={k}>
                <div
                  className="exp num"
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    color: c,
                    letterSpacing: -0.5,
                  }}
                >
                  {n}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                    marginTop: 2,
                  }}
                >
                  {k}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--line)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Icon name="clock" size={16} color="var(--gold)" stroke={2} />
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
              <b style={{ color: 'var(--ink)' }}>
                {restrictedCount} restricted
              </b>{' '}
              tiers need documentation
            </span>
          </div>
        </Card>
      </div>

      {/* table — grows to fill the remaining height so a short list doesn't
          leave a dead gap below the page */}
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
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {cats.map((c) => (
              <button
                key={c}
                className="tap"
                onClick={() => setCat(c)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 99,
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: cat === c ? 'var(--ink)' : 'var(--surface-2)',
                  color: cat === c ? 'var(--bg)' : 'var(--ink-2)',
                  border: `1px solid ${cat === c ? 'var(--ink)' : 'var(--line)'}`,
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <SearchBox
              placeholder="Find metal…"
              value={q}
              onChange={setQ}
              width={220}
            />
            <Btn variant="primary" icon="plus" onClick={() => nav.openBuy()}>
              New buy
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
            No inventory yet.
          </div>
        ) : (
          <Table
            cols={cols}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
          >
            {rows.map((m) => {
              const up = m.spread >= 0;
              return (
                <TR
                  key={m.id}
                  cols={cols}
                  onClick={() => setSel(m)}
                  active={!!sel && sel.id === m.id}
                  accent={toneColor(m.tone)}
                  cells={[
                    <div
                      key="name"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: 'var(--ink)',
                        }}
                      >
                        {m.name}
                      </span>
                    </div>,
                    <Pill key="tier" tone={tierTone(m.tier)}>
                      {m.tier}
                    </Pill>,
                    <span
                      key="price"
                      className="mono num"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {money(m.price)}
                    </span>,
                    <span
                      key="avg"
                      className="mono num"
                      style={{ fontSize: 13, color: 'var(--ink-2)' }}
                    >
                      {money(m.avg)}
                    </span>,
                    <span
                      key="spread"
                      className="mono num"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: up ? 'var(--moss)' : 'var(--rust)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Icon
                        name={up ? 'up' : 'down'}
                        size={11}
                        color={up ? 'var(--moss)' : 'var(--rust)'}
                        stroke={2.4}
                      />
                      {money(Math.abs(m.spread))}
                    </span>,
                    <span
                      key="onHand"
                      className="mono num"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {lbs(m.onHand)}
                    </span>,
                    <span
                      key="value"
                      className="mono num"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--accent)',
                      }}
                    >
                      {money0(m.value)}
                    </span>,
                  ]}
                />
              );
            })}
          </Table>
        )}
      </Card>

      <MetalDetail m={sel} onClose={() => setSel(null)} nav={nav} />
    </div>
  );
}
