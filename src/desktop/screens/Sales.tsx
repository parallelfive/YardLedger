import { useMemo, useState } from 'react';
import { useSales } from '../../hooks/useSales';
import {
  Card,
  PanelHead,
  StatTile,
  Table,
  TR,
  Pill,
  Btn,
  SlideOver,
  SlideHead,
  GroupLabel,
  money,
  money0,
  lbs,
  type Col,
} from '../ui';

interface SaleRow {
  id: string;
  metal_name: string;
  weight: number;
  sale_price_per_lb: number;
  total_revenue: number;
  profit?: number;
  buyer_name: string;
  created_at: string;
}

const loadNo = (id: string) => 'SO-' + id.slice(0, 8);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function Sales({ nav }: { nav: { openSale: () => void } }) {
  const { sales } = useSales();
  const rows = sales as unknown as SaleRow[];
  const [sel, setSel] = useState<SaleRow | null>(null);

  const m = useMemo(() => {
    const sold = rows.reduce((s, x) => s + Number(x.total_revenue || 0), 0);
    const weight = rows.reduce((s, x) => s + Number(x.weight || 0), 0);
    const profit = rows.reduce((s, x) => s + Number(x.profit || 0), 0);
    return { sold, weight, profit, avgPrice: weight ? sold / weight : 0 };
  }, [rows]);

  const cols: Col[] = [
    { key: 'no', label: 'Load #', w: '1.1fr' },
    { key: 'buyer', label: 'Processor', w: '1.6fr' },
    { key: 'metal', label: 'Material', w: '1.4fr' },
    { key: 'weight', label: 'Weight', w: '1fr', align: 'right' },
    { key: 'price', label: 'Price/lb', w: '0.9fr', align: 'right' },
    { key: 'total', label: 'Total', w: '1fr', align: 'right' },
    { key: 'date', label: 'Shipped', w: '0.9fr', align: 'right' },
    { key: 'status', label: 'Status', w: '0.9fr', align: 'right' },
  ];

  return (
    <div
      className="stagger in"
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <StatTile
          big
          label="Sold"
          value={money0(m.sold)}
          sub={`${lbs(m.weight)} lb shipped`}
          tone="steel"
          icon="truck"
        />
        <StatTile
          label="Total profit"
          value={money0(m.profit)}
          sub="margin on loads"
          tone="gold"
          icon="sales"
        />
        <StatTile
          label="Avg sale price"
          value={money(m.avgPrice)}
          sub="blended $/lb"
          tone="copper"
          icon="sales"
        />
        <StatTile
          label="Loads shipped"
          value={rows.length}
          sub="all time"
          tone="moss"
          icon="reports"
        />
      </div>

      <Card pad={0}>
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PanelHead
            title="Outbound loads"
            sub="Stock shipped to mills"
            icon="truck"
            tone="var(--teal)"
          />
          <Btn variant="primary" icon="truck" onClick={() => nav.openSale()}>
            New sale
          </Btn>
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
            No sales yet.
          </div>
        ) : (
          <Table cols={cols}>
            {rows.map((s) => (
              <TR
                key={s.id}
                cols={cols}
                onClick={() => setSel(s)}
                active={!!sel && sel.id === s.id}
                cells={[
                  <span
                    key="no"
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {loadNo(s.id)}
                  </span>,
                  <span
                    key="buyer"
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {s.buyer_name}
                  </span>,
                  <span
                    key="metal"
                    style={{ fontSize: 13, color: 'var(--ink-2)' }}
                  >
                    {s.metal_name}
                  </span>,
                  <span
                    key="weight"
                    className="mono num"
                    style={{ fontSize: 13, color: 'var(--ink-2)' }}
                  >
                    {lbs(s.weight)} lb
                  </span>,
                  <span
                    key="price"
                    className="mono num"
                    style={{ fontSize: 13, color: 'var(--ink-2)' }}
                  >
                    {money(s.sale_price_per_lb)}
                  </span>,
                  <span
                    key="total"
                    className="mono num"
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {money0(s.total_revenue)}
                  </span>,
                  <span
                    key="date"
                    className="mono"
                    style={{ fontSize: 12.5, color: 'var(--ink-3)' }}
                  >
                    {fmtDate(s.created_at)}
                  </span>,
                  <Pill key="status" tone="var(--moss)" icon="check">
                    paid
                  </Pill>,
                ]}
              />
            ))}
          </Table>
        )}
      </Card>

      <SlideOver open={!!sel} onClose={() => setSel(null)} width={460}>
        {sel && (
          <>
            <SlideHead
              title={sel.buyer_name}
              sub={loadNo(sel.id)}
              onClose={() => setSel(null)}
              icon="truck"
              tone="var(--teal)"
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
              <Card pad={20} style={{ textAlign: 'center' }}>
                <GroupLabel>Load total</GroupLabel>
                <div
                  className="exp num"
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    color: 'var(--teal)',
                    letterSpacing: -1,
                    marginTop: 6,
                  }}
                >
                  {money(sel.total_revenue)}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Pill tone="var(--moss)" icon="check">
                    Paid in full
                  </Pill>
                </div>
              </Card>
              <Card pad={18}>
                {(
                  [
                    ['Material', sel.metal_name],
                    ['Weight', lbs(sel.weight) + ' lb'],
                    ['Price / lb', money(sel.sale_price_per_lb)],
                    ['Shipped', fmtDate(sel.created_at)],
                    ['Load #', loadNo(sel.id)],
                  ] as const
                ).map(([k, v], i, a) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '11px 0',
                      borderBottom:
                        i < a.length - 1 ? '1px solid var(--line)' : 'none',
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                      {k}
                    </span>
                    <span
                      className="mono num"
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </Card>
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn variant="primary" icon="printer" full>
                  Bill of lading
                </Btn>
                <Btn variant="ghost" icon="download" full>
                  Export
                </Btn>
              </div>
            </div>
          </>
        )}
      </SlideOver>
    </div>
  );
}
