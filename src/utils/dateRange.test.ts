import { describe, it, expect } from 'vitest';
import { startOfLocalDayUtc, endOfLocalDayUtc } from './dateRange';

// These convert a local calendar date to the UTC instant of that local day's
// start/end. The exact UTC string depends on the runner's timezone, so we
// assert the timezone-independent contract: the returned UTC instant, read back
// in local time, is midnight / end-of-day of the SAME calendar date. This is
// what keeps an evening buy in a behind-UTC zone from dropping out of "today".

describe('startOfLocalDayUtc', () => {
  it('returns a UTC ISO string', () => {
    expect(startOfLocalDayUtc('2026-07-21')).toMatch(/Z$/);
  });

  it('round-trips to local midnight of the same date', () => {
    const d = new Date(startOfLocalDayUtc('2026-07-21'));
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July (0-indexed)
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });
});

describe('endOfLocalDayUtc', () => {
  it('round-trips to the last millisecond of the same local date', () => {
    const d = new Date(endOfLocalDayUtc('2026-07-21'));
    expect(d.getDate()).toBe(21);
    expect(d.getHours()).toBe(23);
    expect(d.getMinutes()).toBe(59);
    expect(d.getSeconds()).toBe(59);
    expect(d.getMilliseconds()).toBe(999);
  });
});

describe('day boundaries order correctly', () => {
  it('start precedes end within a day', () => {
    expect(
      startOfLocalDayUtc('2026-07-21') < endOfLocalDayUtc('2026-07-21')
    ).toBe(true);
  });

  it("one day's end precedes the next day's start", () => {
    // No gap/overlap: 07-21 end is strictly before 07-22 start.
    expect(
      endOfLocalDayUtc('2026-07-21') < startOfLocalDayUtc('2026-07-22')
    ).toBe(true);
  });
});
