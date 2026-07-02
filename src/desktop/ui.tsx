import type { CSSProperties, ReactNode } from 'react';
import Icon, { type IconName } from './Icon';

// Shared desktop UI primitives + formatters, ported from the design handoff
// (desktop-ui.jsx / components.jsx). Web/desktop only — raw DOM via react-dom.

type S = CSSProperties;
// CSS custom properties aren't in the CSSProperties index — cast through this.
const vars = (o: Record<string, string | number>): S => o as S;

export const money = (n: number, dp = 2) =>
  '$' +
  Number(n).toLocaleString('en-US', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
export const money0 = (n: number) =>
  '$' + Math.round(Number(n)).toLocaleString('en-US');
export const lbs = (n: number) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 1 : 0 });
export const initialsOf = (name: string) =>
  (name || '?')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export type Tone =
  | 'copper'
  | 'gold'
  | 'steel'
  | 'steel2'
  | 'rust'
  | 'moss'
  | 'ink3';
export const toneColor = (t: Tone | string): string =>
  (
    ({
      copper: 'var(--accent)',
      gold: 'var(--gold)',
      steel: 'var(--teal)',
      steel2: '#8a93a0',
      rust: 'var(--rust)',
      moss: 'var(--moss)',
      ink3: 'var(--ink-3)',
    }) as Record<string, string>
  )[t] || 'var(--accent)';

export const tierTone = (tier: string): string =>
  (
    ({
      open: 'var(--moss)',
      regulated: 'var(--gold)',
      restricted: 'var(--rust)',
      catalytic: 'var(--rust)',
    }) as Record<string, string>
  )[tier] || 'var(--ink-3)';

export function Card({
  children,
  pad = 20,
  className = '',
  style = {},
  hover = false,
  onClick,
}: {
  children: ReactNode;
  pad?: number;
  className?: string;
  style?: S;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={(hover ? 'lift ' : '') + className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        boxShadow: 'var(--shadow)',
        padding: pad,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  sub,
  right,
  icon,
  tone,
}: {
  title: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  icon?: IconName;
  tone?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}
      >
        {icon && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: `color-mix(in oklab, ${tone || 'var(--accent)'} 13%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon
              name={icon}
              size={17}
              color={tone || 'var(--accent)'}
              stroke={1.9}
            />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            className="exp"
            style={{
              fontSize: 15.5,
              fontWeight: 700,
              color: 'var(--ink)',
              letterSpacing: -0.2,
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: 'var(--ink-3)',
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
      {right}
    </div>
  );
}

export function DeltaTag({
  up,
  children,
}: {
  up?: boolean;
  children: ReactNode;
}) {
  const c = up ? 'var(--moss)' : 'var(--rust)';
  return (
    <span
      className="mono num"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        fontSize: 11.5,
        fontWeight: 600,
        color: c,
      }}
    >
      <Icon name={up ? 'up' : 'down'} size={12} color={c} stroke={2.4} />
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  cents,
  sub,
  tone = 'copper',
  icon,
  delta,
  deltaUp,
  big,
}: {
  label: string;
  value: ReactNode;
  cents?: string | null;
  sub?: ReactNode;
  tone?: Tone;
  icon: IconName;
  delta?: string | null;
  deltaUp?: boolean;
  big?: boolean;
}) {
  return (
    <Card
      pad={big ? 20 : 16}
      hover
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {big && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, ${toneColor(tone)} 11%, transparent) 0%, transparent 55%)`,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: `color-mix(in oklab, ${toneColor(tone)} 14%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icon} size={16} color={toneColor(tone)} stroke={1.9} />
          </div>
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
            }}
          >
            {label}
          </span>
        </div>
        {delta != null && <DeltaTag up={deltaUp}>{delta}</DeltaTag>}
      </div>
      <div
        className="exp num"
        style={{
          fontSize: big ? 38 : 27,
          fontWeight: 700,
          color: 'var(--ink)',
          letterSpacing: -0.8,
          marginTop: big ? 14 : 11,
          lineHeight: 1,
          position: 'relative',
        }}
      >
        {value}
        {cents != null && (
          <span
            className="num"
            style={{ fontSize: big ? 19 : 15, color: 'var(--ink-3)' }}
          >
            .{cents}
          </span>
        )}
      </div>
      {sub && (
        <div
          className="mono num"
          style={{
            fontSize: 11.5,
            color: 'var(--ink-2)',
            marginTop: 6,
            position: 'relative',
          }}
        >
          {sub}
        </div>
      )}
    </Card>
  );
}

export interface Col {
  key: string;
  label: string;
  w?: string;
  align?: 'left' | 'right';
  sortable?: boolean;
}

export function Table({
  cols,
  children,
  sortKey,
  sortDir,
  onSort,
}: {
  cols: Col[];
  children: ReactNode;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (k: string) => void;
}) {
  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: cols.map((c) => c.w || '1fr').join(' '),
          padding: '0 18px 10px',
          borderBottom: '1px solid var(--line)',
          alignItems: 'center',
        }}
      >
        {cols.map((c) => {
          const active = sortKey === c.key;
          const sortable = c.sortable && onSort;
          return (
            <button
              key={c.key}
              onClick={sortable ? () => onSort!(c.key) : undefined}
              disabled={!sortable}
              className="mono"
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                color: active ? 'var(--ink)' : 'var(--ink-3)',
                textAlign: c.align || 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                cursor: sortable ? 'pointer' : 'default',
                justifyContent: c.align === 'right' ? 'flex-end' : 'flex-start',
                padding: 0,
              }}
            >
              {c.label}
              {sortable && active && (
                <Icon
                  name={sortDir === 'asc' ? 'up' : 'down'}
                  size={11}
                  color="var(--accent)"
                  stroke={2.6}
                />
              )}
            </button>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function TR({
  cols,
  cells,
  onClick,
  accent,
  active,
}: {
  cols: Col[];
  cells: ReactNode[];
  onClick?: () => void;
  accent?: string;
  active?: boolean;
}) {
  return (
    <div
      className="trow tap"
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: cols.map((c) => c.w || '1fr').join(' '),
        alignItems: 'center',
        padding: '13px 18px',
        borderBottom: '1px solid var(--line)',
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: accent ? `3px solid ${accent}` : '3px solid transparent',
        background: active ? 'var(--surface-2)' : 'transparent',
      }}
    >
      {cells.map((cell, i) => (
        <div
          key={i}
          style={{
            textAlign: cols[i].align || 'left',
            minWidth: 0,
            display: 'flex',
            justifyContent:
              cols[i].align === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          {cell}
        </div>
      ))}
    </div>
  );
}

export function Pill({
  children,
  tone = 'var(--ink-2)',
  icon,
  solid,
}: {
  children: ReactNode;
  tone?: string;
  icon?: IconName;
  solid?: boolean;
}) {
  return (
    <span
      className="mono"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        lineHeight: 1.2,
        color: solid ? '#fff' : tone,
        background: solid
          ? tone
          : `color-mix(in oklab, ${tone} 12%, transparent)`,
        padding: '4px 9px',
        borderRadius: 99,
      }}
    >
      {icon && (
        <Icon
          name={icon}
          size={11}
          color={solid ? '#fff' : tone}
          stroke={2.2}
        />
      )}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T;
  options: (T | { v: T; label: string })[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? '6px 12px' : '8px 15px';
  const fs = size === 'sm' ? 12 : 13;
  return (
    <div
      style={{
        display: 'inline-flex',
        background: 'var(--surface-2)',
        border: '1px solid var(--line)',
        borderRadius: 11,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((o) => {
        const v = (typeof o === 'string' ? o : o.v) as T;
        const label = typeof o === 'string' ? o : o.label;
        const on = value === v;
        return (
          <button
            key={v}
            className="tap"
            onClick={() => onChange(v)}
            style={{
              padding: pad,
              fontSize: fs,
              fontWeight: on ? 700 : 550,
              borderRadius: 8,
              background: on ? 'var(--surface)' : 'transparent',
              color: on ? 'var(--ink)' : 'var(--ink-3)',
              boxShadow: on ? 'var(--shadow)' : 'none',
              textTransform: 'capitalize',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function Btn({
  children,
  icon,
  onClick,
  variant = 'primary',
  size = 'md',
  full,
  disabled,
  tone,
}: {
  children: ReactNode;
  icon?: IconName;
  onClick?: () => void;
  variant?: 'primary' | 'solid' | 'ghost' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  disabled?: boolean;
  tone?: string;
}) {
  const base: S = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 11,
    fontWeight: 650,
    whiteSpace: 'nowrap',
    width: full ? '100%' : 'auto',
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };
  const sz: S =
    size === 'sm'
      ? { padding: '8px 13px', fontSize: 13 }
      : size === 'lg'
        ? { padding: '14px 20px', fontSize: 15.5 }
        : { padding: '10px 16px', fontSize: 14 };
  const variants: Record<string, S> = {
    primary: {
      background: tone || 'var(--accent)',
      color: 'var(--accent-ink)',
      border: '1px solid transparent',
      boxShadow:
        '0 4px 14px color-mix(in oklab, var(--accent) 30%, transparent)',
    },
    solid: {
      background: tone || 'var(--ink)',
      color: 'var(--bg)',
      border: '1px solid transparent',
    },
    ghost: {
      background: 'var(--surface)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      boxShadow: 'var(--shadow)',
    },
    subtle: {
      background: 'var(--surface-2)',
      color: 'var(--ink-2)',
      border: '1px solid transparent',
    },
  };
  const ic =
    variant === 'primary'
      ? 'var(--accent-ink)'
      : variant === 'solid'
        ? 'var(--bg)'
        : 'var(--ink-2)';
  return (
    <button
      className="tap focusring"
      onClick={onClick}
      style={{ ...base, ...sz, ...variants[variant] }}
    >
      {icon && (
        <Icon
          name={icon}
          size={size === 'sm' ? 15 : 17}
          color={tone && variant === 'primary' ? 'var(--accent-ink)' : ic}
          stroke={2.1}
        />
      )}
      {children}
    </button>
  );
}

export function IconBtn({
  icon,
  onClick,
  badge,
  active,
  size = 38,
}: {
  icon: IconName;
  onClick?: () => void;
  badge?: boolean;
  active?: boolean;
  size?: number;
}) {
  return (
    <button
      className="tap focusring"
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: active ? 'var(--accent-soft)' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--line)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        boxShadow: 'var(--shadow)',
        flexShrink: 0,
      }}
    >
      <Icon
        name={icon}
        size={18}
        color={active ? 'var(--accent)' : 'var(--ink-2)'}
        stroke={1.9}
      />
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 9,
            width: 7,
            height: 7,
            borderRadius: 99,
            background: 'var(--rust)',
            border: '1.5px solid var(--surface)',
          }}
        />
      )}
    </button>
  );
}

export function SearchBox({
  placeholder = 'Search…',
  value,
  onChange,
  width = 260,
}: {
  placeholder?: string;
  value: string;
  onChange?: (v: string) => void;
  width?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width,
        height: 38,
        padding: '0 13px',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        boxShadow: 'var(--shadow)',
      }}
    >
      <Icon name="search" size={16} color="var(--ink-3)" stroke={2} />
      <input
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--ink)',
          fontSize: 13.5,
          minWidth: 0,
        }}
      />
    </div>
  );
}

export function SlideOver({
  open,
  onClose,
  width = 520,
  children,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90 }}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10,8,4,0.46)',
          animation: 'ylScrim .22s ease forwards',
          backdropFilter: 'blur(1.5px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width,
          maxWidth: '94vw',
          background: 'var(--bg)',
          borderLeft: '1px solid var(--line)',
          boxShadow: 'var(--shadow-lg)',
          animation: 'ylSlideR .3s cubic-bezier(.2,.8,.2,1) forwards',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function SlideHead({
  title,
  sub,
  onClose,
  icon,
  tone,
}: {
  title: ReactNode;
  sub?: ReactNode;
  onClose: () => void;
  icon?: IconName;
  tone?: string;
}) {
  return (
    <div
      style={{
        padding: '20px 22px',
        borderBottom: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexShrink: 0,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}
      >
        {icon && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 11,
              background: `color-mix(in oklab, ${tone || 'var(--accent)'} 13%, transparent)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon
              name={icon}
              size={21}
              color={tone || 'var(--accent)'}
              stroke={1.9}
            />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            className="exp"
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: 'var(--ink)',
              letterSpacing: -0.4,
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              className="mono"
              style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
      <IconBtn icon="x" onClick={onClose} />
    </div>
  );
}

export function GroupLabel({
  children,
  style = {},
}: {
  children: ReactNode;
  style?: S;
}) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function TareMark({
  size = 32,
  bg = 'var(--accent)',
  fg = '#fff',
  radius,
}: {
  size?: number;
  bg?: string;
  fg?: string;
  radius?: number;
}) {
  const r = radius != null ? radius : size * 0.28;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.28) inset, 0 4px 12px rgba(0,0,0,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.22), transparent 46%)',
        }}
      />
      <svg
        width={size * 0.62}
        height={size * 0.62}
        viewBox="0 0 100 100"
        fill="none"
        stroke={fg}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ position: 'relative' }}
      >
        <path d="M30 40 H70" />
        <path d="M24 40 Q30 51 36 40" />
        <path d="M64 40 Q70 51 76 40" />
        <path d="M50 40 V62" />
        <path d="M40 66 L50 58 L60 66" />
        <path d="M38 74 H62" strokeOpacity="0.55" />
      </svg>
    </div>
  );
}

export function Sparkline({
  data,
  w = 300,
  h = 56,
  color = 'var(--accent)',
  fillOpacity = 0.12,
  strokeW = 2,
}: {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  fillOpacity?: number;
  strokeW?: number;
}) {
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const rng = max - min || 1;
  const pts = data.map(
    (v, i) =>
      [
        (i / Math.max(1, data.length - 1)) * w,
        h - 4 - ((v - min) / rng) * (h - 10),
      ] as const
  );
  const line = pts
    .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1))
    .join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  const gid = 'sg' + Math.round(min + max + data.length);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ display: 'block', width: '100%' }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={fillOpacity * 2.4} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={pts[pts.length - 1][0]}
        cy={pts[pts.length - 1][1]}
        r="3"
        fill={color}
      />
    </svg>
  );
}

export function MetalDot({
  tone,
  size = 9,
}: {
  tone: Tone | string;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: tone === 'rust' ? 2 : 99,
        background: toneColor(tone),
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

export function Placeholder({
  label,
  h = 88,
  r = 12,
}: {
  label: string;
  h?: number;
  r?: number;
}) {
  return (
    <div
      style={{
        flex: 1,
        height: h,
        borderRadius: r,
        border: '1px dashed var(--line-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'repeating-linear-gradient(135deg, var(--surface-2) 0 11px, transparent 11px 22px)',
        color: 'var(--ink-3)',
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}
      >
        {label}
      </span>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
          marginBottom: 7,
        }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div
          className="mono"
          style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 5 }}
        >
          {hint}
        </div>
      )}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  prefix,
  mono,
  readOnly,
  align,
}: {
  value: string | number;
  onChange?: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  mono?: boolean;
  readOnly?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        height: 44,
        padding: '0 14px',
        background: readOnly ? 'var(--surface-2)' : 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 11,
      }}
    >
      {prefix && (
        <span className="mono" style={{ fontSize: 14, color: 'var(--ink-3)' }}>
          {prefix}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={mono ? 'mono num' : ''}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--ink)',
          fontSize: 14.5,
          fontWeight: 550,
          minWidth: 0,
          textAlign: align || 'left',
        }}
      />
    </div>
  );
}

// Re-export the vars helper for screens that set CSS custom properties inline.
export { vars };
