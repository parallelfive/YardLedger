import { useState, useRef, useEffect, useMemo } from 'react';
import { useAppSelector, type RootState } from '../store';
import { useRole } from '../hooks/useRole';
import { useMetals } from '../hooks/useMetals';
import { useInventory } from '../hooks/useInventory';
import { useReceipts } from '../hooks/useReceipts';
import { useTheme } from '../theme';
import DesktopStyle from './DesktopStyle';
import Rail, { type TabId } from './Rail';
import TopBar, { type SearchResult } from './TopBar';
import Dashboard from './screens/Dashboard';
import Inventory from './screens/Inventory';
import Sales from './screens/Sales';
import Customers from './screens/Customers';
import Compliance from './screens/Compliance';
import Settings from './screens/Settings';
import { BuyFlow, SaleFlow } from './Flows';
import CloseDay from './CloseDay';
import { DeskAdminProvider } from './AdminActions';
import { printReceipt } from '../utils/printReceipt';
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
        <Btn
          variant="primary"
          icon="printer"
          full
          onClick={() =>
            printReceipt({
              receipt_number: t.receipt_number,
              customer_name: t.customer_name || 'Walk-in',
              subtotal: Number(t.subtotal || 0),
              created_at: t.created_at,
              line_items: (t.line_items ?? []).map((li) => ({
                metal_name: li.metal_name,
                weight: Number(li.weight || 0),
                price_per_lb: Number(li.weight)
                  ? Number(li.total || 0) / Number(li.weight)
                  : 0,
                total: Number(li.total || 0),
                is_price_override: false,
              })),
            }).catch(() => {})
          }
        >
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
  | { type: 'closeday' }
  | null;

export default function DesktopShell() {
  const company = useAppSelector((s: RootState) => s.auth.company);
  const identity = useAppSelector((s: RootState) => s.auth.activeIdentity);
  const { role, isAdmin } = useRole();
  const { metals } = useMetals();
  const { inventory } = useInventory();
  const { receipts, refresh: refreshReceipts } = useReceipts();
  const { mode, isLight, toggle: toggleTheme } = useTheme();

  const [tab, setTab] = useState<TabId>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // After a buy/sale saves, close the slide-over and remount the active screen
  // (and bump the shell's own receipts) so the new data shows immediately.
  const done = () => {
    setOverlay(null);
    setReloadKey((k) => k + 1);
    refreshReceipts();
  };

  // In quick mode the slide-over stays open, but we still remount the screen
  // behind it so the day book / lists reflect each saved ticket live (the
  // overlay is a sibling of the keyed content, so it isn't affected).
  const refreshBehind = () => {
    setReloadKey((k) => k + 1);
    refreshReceipts();
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [tab]);

  // Counter-terminal keyboard shortcuts. Single keys (no modifier) drive the
  // common actions so an operator rarely reaches for the mouse. Ignored while
  // typing in a field or when a slide-over is open (except Esc, which closes
  // it). Cmd/Ctrl/Alt combos are left to the browser.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (overlay) setOverlay(null);
        return;
      }
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        el?.isContentEditable
      )
        return;
      if (overlay) return; // don't fire nav shortcuts behind an open ticket
      const k = e.key.toLowerCase();
      if (k === 'b') {
        e.preventDefault();
        setOverlay({ type: 'buy' });
      } else if (k === 's') {
        e.preventDefault();
        setOverlay({ type: 'sale' });
      } else if (k === 'c') {
        e.preventDefault();
        setOverlay({ type: 'closeday' });
      } else if (k === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.yl-app input')?.focus();
      } else if (k >= '1' && k <= '6') {
        e.preventDefault();
        const tabs: TabId[] = [
          'home',
          'inventory',
          'sales',
          'customers',
          'compliance',
          'settings',
        ];
        setTab(tabs[Number(k) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);

  const queued = receipts.filter(
    (r) =>
      r.type === 'buy' &&
      !r.reported_at &&
      ((r.line_items ?? []).some((li) => li.is_restricted) || !!r.is_catalytic)
  ).length;

  // Global search: metals (→ Inventory) + receipts by seller / receipt #
  // (→ ticket detail). setTab/setOverlay are stable so nav isn't a dependency.
  const searchResults = useMemo<SearchResult[]>(() => {
    const ql = query.trim().toLowerCase();
    if (!ql) return [];
    const ms = (
      metals as unknown as { id: string; name: string; price_per_lb: number }[]
    )
      .filter((m) => m.name.toLowerCase().includes(ql))
      .slice(0, 5)
      .map((m) => ({
        key: 'm' + m.id,
        icon: 'stack' as const,
        title: m.name,
        sub: `${money(Number(m.price_per_lb || 0))}/lb`,
        onPick: () => setTab('inventory'),
      }));
    const rs = receipts
      .filter(
        (r) =>
          (r.customer_name || '').toLowerCase().includes(ql) ||
          (r.receipt_number || '').toLowerCase().includes(ql)
      )
      .slice(0, 6)
      .map((r) => ({
        key: 'r' + r.id,
        icon: 'receipt' as const,
        title: r.customer_name || 'Walk-in',
        sub: `${r.receipt_number} · ${money(Number(r.subtotal || 0))}`,
        onPick: () => setOverlay({ type: 'ticket', data: r }),
      }));
    return [...ms, ...rs].slice(0, 8);
  }, [query, metals, receipts]);

  const nav = {
    go: (id: TabId) => setTab(id),
    openBuy: () => setOverlay({ type: 'buy' }),
    openSale: () => setOverlay({ type: 'sale' }),
    openTicket: (r: ReceiptRow) => setOverlay({ type: 'ticket', data: r }),
    openCloseDay: () => setOverlay({ type: 'closeday' }),
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
    inventory: {
      title: 'Inventory',
      sub: `${inventory.length} metal${inventory.length === 1 ? '' : 's'} on hand`,
    },
    sales: { title: 'Sales', sub: 'Outbound loads to processors' },
    customers: { title: 'Sellers', sub: 'Everyone the yard has bought from' },
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
      />
    );
  else if (tab === 'inventory') screen = <Inventory nav={nav} />;
  else if (tab === 'sales') screen = <Sales nav={nav} />;
  else if (tab === 'customers') screen = <Customers nav={nav} />;
  else if (tab === 'compliance') screen = <Compliance canReport={isAdmin} />;
  else screen = <Settings canManage={isAdmin} />;

  return (
    <div className="yl-app" data-theme={mode}>
      <DesktopStyle />
      <DeskAdminProvider onChanged={done}>
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
          className="yl-col"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <TopBar
            title={titles[tab].title}
            sub={titles[tab].sub}
            alerts={queued > 0}
            onAlerts={() => nav.go('compliance')}
            onNewBuy={nav.openBuy}
            isLight={isLight}
            onToggleTheme={toggleTheme}
            query={query}
            onQuery={setQuery}
            results={searchResults}
          />
          <div
            ref={scrollRef}
            key={`${tab}-${reloadKey}`}
            className="screen-scroll"
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
          >
            {/* Fill the browser width. The old 1320 cap left dead gutters on
                wide monitors; a high 2200 ceiling keeps ultra-wide (>2500px)
                tables from stretching absurdly while letting 1440–1920 screens
                run full-bleed. */}
            {/* Full-height flex column so screens that opt in (the Day book
                fills the viewport height instead of leaving a dead gap below;
                table screens just sit at natural height at the top. */}
            <div
              style={{
                maxWidth: 2200,
                margin: '0 auto',
                padding: '16px 36px 10px',
                minHeight: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {screen}
            </div>
          </div>

          {overlay?.type === 'ticket' && (
            <TicketDetail t={overlay.data} onClose={nav.close} />
          )}
          {overlay?.type === 'buy' && (
            <BuyFlow
              onClose={nav.close}
              onDone={done}
              onSaved={refreshBehind}
            />
          )}
          {overlay?.type === 'sale' && (
            <SaleFlow
              onClose={nav.close}
              onDone={done}
              onSaved={refreshBehind}
            />
          )}
          {overlay?.type === 'closeday' && <CloseDay onClose={nav.close} />}
        </div>
      </DeskAdminProvider>
    </div>
  );
}
