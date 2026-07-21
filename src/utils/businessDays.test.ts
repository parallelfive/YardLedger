import { describe, it, expect } from 'vitest';
import { reportDueDate, isReportOverdue } from './businessDays';

// Dates are built with the local Date constructor (new Date(y, m, d)) so the
// weekday math is timezone-independent — parsing "2026-07-20" as a string would
// be UTC-midnight and could shift a day in a negative-offset zone.
// Anchor: 2026-07-21 is a Tuesday (confirmed in the app's day-book header).
const MON = new Date(2026, 6, 20); // month is 0-indexed → 6 = July
const FRI = new Date(2026, 6, 24);
const SAT = new Date(2026, 6, 25);

describe('anchor sanity', () => {
  it('has the expected weekdays', () => {
    expect(new Date(2026, 6, 21).getDay()).toBe(2); // Tuesday
    expect(MON.getDay()).toBe(1);
    expect(FRI.getDay()).toBe(5);
    expect(SAT.getDay()).toBe(6);
  });
});

describe('reportDueDate', () => {
  it('adds 2 business days for a mid-week purchase (Mon → Wed)', () => {
    const due = reportDueDate(MON);
    expect(due.getDay()).toBe(3); // Wednesday
    expect(due.getDate()).toBe(22);
  });

  it('skips the weekend (Fri → Tue)', () => {
    const due = reportDueDate(FRI);
    expect(due.getDay()).toBe(2); // Tuesday
    expect(due.getDate()).toBe(28);
  });

  it('counts from a weekend purchase (Sat → Tue)', () => {
    const due = reportDueDate(SAT);
    expect(due.getDay()).toBe(2); // Tuesday
    expect(due.getDate()).toBe(28);
  });

  it('lands on the close of the due business day', () => {
    const due = reportDueDate(MON);
    expect(due.getHours()).toBe(23);
    expect(due.getMinutes()).toBe(59);
    expect(due.getSeconds()).toBe(59);
    expect(due.getMilliseconds()).toBe(999);
  });

  it('honors a custom business-day window', () => {
    // 1 business day from Monday is Tuesday.
    expect(reportDueDate(MON, 1).getDay()).toBe(2);
  });
});

describe('isReportOverdue', () => {
  const purchased = MON.toISOString(); // round-trips to the same local instant

  it('is not overdue before the due moment', () => {
    const tueNoon = new Date(2026, 6, 21, 12); // before Wed 23:59
    expect(isReportOverdue(purchased, 2, tueNoon)).toBe(false);
  });

  it('is overdue after the due moment', () => {
    const thuNoon = new Date(2026, 6, 23, 12); // after Wed 23:59
    expect(isReportOverdue(purchased, 2, thuNoon)).toBe(true);
  });

  it('is not overdue exactly at the due moment (strictly after)', () => {
    const exactly = reportDueDate(MON);
    expect(isReportOverdue(purchased, 2, exactly)).toBe(false);
  });
});
