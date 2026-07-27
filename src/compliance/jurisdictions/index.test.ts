import { describe, it, expect } from 'vitest';
import { getJurisdiction, DEFAULT_JURISDICTION } from './index';

describe('getJurisdiction', () => {
  it('resolves New Mexico by 2-letter code (case-insensitive)', () => {
    expect(getJurisdiction('NM').code).toBe('NM');
    expect(getJurisdiction('nm').code).toBe('NM');
  });

  it('resolves by full state name', () => {
    expect(getJurisdiction('New Mexico').code).toBe('NM');
  });

  it('falls back to the default jurisdiction for unknown/empty', () => {
    expect(getJurisdiction('').code).toBe(DEFAULT_JURISDICTION);
    expect(getJurisdiction(undefined).code).toBe(DEFAULT_JURISDICTION);
    expect(getJurisdiction('ZZ').code).toBe(DEFAULT_JURISDICTION);
  });

  it('carries NM rules + copy on the resolved jurisdiction', () => {
    const j = getJurisdiction('NM');
    expect(j.copy.registry).toBe('LeadsOnline');
    expect(j.reportExemptMinLbs).toBe(2000);
    // catalytic receipt is always reportable
    expect(j.receiptIsReportable({ is_catalytic: true })).toBe(true);
    // exempt (aluminum/steel) under a ton is NOT reportable on its own
    expect(
      j.lineIsReportable({
        is_regulated: true,
        is_report_exempt: true,
        weight: 500,
      })
    ).toBe(false);
    expect(
      j.lineIsReportable({
        is_regulated: true,
        is_report_exempt: true,
        weight: 2500,
      })
    ).toBe(true);
  });
});
