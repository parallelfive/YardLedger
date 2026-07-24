import { describe, it, expect } from 'vitest';
import type { LineItemInput } from '../types';
import {
  calculateNetWeight,
  calculateLineItemTotal,
  calculateReceiptTotal,
  calculateCurrentPreview,
  calculateInventoryValue,
  calculateTotalProfit,
} from './calculations';

describe('calculateNetWeight', () => {
  it('uses the directly-weighed net in net mode', () => {
    expect(calculateNetWeight('net', { net: 250 })).toBe(250);
    expect(calculateNetWeight('net', {})).toBe(0);
  });

  it('subtracts tare from gross in tare mode', () => {
    expect(calculateNetWeight('tare', { gross: 8000, tare: 6200 })).toBe(1800);
  });

  it('clamps at 0 when tare exceeds gross (half-entered ticket)', () => {
    // Tare typed before gross must never produce a negative payable weight.
    expect(calculateNetWeight('tare', { gross: 0, tare: 6200 })).toBe(0);
    expect(calculateNetWeight('tare', { tare: 500 })).toBe(0);
  });

  it('treats a missing tare as zero', () => {
    expect(calculateNetWeight('tare', { gross: 1200 })).toBe(1200);
  });
});

describe('calculateLineItemTotal', () => {
  it('rounds to cents and cancels floating-point drift', () => {
    // 3 * 0.1 === 0.30000000000000004 in IEEE-754; rounding must return 0.3.
    expect(calculateLineItemTotal(3, 0.1)).toBe(0.3);
    expect(calculateLineItemTotal(100, 0.45)).toBe(45);
  });

  it('rounds half-cents by magnitude', () => {
    expect(calculateLineItemTotal(1, 1.234)).toBe(1.23); // down
    expect(calculateLineItemTotal(1, 1.236)).toBe(1.24); // up
  });
});

describe('calculateReceiptTotal', () => {
  it('sums the pre-rounded line totals', () => {
    const items = [{ total: 10 }, { total: 5.5 }, { total: 0.3 }];
    expect(calculateReceiptTotal(items as unknown as LineItemInput[])).toBe(
      15.8
    );
  });

  it('is 0 for an empty ticket', () => {
    expect(calculateReceiptTotal([])).toBe(0);
  });
});

describe('calculateCurrentPreview', () => {
  it('parses the weight string and rounds to cents', () => {
    expect(calculateCurrentPreview('12.5', 2)).toBe(25);
  });

  it('treats blank or non-numeric input as 0', () => {
    expect(calculateCurrentPreview('', 5)).toBe(0);
    expect(calculateCurrentPreview('abc', 5)).toBe(0);
  });
});

describe('calculateInventoryValue', () => {
  it('multiplies weight by average cost (no rounding)', () => {
    expect(calculateInventoryValue(100, 0.5)).toBe(50);
  });
});

describe('calculateTotalProfit', () => {
  it('sums numeric and string profit values', () => {
    expect(calculateTotalProfit([{ profit: '10.5' }, { profit: 2 }])).toBe(
      12.5
    );
  });

  it('is 0 with no sales', () => {
    expect(calculateTotalProfit([])).toBe(0);
  });
});
