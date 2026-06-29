import { useState, useRef, useEffect } from 'react';
import { useAppSelector, type RootState } from '../store';
import { useRole } from '../hooks/useRole';
import { useMetals } from '../hooks/useMetals';
import { useReceipts } from '../hooks/useReceipts';
import { useTheme } from '../theme';
import DesktopStyle from './DesktopStyle';
import Rail, { type TabId } from './Rail';
import TopBar from './TopBar';
import Dashboard from './screens/Dashboard';
import {
  Card,
  PanelHead,
  Btn,
  SlideOver,
  SlideHead,
  Pill,
  GroupLabel,
  money,
  lbs,
  tierTone,
} from './ui';
import type { IconName } from './Icon';

type ReceiptRow = ReturnType<typeof useReceipts>['receipts'][number];

// NM is the locked compliance context for this build; these labels live in
// company_settings — wire them through when the Settings screen lands.
const NM = {
  abbr: 'NM',
  act: 'NM Sale of Recycled Metals Act',
  registry: 'LeadsOnline',
  reportBy: '2nd business day',
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  worker: 'Worker',
};

function Placeholder({ title, icon }: { title: string; icon: IconName }) {
  return (
    <div
      className="stagger in"
      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
    >
      <Card style={{ padding: 40, textAlign: 'center' }}>
        <PanelHead title={title} icon={icon} />
        <GroupLabel style={{ marginTop: 8 }}>
          This desktop screen is being built in this pass
        </GroupLabel>
      </Card>
    </div>
  );
}

function TicketDetail({ t, onClose }: { t: ReceiptRow; onClose: () => void }) {
  const weight = (t.line_items ?? []).reduce(
    (a, li) => a + Number(li.weight || 0),
    0
  );
  const items = (t.line_items ?? []).length;
  const restricted =
    (t.line_items ?? []).some((li) => li.is_restricted) || !!t.is_catalytic;
  const tier = t.is_catalytic ? 'catalytic' : restricted ? 'restricted' : 'buy';
  const time = new Date(t.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <SlideOver open onClose={onClose} width={480}>
      <SlideHead
        title={t.customer_name || 'Walk-in'}
        sub={t.receipt_number}
        onClose={onClose}
        icon="receipt"
        tone={restricted ? 'var(--rust)' : 'var(--accent)'}
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
        <Card pad={20} style={{ textAlign: 'center' }}>
          <GroupLabel>
            Paid · {(t.payment_method || '').toString() || '—'}
          </GroupLabel>
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
            {money(Number(t.subtotal || 0))}
          </div>
          <div
            className="mono num"
            style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}
          >
            {lbs(weight)} lb · {items} item{items > 1 ? 's' : ''} · {time}
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Pill tone={tierTone(tier)} icon="shield">
            {tier}
          </Pill>
          <Pill
            tone={t.reported_at ? 'var(--moss)' : 'var(--gold)'}
            icon={t.reported_at ? 'check' : 'clock'}
          >
            {t.reported_at ? 'Reported' : 'Queued'}
          </Pill>
        </div>
        <Card pad={18}>
          <PanelHead title="Line items" />
          {(t.line_items ?? []).map((li, i, a) => (
            <div
              key={li.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '11px 0',
                borderBottom:
                  i < a.length - 1 ? '1px solid var(--line)' : 'none',
              }}
            >
              <span style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>
                {li.metal_name}
              </span>
              <span
                className="mono num"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}
              >
                {lbs(Number(li.weight || 0))} lb ·{' '}
                {money(Number(li.total || 0))}
              </span>
            </div>
          ))}
        </Card>
        <Btn variant="primary" icon="printer" full>
          Reprint ticket
        </Btn>
      </div>
    </SlideOver>
  );
}

type Overlay =
  | { type: 'ticket'; data: ReceiptRow }
  | { type: 'buy' }
  | { type: 'sale' }
  | null;

export default function DesktopShell() {
  const company = useAppSelector((s: RootState) => s.auth.company);
  const identity = useAppSelector((s: RootState) => s.auth.activeIdentity);
  const { role, isAdmin } = useRole();
  const { metals } = useMetals();
  const { receipts } = useReceipts();
  const { mode } = useTheme();

  const [tab, setTab] = useState<TabId>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  const queued = receipts.filter(
    (r) =>
      r.type === 'buy' &&
      !r.reported_at &&
      ((r.line_items ?? []).some((li) => li.is_restricted) || !!r.is_catalytic)
  ).length;

  const nav = {
    go: (id: TabId) => setTab(id),
    openBuy: () => setOverlay({ type: 'buy' }),
    openSale: () => setOverlay({ type: 'sale' }),
    openTicket: (r: ReceiptRow) => setOverlay({ type: 'ticket', data: r }),
    close: () => setOverlay(null),
  };

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const titles: Record<TabId, { title: string; sub: string }> = {
    home: { title: 'Day book', sub: dateLabel },
    inventory: { title: 'Inventory', sub: `${metals.length} metals · on hand` },
    sales: { title: 'Sales', sub: 'Outbound loads to processors' },
    compliance: { title: 'Compliance', sub: `${NM.act} · ${NM.registry}` },
    settings: { title: 'Settings', sub: 'Company, rules, materials & team' },
  };

  let screen;
  if (tab === 'home')
    screen = (
      <Dashboard
        nav={nav}
        canReport={isAdmin}
        reportBy={NM.reportBy}
        act={NM.act}
        registry={NM.registry}
        metalCount={metals.length}
      />
    );
  else if (tab === 'inventory')
    screen = <Placeholder title="Inventory" icon="stack" />;
  else if (tab === 'sales') screen = <Placeholder title="Sales" icon="truck" />;
  else if (tab === 'compliance')
    screen = <Placeholder title="Compliance" icon="shield" />;
  else screen = <Placeholder title="Settings" icon="cog" />;

  return (
    <div className="yl-app" data-theme={mode}>
      <DesktopStyle />
      <Rail
        tab={tab}
        onTab={nav.go}
        company={{ abbr: NM.abbr, prefix: company?.prefix ?? '' }}
        userName={identity?.name ?? 'Staff'}
        roleLabel={ROLE_LABEL[role ?? 'worker'] ?? 'Worker'}
        queued={queued}
        reportBy={NM.reportBy}
        onNewBuy={nav.openBuy}
      />
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
        }}
      >
        <TopBar
          title={titles[tab].title}
          sub={titles[tab].sub}
          alerts={queued > 0}
          onAlerts={() => nav.go('compliance')}
          onNewBuy={nav.openBuy}
        />
        <div
          ref={scrollRef}
          key={tab}
          className="screen-scroll"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
        >
          <div
            style={{ maxWidth: 1320, margin: '0 auto', padding: '26px 28px' }}
          >
            {screen}
          </div>
        </div>

        {overlay?.type === 'ticket' && (
          <TicketDetail t={overlay.data} onClose={nav.close} />
        )}
        {overlay?.type === 'buy' && (
          <SlideOver open onClose={nav.close} width={560}>
            <SlideHead
              title="New buy"
              sub="Coming in this build"
              onClose={nav.close}
              icon="plus"
            />
            <div style={{ padding: 22 }}>
              <GroupLabel>The desktop buy flow is being wired next.</GroupLabel>
            </div>
          </SlideOver>
        )}
        {overlay?.type === 'sale' && (
          <SlideOver open onClose={nav.close} width={520}>
            <SlideHead
              title="New sale"
              sub="Coming in this build"
              onClose={nav.close}
              icon="truck"
            />
            <div style={{ padding: 22 }}>
              <GroupLabel>
                The desktop sale flow is being wired next.
              </GroupLabel>
            </div>
          </SlideOver>
        )}
      </div>
    </div>
  );
}
