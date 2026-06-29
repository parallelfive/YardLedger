import type { ReactNode } from 'react';

// Line-icon set ported from the design handoff (components.jsx). Web/desktop
// only — renders a raw SVG via react-dom.
export type IconName =
  | 'home'
  | 'stack'
  | 'plus'
  | 'sales'
  | 'reports'
  | 'receipt'
  | 'scale'
  | 'truck'
  | 'user'
  | 'scan'
  | 'sign'
  | 'printer'
  | 'download'
  | 'del'
  | 'upload'
  | 'check'
  | 'checkd'
  | 'flag'
  | 'alert'
  | 'chev'
  | 'chevD'
  | 'up'
  | 'down'
  | 'search'
  | 'x'
  | 'camera'
  | 'drop'
  | 'cal'
  | 'clock'
  | 'bell'
  | 'cog'
  | 'shield'
  | 'pin'
  | 'edit'
  | 'bolt'
  | 'lock'
  | 'car'
  | 'hash'
  | 'building';

interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  fill?: string;
}

export default function Icon({
  name,
  size = 22,
  stroke = 1.8,
  color = 'currentColor',
  fill = 'none',
}: IconProps) {
  const p = {
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  const paths: Record<string, ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" {...p} />
        <path d="M5 9.5V20h14V9.5" {...p} />
      </>
    ),
    stack: (
      <>
        <rect x="3" y="4" width="18" height="5.2" rx="1.4" {...p} />
        <rect x="3" y="11.4" width="18" height="5.2" rx="1.4" {...p} />
        <path d="M6.5 6.6h4M6.5 14h4" {...p} />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" {...p} strokeWidth={2.4} />,
    sales: (
      <>
        <path d="M4 18 9.5 12l3.5 3.2L20 7" {...p} />
        <path d="M15 7h5v5" {...p} />
      </>
    ),
    reports: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2.2" {...p} />
        <path d="M8 8h8M8 12h8M8 16h5" {...p} />
      </>
    ),
    receipt: (
      <>
        <path
          d="M5 3.5h14V21l-2.3-1.4-2.3 1.4-2.4-1.4L9.3 21 7 19.6 4.7 21V3.5Z"
          {...p}
        />
        <path d="M8 8h8M8 12h6" {...p} />
      </>
    ),
    scale: (
      <>
        <path d="M12 4v15M7 19h10" {...p} />
        <circle cx="12" cy="3.4" r="1.3" {...p} />
        <path d="M5 8h14l-3.2 5.2a3 3 0 0 1-5.1 0L7.6 8" {...p} />
      </>
    ),
    truck: (
      <>
        <rect x="2.5" y="6.5" width="11" height="9" rx="1.2" {...p} />
        <path d="M13.5 9.5H18l3 3v3h-7.5" {...p} />
        <circle cx="7" cy="17.5" r="1.8" {...p} />
        <circle cx="17" cy="17.5" r="1.8" {...p} />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.4" {...p} />
        <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" {...p} />
      </>
    ),
    scan: (
      <>
        <path
          d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
          {...p}
        />
        <path d="M7 12h10" {...p} />
      </>
    ),
    sign: (
      <>
        <path
          d="M3 17.5c3-.5 4-5 5.5-5s1 4 2.5 4 2.2-6 3.7-6 1.3 3 2.3 3 1.5-1 3-1"
          {...p}
        />
        <path d="M3 21h18" {...p} strokeWidth={1.4} />
      </>
    ),
    printer: (
      <>
        <path d="M6 9V3.5h12V9" {...p} />
        <rect x="3.5" y="9" width="17" height="7" rx="1.6" {...p} />
        <path d="M7 16h10v4.5H7z" {...p} />
        <circle cx="17" cy="12" r=".9" fill={color} stroke="none" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v11m0 0 4-4m-4 4-4-4" {...p} />
        <path d="M4 20h16" {...p} />
      </>
    ),
    del: (
      <>
        <path
          d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6.2-6.4a1.5 1.5 0 0 1 0-2.2L9 5Z"
          {...p}
        />
        <path d="M12.5 9.5l5 5M17.5 9.5l-5 5" {...p} />
      </>
    ),
    upload: (
      <>
        <path d="M12 15V4m0 0 4 4m-4-4-4 4" {...p} />
        <path d="M4 20h16" {...p} />
      </>
    ),
    check: <path d="M4 12.5 9.5 18 20 6.5" {...p} strokeWidth={2.2} />,
    checkd: <path d="M2.5 12.5 7 17l9-10M11 16l1 1 9-10" {...p} />,
    flag: <path d="M5 21V4M5 4h11l-2 3.5L16 11H5" {...p} />,
    alert: (
      <>
        <path d="M12 4 2.5 20h19L12 4Z" {...p} />
        <path d="M12 10v4.5" {...p} />
        <circle cx="12" cy="17.6" r=".5" fill={color} stroke="none" />
      </>
    ),
    chev: <path d="M9 6l6 6-6 6" {...p} />,
    chevD: <path d="M6 9l6 6 6-6" {...p} />,
    up: <path d="M12 19V5m0 0 6 6m-6-6-6 6" {...p} />,
    down: <path d="M12 5v14m0 0 6-6m-6 6-6-6" {...p} />,
    search: (
      <>
        <circle cx="11" cy="11" r="6.5" {...p} />
        <path d="m16 16 4.5 4.5" {...p} />
      </>
    ),
    x: <path d="M6 6l12 12M18 6 6 18" {...p} />,
    camera: (
      <>
        <path
          d="M4 8.5h3l1.4-2h7.2L17 8.5h3a1.6 1.6 0 0 1 1.6 1.6v8a1.6 1.6 0 0 1-1.6 1.6H4A1.6 1.6 0 0 1 2.4 18v-8A1.6 1.6 0 0 1 4 8.5Z"
          {...p}
        />
        <circle cx="12" cy="13.5" r="3.3" {...p} />
      </>
    ),
    drop: <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" {...p} />,
    cal: (
      <>
        <rect x="3.5" y="5" width="17" height="16" rx="2" {...p} />
        <path d="M3.5 9.5h17M8 3v4M16 3v4" {...p} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" {...p} />
        <path d="M12 7v5l3.2 2" {...p} />
      </>
    ),
    bell: (
      <>
        <path
          d="M6 9.5a6 6 0 0 1 12 0c0 4.2 1.6 5.5 2.2 6H3.8c.6-.5 2.2-1.8 2.2-6Z"
          {...p}
        />
        <path d="M9.5 19a2.5 2.5 0 0 0 5 0" {...p} />
      </>
    ),
    cog: (
      <>
        <circle cx="12" cy="12" r="3.2" {...p} />
        <path
          d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3"
          {...p}
        />
      </>
    ),
    shield: (
      <>
        <path
          d="M12 3 5 5.5V11c0 4.4 3 7.7 7 9 4-1.3 7-4.6 7-9V5.5L12 3Z"
          {...p}
        />
        <path d="m9 11.5 2 2 4-4" {...p} />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" {...p} />
        <circle cx="12" cy="10" r="2.6" {...p} />
      </>
    ),
    edit: (
      <>
        <path d="M4 20h4L19 9l-4-4L4 16v4Z" {...p} />
        <path d="m14 6 4 4" {...p} />
      </>
    ),
    bolt: <path d="M13 3 5 13h5l-1 8 8-11h-5l1-7Z" {...p} />,
    lock: (
      <>
        <rect x="4.5" y="10.5" width="15" height="10" rx="2" {...p} />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...p} />
        <circle cx="12" cy="15.3" r="1.1" fill={color} stroke="none" />
      </>
    ),
    car: (
      <>
        <path
          d="M3 13.5 4.6 8.6A2 2 0 0 1 6.5 7.2h11a2 2 0 0 1 1.9 1.4L21 13.5"
          {...p}
        />
        <path
          d="M2.5 13.5h19v4.2a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1v-1H7v1a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1v-4.2Z"
          {...p}
        />
        <path d="M6 16h1.5M16.5 16H18" {...p} />
      </>
    ),
    hash: <path d="M9 4 7 20M17 4l-2 16M5 9h15M4 15h15" {...p} />,
    building: (
      <>
        <path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" {...p} />
        <path d="M15 9h2.5A1.5 1.5 0 0 1 19 10.5V21" {...p} />
        <path d="M3 21h18M8.5 7h3M8.5 11h3M8.5 15h3" {...p} />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: 'block', flexShrink: 0 }}
      fill={fill}
    >
      {paths[name] ?? null}
    </svg>
  );
}
