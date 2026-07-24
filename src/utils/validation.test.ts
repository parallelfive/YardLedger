import { describe, it, expect } from 'vitest';
import {
  safeParseNumber,
  validateWeight,
  validatePrice,
  escapeHtml,
} from './validation';

describe('safeParseNumber', () => {
  it('accepts well-formed integers and decimals', () => {
    expect(safeParseNumber('12')).toBe(12);
    expect(safeParseNumber('12.5')).toBe(12.5);
    expect(safeParseNumber('-3')).toBe(-3);
    expect(safeParseNumber('0')).toBe(0);
    expect(safeParseNumber('  7  ')).toBe(7); // trims
  });

  it('rejects junk parseFloat would partially consume', () => {
    // These are the ones that silently corrupt a weight/price if not gated.
    for (const bad of ['', '   ', 'abc', '1.2.3', '12px', '1e5', '.5', '5.']) {
      expect(safeParseNumber(bad)).toBeNull();
    }
  });

  it('rejects non-finite words', () => {
    expect(safeParseNumber('Infinity')).toBeNull();
    expect(safeParseNumber('NaN')).toBeNull();
  });
});

describe('validateWeight', () => {
  it('accepts a positive weight within range', () => {
    expect(validateWeight('100')).toBe(100);
    expect(validateWeight('99999')).toBe(99999); // upper bound inclusive
  });

  it('rejects zero, negatives, over-max, and junk', () => {
    expect(validateWeight('0')).toBeNull();
    expect(validateWeight('-5')).toBeNull();
    expect(validateWeight('100000')).toBeNull(); // over 99999
    expect(validateWeight('abc')).toBeNull();
    expect(validateWeight('')).toBeNull();
  });
});

describe('validatePrice', () => {
  it('accepts a positive price within range', () => {
    expect(validatePrice('2.5')).toBe(2.5);
    expect(validatePrice('9999')).toBe(9999); // upper bound inclusive
  });

  it('rejects zero, negatives, over-max, and junk', () => {
    expect(validatePrice('0')).toBeNull();
    expect(validatePrice('-1')).toBeNull();
    expect(validatePrice('10000')).toBeNull(); // over 9999
    expect(validatePrice('')).toBeNull();
  });
});

describe('escapeHtml', () => {
  it('escapes the characters that would break a print template', () => {
    expect(escapeHtml('a & b < c > d "e"')).toBe(
      'a &amp; b &lt; c &gt; d &quot;e&quot;'
    );
  });

  it('escapes ampersands first so entities are not double-encoded', () => {
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });
});
