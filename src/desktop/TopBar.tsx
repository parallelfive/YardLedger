import { useState } from 'react';
import { SearchBox, IconBtn, Btn } from './ui';

export default function TopBar({
  title,
  sub,
  alerts,
  onAlerts,
  onNewBuy,
  isLight,
  onToggleTheme,
}: {
  title: string;
  sub: string;
  alerts: boolean;
  onAlerts: () => void;
  onNewBuy: () => void;
  isLight: boolean;
  onToggleTheme: () => void;
}) {
  const [q, setQ] = useState('');
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
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search sellers, tickets, metals…"
          width={260}
        />
        <IconBtn icon={isLight ? 'bolt' : 'drop'} onClick={onToggleTheme} />
        <IconBtn icon="bell" badge={alerts} onClick={onAlerts} />
        <Btn variant="primary" icon="plus" onClick={onNewBuy}>
          New buy
        </Btn>
      </div>
    </div>
  );
}
