import { useMemo } from 'react';
import { useReceipts } from '../hooks/useReceipts';
import { useSales } from '../hooks/useSales';
import { shareTextFile } from '../utils/shareFile';
import { printDayClose } from './print';
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
} from './ui';

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

// End-of-day close: a read-only summary of today's tickets — what was bought,
// paid out (cash vs check), sold, and still owed to the state. Computed from the
// already-loaded receipts/sales, so it needs no snapshot table; the operator can
// print/Save-as-PDF it for the books.
export default function CloseDay({ onClose }: { onClose: () => void }) {
  const { receipts } = useReceipts();
  const { sales } = useSales();

  const m = useMemo(() => {
    const buys = receipts.filter(
      (r) => r.type === 'buy' && isToday(r.created_at)
    );
    const cashOut = buys
      .filter((r) => (r.payment_method || '') === 'cash')
      .reduce((a, r) => a + Number(r.subtotal || 0), 0);
    const checkOut = buys
      .filter((r) => (r.payment_method || '') === 'check')
      .reduce((a, r) => a + Number(r.subtotal || 0), 0);
    const buysTotal = buys.reduce((a, r) => a + Number(r.subtotal || 0), 0);
    const weightBought = buys.reduce((a, r) => a + rWeight(r), 0);
    const unreported = buys.filter(
      (r) => !r.reported_at && rRestricted(r)
    ).length;

    // Top materials bought today, by dollar value.
    const byMetal: Record<string, { weight: number; value: number }> = {};
    for (const r of buys) {
      for (const li of r.line_items ?? []) {
        const key = li.metal_name || '—';
        const cur = byMetal[key] || { weight: 0, value: 0 };
        cur.weight += Number(li.weight || 0);
        cur.value += Number(li.total || 0);
        byMetal[key] = cur;
      }
    }
    const materials = Object.entries(byMetal)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value);

    const sl = sales as unknown as {
      created_at: string;
      total_revenue?: number;
      total?: number;
      weight?: number;
      profit?: number;
    }[];
    const todaySales = sl.filter((s) => isToday(s.created_at));
    const salesRevenue = todaySales.reduce(
      (a, s) => a + Number(s.total_revenue ?? s.total ?? 0),
      0
    );
    const weightSold = todaySales.reduce(
      (a, s) => a + Number(s.weight ?? 0),
      0
    );
    const profit = todaySales.reduce((a, s) => a + Number(s.profit ?? 0), 0);

    return {
      buys,
      buysCount: buys.length,
      cashOut,
      checkOut,
      buysTotal,
      weightBought,
      unreported,
      materials,
      salesCount: todaySales.length,
      salesRevenue,
      weightSold,
      profit,
    };
  }, [receipts, sales]);

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Ticket-level CSV of today's buys for the bookkeeper. Quote every field and
  // double embedded quotes so a comma in a name can't break the columns.
  const exportCsv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'receipt',
      'time',
      'seller',
      'materials',
      'weight_lb',
      'paid',
      'payment',
      'tier',
      'reported',
    ];
    const lines = m.buys.map((r) => {
      const tier = r.is_catalytic
        ? 'catalytic'
        : rRestricted(r)
          ? 'restricted'
          : 'open';
      const mats = (r.line_items ?? []).map((li) => li.metal_name).join('; ');
      return [
        r.receipt_number,
        new Date(r.created_at).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        r.customer_name || 'Walk-in',
        mats,
        rWeight(r).toFixed(2),
        Number(r.subtotal || 0).toFixed(2),
        r.payment_method || '',
        tier,
        r.reported_at ? 'yes' : 'no',
      ]
        .map(cell)
        .join(',');
    });
    const csv = [header.map(cell).join(','), ...lines].join('\n');
    const stamp = new Date().toISOString().slice(0, 10);
    shareTextFile(
      `day-close-${stamp}.csv`,
      csv,
      'text/csv',
      'public.comma-separated-values-text'
    ).catch(() => {});
  };

  const matCols: Col[] = [
    { key: 'name', label: 'Material', w: '1.8fr' },
    { key: 'weight', label: 'Weight', w: '1fr', align: 'right' },
    { key: 'value', label: 'Value', w: '1fr', align: 'right' },
  ];

  const row = (k: string, v: string, tone?: string) => (
    <div
      key={k}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '11px 0',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>{k}</span>
      <span
        className="mono num"
        style={{ fontSize: 13.5, fontWeight: 600, color: tone || 'var(--ink)' }}
      >
        {v}
      </span>
    </div>
  );

  return (
    <SlideOver open onClose={onClose} width={520}>
      <SlideHead
        title="Day close"
        sub={dateLabel}
        onClose={onClose}
        icon="reports"
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
        {/* headline: cash paid out */}
        <Card pad={20} style={{ textAlign: 'center' }}>
          <GroupLabel>Cash paid out today</GroupLabel>
          <div
            className="exp num"
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: -1,
              marginTop: 6,
            }}
          >
            {money(m.cashOut)}
          </div>
          <div
            className="mono num"
            style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}
          >
            {m.buysCount} buy{m.buysCount === 1 ? '' : 's'} ·{' '}
            {lbs(m.weightBought)} lb in
          </div>
        </Card>

        {/* KPI grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
          }}
        >
          <StatTile
            label="Bought"
            value={money0(m.buysTotal)}
            sub={`${m.buysCount} tickets`}
            tone="copper"
            icon="receipt"
          />
          <StatTile
            label="Sold"
            value={money0(m.salesRevenue)}
            sub={`${m.salesCount} loads`}
            tone="steel"
            icon="truck"
          />
          <StatTile
            label="Est. profit"
            value={money0(m.profit)}
            sub="on sales"
            tone="moss"
            icon="sales"
          />
          <StatTile
            label="To report"
            value={m.unreported}
            sub="restricted/cat"
            tone={m.unreported > 0 ? 'gold' : 'moss'}
            icon="shield"
          />
        </div>

        {/* cash position */}
        <Card pad={18}>
          <PanelHead
            title="Payouts"
            sub="What left the drawer"
            icon="receipt"
          />
          {row('Cash paid out', money(m.cashOut))}
          {row('Check paid out', money(m.checkOut))}
          {row('Total paid out', money(m.buysTotal))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '11px 0 0',
            }}
          >
            <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
              Sales revenue in
            </span>
            <span
              className="mono num"
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: 'var(--moss)',
              }}
            >
              {money(m.salesRevenue)}
            </span>
          </div>
        </Card>

        {/* compliance flag */}
        {m.unreported > 0 && (
          <Card
            pad={16}
            style={{
              border:
                '1px solid color-mix(in oklab, var(--gold) 30%, var(--line))',
              background: 'color-mix(in oklab, var(--gold) 7%, var(--surface))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Pill tone="var(--gold)" icon="clock">
                {m.unreported} to report
              </Pill>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                restricted/catalytic buys still awaiting upload
              </span>
            </div>
          </Card>
        )}

        {/* top materials */}
        <Card pad={0}>
          <div style={{ padding: '16px 20px 8px' }}>
            <PanelHead
              title="Materials bought"
              sub="Today · by value"
              icon="stack"
            />
          </div>
          {m.materials.length === 0 ? (
            <div
              className="mono"
              style={{
                padding: '4px 20px 22px',
                fontSize: 12.5,
                color: 'var(--ink-3)',
              }}
            >
              No buys yet today.
            </div>
          ) : (
            <Table cols={matCols}>
              {m.materials.map((x) => (
                <TR
                  key={x.name}
                  cols={matCols}
                  cells={[
                    <span
                      key="name"
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {x.name}
                    </span>,
                    <span
                      key="weight"
                      className="mono num"
                      style={{ fontSize: 13, color: 'var(--ink-2)' }}
                    >
                      {lbs(x.weight)} lb
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
                      {money0(x.value)}
                    </span>,
                  ]}
                />
              ))}
            </Table>
          )}
        </Card>
      </div>

      {/* footer */}
      <div
        style={{
          padding: '18px 22px',
          borderTop: '1px solid var(--line)',
          background: 'var(--surface)',
          display: 'flex',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Btn variant="ghost" onClick={onClose}>
          Close
        </Btn>
        <Btn
          variant="ghost"
          icon="download"
          onClick={exportCsv}
          disabled={m.buysCount === 0}
        >
          Export CSV
        </Btn>
        <Btn
          variant="primary"
          icon="printer"
          full
          onClick={() =>
            printDayClose({
              date: dateLabel,
              buysCount: m.buysCount,
              cashOut: m.cashOut,
              checkOut: m.checkOut,
              buysTotal: m.buysTotal,
              weightBought: m.weightBought,
              salesCount: m.salesCount,
              salesRevenue: m.salesRevenue,
              weightSold: m.weightSold,
              profit: m.profit,
              unreported: m.unreported,
              materials: m.materials,
            }).catch(() => {})
          }
        >
          Print day close
        </Btn>
      </div>
    </SlideOver>
  );
}
