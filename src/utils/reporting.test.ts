import { describe, it, expect } from 'vitest';
import { lineIsReportable, receiptIsReportable } from './reporting';

const cans = (weight: number) => ({
  is_regulated: true,
  is_restricted: false,
  is_report_exempt: true,
  weight,
});
const copper = { is_regulated: true, is_restricted: false, weight: 50 };
const restricted = { is_regulated: true, is_restricted: true, weight: 5 };
const nonRegulated = { is_regulated: false, is_restricted: false, weight: 100 };

describe('lineIsReportable', () => {
  it('always reports regulated non-exempt metal (copper/brass/bronze/lead)', () => {
    expect(lineIsReportable(copper)).toBe(true);
  });

  it('exempts aluminum/steel below one ton', () => {
    expect(lineIsReportable(cans(1999))).toBe(false);
  });

  it('reports aluminum/steel at or above one ton', () => {
    expect(lineIsReportable(cans(2000))).toBe(true);
    expect(lineIsReportable(cans(5000))).toBe(true);
  });

  it('always reports restricted material', () => {
    expect(lineIsReportable(restricted)).toBe(true);
  });

  it('never reports non-regulated material', () => {
    expect(lineIsReportable(nonRegulated)).toBe(false);
  });

  it('reads the exempt flag off a joined metal too', () => {
    expect(
      lineIsReportable({
        is_regulated: true,
        weight: 100,
        metals: { is_report_exempt: true },
      })
    ).toBe(false); // 100 lb of cans → exempt
  });
});

describe('receiptIsReportable', () => {
  it('reports a catalytic receipt regardless of lines', () => {
    expect(receiptIsReportable({ is_catalytic: true, line_items: [] })).toBe(
      true
    );
  });

  it('reports a cans-only buy below a ton = NO', () => {
    expect(receiptIsReportable({ line_items: [cans(500)] })).toBe(false);
  });

  it('reports copper bought WITH cans (the whole ticket goes up)', () => {
    // Kennon: copper must be reported even when purchased with non-reported cans.
    expect(receiptIsReportable({ line_items: [cans(500), copper] })).toBe(true);
  });

  it('does not report a non-regulated-only buy', () => {
    expect(receiptIsReportable({ line_items: [nonRegulated] })).toBe(false);
  });
});
