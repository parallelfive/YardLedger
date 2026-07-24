import { describe, it, expect } from 'vitest';
import { parseDriversLicense } from './parseDriversLicense';

// The OCR fallback (mobile) for the front of a license — heuristic and best
// effort, unlike the barcode parser (parseAamva). These lock the robust
// extractions: the DL number, the birth date (incl. 2-digit-year pivot and
// avoiding the expiration date), and a clean name/address happy path.

describe('parseDriversLicense — DL number', () => {
  it('reads a labeled license number', () => {
    expect(parseDriversLicense('DL: D1234567').driversLicense).toBe('D1234567');
    expect(parseDriversLicense('LIC NO: AB1234').driversLicense).toBe('AB1234');
  });

  it('falls back to a common state format (letter + digits)', () => {
    expect(parseDriversLicense('SOME TEXT D12345678 MORE').driversLicense).toBe(
      'D12345678'
    );
  });
});

describe('parseDriversLicense — DOB', () => {
  it('reads and ISO-normalizes a labeled birth date', () => {
    expect(parseDriversLicense('DOB: 03/15/1985').dob).toBe('1985-03-15');
  });

  it('pivots a 2-digit year around 50', () => {
    expect(parseDriversLicense('DOB 03/15/85').dob).toBe('1985-03-15');
    expect(parseDriversLicense('DOB 03/15/20').dob).toBe('2020-03-15');
  });

  it('does not mistake the expiration date for the birth date', () => {
    // No DOB label — the EXP date must be stripped before the date scan.
    const dob = parseDriversLicense('EXP 01/01/2030\n05/05/1990').dob;
    expect(dob).toBe('1990-05-05');
  });
});

describe('parseDriversLicense — name & address', () => {
  it('extracts an all-caps name and a street→zip address', () => {
    const text = [
      'JOHN MICHAEL SMITH',
      '123 MAIN ST',
      'ALBUQUERQUE NM 87110',
      'DOB 03/15/1985',
    ].join('\n');
    const p = parseDriversLicense(text);
    expect(p.name).toBe('JOHN MICHAEL SMITH');
    expect(p.address).toBe('123 MAIN ST, ALBUQUERQUE NM 87110');
    expect(p.dob).toBe('1985-03-15');
  });
});

describe('parseDriversLicense — nothing to read', () => {
  it('returns all-null for empty or unstructured text', () => {
    const p = parseDriversLicense('');
    expect(p.name).toBeNull();
    expect(p.address).toBeNull();
    expect(p.dob).toBeNull();
    expect(p.driversLicense).toBeNull();
  });
});
