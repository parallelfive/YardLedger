import { describe, it, expect } from 'vitest';
import {
  localDateInTz,
  isSameDayInTz,
  isTodayInTz,
  localDateTimeInTz,
} from './timezone';

describe('localDateInTz', () => {
  it('returns the local calendar date for the given zone', () => {
    // 2026-07-26T01:00:00Z is still 2026-07-25 (7pm) in Denver (MDT, UTC-6).
    expect(localDateInTz('2026-07-26T01:00:00Z', 'America/Denver')).toBe(
      '2026-07-25'
    );
    // Same instant is already the 26th in UTC.
    expect(localDateInTz('2026-07-26T01:00:00Z', 'UTC')).toBe('2026-07-26');
  });

  it('handles a zone ahead of UTC', () => {
    // 2026-07-25T23:00:00Z is 2026-07-26 (9am) in Tokyo (UTC+9).
    expect(localDateInTz('2026-07-25T23:00:00Z', 'Asia/Tokyo')).toBe(
      '2026-07-26'
    );
  });

  it('falls back to the device date on an invalid zone instead of throwing', () => {
    expect(() =>
      localDateInTz('2026-07-26T01:00:00Z', 'Not/AZone')
    ).not.toThrow();
    expect(localDateInTz('2026-07-26T01:00:00Z', 'Not/AZone')).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });
});

describe('isSameDayInTz / isTodayInTz', () => {
  it('two instants on the same yard-local day match even across the UTC boundary', () => {
    // 7pm and 11pm Denver on the 25th — different only if you (wrongly) use UTC.
    expect(
      isSameDayInTz(
        '2026-07-26T01:00:00Z',
        '2026-07-26T04:59:00Z',
        'America/Denver'
      )
    ).toBe(true);
  });

  it('is false across a real day boundary', () => {
    expect(
      isSameDayInTz(
        '2026-07-26T05:00:00Z', // 11pm Denver 25th
        '2026-07-26T07:00:00Z', // 1am Denver 26th
        'America/Denver'
      )
    ).toBe(false);
  });

  it('isTodayInTz compares against now', () => {
    expect(isTodayInTz(new Date(), 'America/Denver')).toBe(true);
    expect(isTodayInTz('2000-01-01T00:00:00Z', 'America/Denver')).toBe(false);
  });
});

describe('localDateTimeInTz', () => {
  it('formats the instant in the zone as YYYY-MM-DD HH:mm:ss', () => {
    // 01:00 UTC → 19:00 on the prior day in Denver.
    expect(localDateTimeInTz('2026-07-26T01:00:00Z', 'America/Denver')).toBe(
      '2026-07-25 19:00:00'
    );
  });

  it('agrees on date with localDateInTz (the receipt-number date)', () => {
    const iso = '2026-07-26T03:30:00Z';
    const tz = 'America/Denver';
    expect(localDateTimeInTz(iso, tz).slice(0, 10)).toBe(
      localDateInTz(iso, tz)
    );
  });
});
