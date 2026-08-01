import { localDateInTz } from './timezone';

export type DatePreset = 'today' | 'week' | 'month';

// Calendar-date arithmetic anchored at UTC midnight so subtracting days/months
// never drifts across a DST boundary; toISOString's date half is the same
// Y-M-D we put in.
function shiftDate(ymd: string, mutate: (d: Date) => void): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d));
  mutate(anchor);
  return anchor.toISOString().slice(0, 10);
}

// The date-range boundaries for a preset, resolved in the yard's LEGAL timezone
// (company_settings.timezone) rather than the device clock — an evening buy must
// land in the same reporting day the receipt number used (#111). `tz` empty (the
// default, e.g. before useCompanyTimezone resolves) falls back to the device
// zone via localDateInTz, preserving the prior behavior.
export function getDateRange(
  preset: DatePreset,
  tz = ''
): {
  start: string;
  end: string;
} {
  const end = localDateInTz(new Date(), tz);

  switch (preset) {
    case 'today':
      return { start: end, end };
    case 'week':
      return {
        start: shiftDate(end, (d) => d.setUTCDate(d.getUTCDate() - 7)),
        end,
      };
    case 'month':
      return {
        start: shiftDate(end, (d) => d.setUTCMonth(d.getUTCMonth() - 1)),
        end,
      };
  }
}

// Convert a local calendar date (YYYY-MM-DD, as produced by getDateRange) to the
// UTC instant for the start / end of that day in the device's timezone.
//
// Report and list filters compare against `created_at`, which is a Postgres
// `timestamptz` (UTC). Passing a naive "YYYY-MM-DDT00:00:00" string makes
// Postgres interpret it as UTC, so an evening transaction in a behind-UTC
// timezone (e.g. America/Denver) is stored on the next UTC day and silently
// drops out of "today"/"week" reports. Parsing the same string WITHOUT an
// offset uses local time, and toISOString() yields the correct UTC instant for
// that local day boundary.
export function startOfLocalDayUtc(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function endOfLocalDayUtc(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
