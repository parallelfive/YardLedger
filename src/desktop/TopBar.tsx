import { useState } from 'react';
import { SearchBox, IconBtn, Btn } from './ui';
import Icon, { type IconName } from './Icon';

export interface SearchResult {
  key: string;
  icon: IconName;
  title: string;
  sub: string;
  tone?: string;
  onPick: () => void;
}

export default function TopBar({
  title,
  sub,
  alerts,
  onAlerts,
  onNewBuy,
  isLight,
  onToggleTheme,
  query,
  onQuery,
  results,
}: {
  title: string;
  sub: string;
  alerts: boolean;
  onAlerts: () => void;
  onNewBuy: () => void;
  isLight: boolean;
  onToggleTheme: () => void;
  query: string;
  onQuery: (v: string) => void;
  results: SearchResult[];
}) {
  const [focused, setFocused] = useState(false);
  const open = focused && query.trim().length > 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 18,
        padding: '20px 28px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg)',
        flexShrink: 0,
        position: 'relative',
        zIndex: 30,
      }}
    >
      <div>
        <h1
          className="exp"
          style={{
            margin: 0,
            fontSize: 27,
            fontWeight: 800,
            letterSpacing: -0.8,
            color: 'var(--ink)',
          }}
        >
          {title}
        </h1>
        <div
          className="mono"
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
            marginTop: 3,
            letterSpacing: 0.3,
          }}
        >
          {sub}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* search + results dropdown */}
        <div
          style={{ position: 'relative' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
        >
          <SearchBox
            value={query}
            onChange={onQuery}
            placeholder="Search sellers, tickets, metals…"
            width={280}
          />
          {open && (
            <div
              style={{
                position: 'absolute',
                top: 46,
                right: 0,
                width: 360,
                maxHeight: 420,
                overflowY: 'auto',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 13,
                boxShadow: 'var(--shadow-lg)',
                padding: 6,
                zIndex: 40,
              }}
            >
              {results.length === 0 ? (
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: 'var(--ink-3)',
                    padding: '14px 12px',
                  }}
                >
                  No matches for “{query.trim()}”.
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.key}
                    className="tap"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onQuery('');
                      r.onPick();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '10px 11px',
                      borderRadius: 9,
                      textAlign: 'left',
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--surface-2)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = 'transparent')
                    }
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `color-mix(in oklab, ${r.tone || 'var(--accent)'} 13%, transparent)`,
                      }}
                    >
                      <Icon
                        name={r.icon}
                        size={16}
                        color={r.tone || 'var(--accent)'}
                        stroke={1.9}
                      />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13.5,
                          fontWeight: 600,
                          color: 'var(--ink)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {r.title}
                      </div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 10.5,
                          color: 'var(--ink-3)',
                          marginTop: 1,
                        }}
                      >
                        {r.sub}
                      </div>
                    </div>
                    <Icon
                      name="chev"
                      size={14}
                      color="var(--ink-3)"
                      stroke={2}
                    />
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <IconBtn icon={isLight ? 'bolt' : 'drop'} onClick={onToggleTheme} />
        <IconBtn icon="bell" badge={alerts} onClick={onAlerts} />
        <Btn variant="primary" icon="plus" onClick={onNewBuy}>
          New buy
        </Btn>
      </div>
    </div>
  );
}
