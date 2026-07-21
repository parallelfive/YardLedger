import { describe, it, expect } from 'vitest';
import { parseAamva, looksLikeAamva } from './parseAamva';

// The ID-scanner autofill hinges on this parser reading a real license barcode
// correctly. These cover the shapes a USB scanner actually emits: a clean
// newline-delimited payload, a payload whose separators got stripped (single
// line), the legacy comma-joined name field, and US vs Canadian date order.

// A well-formed AAMVA payload with the ANSI compliance header and newline
// separators — the common case.
const STANDARD = [
  '@',
  'ANSI 636000090002DL00410288ZV03290015DL',
  'DAQD12345678',
  'DCSMARTINEZ',
  'DACCARLOS',
  'DADRAY',
  'DBB03151985',
  'DAG742 EVERGREEN TER',
  'DAIALBUQUERQUE',
  'DAJNM',
  'DAK871100000',
  'DCGUSA',
].join('\n');

describe('parseAamva', () => {
  it('parses a standard newline-delimited US license', () => {
    const p = parseAamva(STANDARD);
    expect(p.name).toBe('Carlos Ray Martinez');
    expect(p.driversLicense).toBe('D12345678');
    expect(p.dob).toBe('03/15/1985');
    expect(p.address).toBe('742 Evergreen Ter');
    expect(p.city).toBe('Albuquerque');
    expect(p.state).toBe('NM');
    expect(p.zip).toBe('87110'); // truncated from the 9-digit ZIP+4
    expect(p.stateOfIssue).toBe('NM');
  });

  it('falls back to code-boundary tokenizing when separators are stripped', () => {
    // Some scanners/keyboard wedges deliver the payload as one unbroken line.
    const flat =
      '@ANSI 636000090002DAQX9988776DCSDOEDACJANEDBB07041990DAJTXDAK733011234DCGUSA';
    const p = parseAamva(flat);
    expect(p.name).toBe('Jane Doe');
    expect(p.driversLicense).toBe('X9988776');
    expect(p.dob).toBe('07/04/1990');
    expect(p.state).toBe('TX');
    expect(p.zip).toBe('73301');
  });

  it('reads the legacy DAA "LAST,FIRST,MIDDLE" name when discrete fields are absent', () => {
    const legacy = [
      '@',
      'ANSI 636000090002',
      'DAQY1112223',
      'DAADOE,JOHN,QUINCY',
      'DBB12312000',
    ].join('\n');
    const p = parseAamva(legacy);
    expect(p.name).toBe('John Quincy Doe');
    expect(p.driversLicense).toBe('Y1112223');
    expect(p.dob).toBe('12/31/2000');
  });

  it('normalizes a Canadian CCYYMMDD birth date', () => {
    const can = [
      '@',
      'ANSI 636000090002',
      'DAQC0001112',
      'DCSTREMBLAY',
      'DACMARIE',
      'DBB19850315',
      'DCGCAN',
    ].join('\n');
    const p = parseAamva(can);
    expect(p.dob).toBe('03/15/1985');
    expect(p.name).toBe('Marie Tremblay');
  });

  it('uppercases the license number and returns null for an out-of-range date', () => {
    const bad = [
      '@',
      'ANSI 636000090002',
      'DAQd12345678',
      'DCSLOWER',
      'DACcase',
      'DBB13012000', // month 13 — invalid
    ].join('\n');
    const p = parseAamva(bad);
    expect(p.driversLicense).toBe('D12345678');
    expect(p.dob).toBeNull();
  });

  it('returns all-null for empty or codeless input', () => {
    // parseAamva is deliberately lenient — it extracts whatever element codes it
    // finds. The gate against human-typed junk is looksLikeAamva (below), not
    // the parser. So it only returns all-null when there are genuinely no codes.
    for (const input of ['', 'hello world', '   ']) {
      const p = parseAamva(input);
      expect(p.name).toBeNull();
      expect(p.driversLicense).toBeNull();
      expect(p.dob).toBeNull();
      expect(p.state).toBeNull();
    }
  });
});

describe('looksLikeAamva', () => {
  it('accepts a real payload (ANSI header + element codes)', () => {
    expect(looksLikeAamva(STANDARD)).toBe(true);
    expect(looksLikeAamva('@ANSI 636000090002DAQX1DCSDOE')).toBe(true);
  });

  it('rejects ordinary typed text so manual entry never mis-parses', () => {
    expect(looksLikeAamva('')).toBe(false);
    expect(looksLikeAamva('John Smith')).toBe(false);
    // Has a code but no ANSI/@ header — a human typing "DAQ" shouldn't trip it.
    expect(looksLikeAamva('DAQ12345')).toBe(false);
  });
});
