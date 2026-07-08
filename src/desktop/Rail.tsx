import Icon, { type IconName } from './Icon';
import { TareMark, initialsOf, vars } from './ui';

export type TabId =
  | 'home'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'compliance'
  | 'settings';

const NAV: { id: TabId; icon: IconName; label: string; hint: string }[] = [
  { id: 'home', icon: 'home', label: 'Day book', hint: '1' },
  { id: 'inventory', icon: 'stack', label: 'Inventory', hint: '2' },
  { id: 'sales', icon: 'truck', label: 'Sales', hint: '3' },
  { id: 'customers', icon: 'user', label: 'Sellers', hint: '4' },
  { id: 'compliance', icon: 'shield', label: 'Compliance', hint: '5' },
  { id: 'settings', icon: 'cog', label: 'Settings', hint: '6' },
];

// Muted keycap badge advertising a keyboard shortcut on the rail.
const kbd = {
  marginLeft: 'auto',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--rail-ink-3)',
  background: 'var(--rail-2)',
  border: '1px solid var(--rail-line)',
  borderRadius: 5,
  padding: '1px 6px',
  minWidth: 18,
  textAlign: 'center' as const,
} as const;

export interface RailCompany {
  abbr: string;
  prefix: string;
  reportBy: string;
}

export default function Rail({
  tab,
  onTab,
  company,
  userName,
  roleLabel,
  queued,
  reportBy,
  onNewBuy,
}: {
  tab: TabId;
  onTab: (id: TabId) => void;
  company: { abbr: string; prefix: string };
  userName: string;
  roleLabel: string;
  queued: number;
  reportBy: string;
  onNewBuy: () => void;
}) {
  return (
    <div
      style={{
        width: 244,
        flexShrink: 0,
        background: 'var(--rail)',
        borderRight: '1px solid var(--rail-line)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px 16px',
      }}
    >
      {/* brand */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '4px 8px 22px',
        }}
      >
        <TareMark size={38} radius={11} />
        <div>
          <span
            className="exp"
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: -1,
              color: 'var(--rail-ink)',
              lineHeight: 0.9,
              display: 'block',
            }}
          >
            tare
          </span>
          <span
            className="mono"
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 0.6,
              color: 'var(--rail-ink-3)',
              textTransform: 'uppercase',
            }}
          >
            {company.abbr} · {company.prefix}
          </span>
        </div>
      </div>

      {/* primary action */}
      <button
        className="tap"
        onClick={onNewBuy}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '12px',
          borderRadius: 12,
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          fontSize: 14.5,
          fontWeight: 700,
          marginBottom: 18,
          boxShadow:
            '0 6px 16px color-mix(in oklab, var(--accent) 40%, transparent)',
        }}
      >
        <Icon name="plus" size={19} color="var(--accent-ink)" stroke={2.5} />
        New buy
        <span
          className="mono"
          style={{
            position: 'absolute',
            right: 10,
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--accent-ink)',
            background: 'color-mix(in oklab, #000 18%, transparent)',
            borderRadius: 5,
            padding: '1px 6px',
          }}
        >
          B
        </span>
      </button>

      {/* nav */}
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: 'var(--rail-ink-3)',
          padding: '0 8px 9px',
        }}
      >
        Yard
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {NAV.map((n) => {
          const on = tab === n.id;
          return (
            <button
              key={n.id}
              className="tap"
              onClick={() => onTab(n.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 12px',
                borderRadius: 10,
                background: on
                  ? 'color-mix(in oklab, var(--accent) 18%, transparent)'
                  : 'transparent',
                color: on ? 'var(--rail-ink)' : 'var(--rail-ink-2)',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                if (!on) e.currentTarget.style.background = 'var(--rail-2)';
              }}
              onMouseLeave={(e) => {
                if (!on) e.currentTarget.style.background = 'transparent';
              }}
            >
              {on && (
                <span
                  style={{
                    position: 'absolute',
                    left: -14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 20,
                    borderRadius: 99,
                    background: 'var(--accent)',
                  }}
                />
              )}
              <Icon
                name={n.icon}
                size={19}
                color={on ? 'var(--accent)' : 'var(--rail-ink-2)'}
                stroke={on ? 2.1 : 1.8}
              />
              <span style={{ fontSize: 14, fontWeight: on ? 650 : 550 }}>
                {n.label}
              </span>
              {n.id === 'compliance' && queued > 0 ? (
                <span
                  className="mono num"
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#fff',
                    background: 'var(--gold)',
                    borderRadius: 99,
                    padding: '1px 7px',
                  }}
                >
                  {queued}
                </span>
              ) : (
                <span className="mono" style={kbd}>
                  {n.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* compliance nudge */}
      {queued > 0 && (
        <button
          className="tap"
          onClick={() => onTab('compliance')}
          style={{
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px',
            borderRadius: 12,
            background: 'color-mix(in oklab, var(--gold) 16%, var(--rail-2))',
            border:
              '1px solid color-mix(in oklab, var(--gold) 28%, transparent)',
            marginBottom: 12,
          }}
        >
          <Icon name="clock" size={18} color="var(--gold)" stroke={2} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 650,
                color: 'var(--rail-ink)',
              }}
            >
              {queued} to report
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                color: 'var(--rail-ink-3)',
                marginTop: 1,
              }}
            >
              due {reportBy}
            </div>
          </div>
        </button>
      )}

      {/* user */}
      <button
        className="tap"
        onClick={() => onTab('settings')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 10px',
          borderRadius: 12,
          background: 'var(--rail-2)',
          border: '1px solid var(--rail-line)',
        }}
      >
        <div
          style={vars({
            width: 34,
            height: 34,
            borderRadius: 9,
            background: 'color-mix(in oklab, var(--accent) 22%, var(--rail))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          })}
        >
          <span
            className="exp"
            style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}
          >
            {initialsOf(userName)}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{ fontSize: 13, fontWeight: 650, color: 'var(--rail-ink)' }}
          >
            {userName}
          </div>
          <div
            className="mono"
            style={{ fontSize: 10, color: 'var(--rail-ink-3)' }}
          >
            {roleLabel}
          </div>
        </div>
        <Icon name="cog" size={16} color="var(--rail-ink-3)" stroke={1.8} />
      </button>
    </div>
  );
}
