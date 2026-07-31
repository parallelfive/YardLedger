// Timezone-aware date helpers. A yard's legal "day" (receipt numbering, the
// daily sequence reset, day-close totals, and the state-report datetime) is
// defined by the COMPANY's timezone (company_settings.timezone, migration 7),
// NOT the browser/device clock. Comparing with a plain `new Date()` puts an
// evening buy in the wrong calendar day for anyone whose machine isn't set to
// the yard's zone. These format/compare against an IANA timezone instead.
//
// All helpers fall back to the runtime's local zone when `tz` is empty or
// invalid, so a misconfigured company degrades to the old behavior rather than
// throwing.

function safeZone(tz: string | null | undefined): string {
  if (tz?.trim()) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

// 'YYYY-MM-DD' for the given instant in `tz` (en-CA formats as ISO date).
export function localDateInTz(instant: string | Date, tz: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: safeZone(tz),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    // Invalid zone string — fall back to the device date.
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}

// Do two instants land on the same calendar day in `tz`?
export function isSameDayInTz(
  a: string | Date,
  b: string | Date,
  tz: string
): boolean {
  return localDateInTz(a, tz) === localDateInTz(b, tz);
}

// Is `instant` "today" in `tz`?
export function isTodayInTz(instant: string | Date, tz: string): boolean {
  return isSameDayInTz(instant, new Date(), tz);
}

// 'YYYY-MM-DD HH:mm:ss' for the given instant in `tz` — for the state-report
// datetime column, so it agrees with the receipt number's local date instead of
// being a raw UTC timestamp.
export function localDateTimeInTz(instant: string | Date, tz: string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: safeZone(tz),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    // hour can come back as '24' at midnight in some engines — normalize.
    const hh = get('hour') === '24' ? '00' : get('hour');
    return `${get('year')}-${get('month')}-${get('day')} ${hh}:${get('minute')}:${get('second')}`;
  } catch {
    return d.toISOString();
  }
}
