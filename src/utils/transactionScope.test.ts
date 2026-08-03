import { describe, it, expect } from 'vitest';
import { resolveStafferScopeUserId } from './transactionScope';

describe('resolveStafferScopeUserId (#50)', () => {
  it('admins/owners see the whole yard (no user filter)', () => {
    expect(resolveStafferScopeUserId(true, 'staffer-1', 'device-9')).toBe(
      undefined
    );
  });

  it('a worker is scoped to the staffer PIN`d in at the terminal', () => {
    // The regression: the shared device is signed in as device-9, but staffer-1
    // is on shift — the list must show staffer-1's buys, not device-9's.
    expect(resolveStafferScopeUserId(false, 'staffer-1', 'device-9')).toBe(
      'staffer-1'
    );
  });

  it('falls back to the device account when nobody is PIN`d in', () => {
    expect(resolveStafferScopeUserId(false, undefined, 'device-9')).toBe(
      'device-9'
    );
  });

  it('returns undefined for a worker with neither identity resolved', () => {
    expect(resolveStafferScopeUserId(false, undefined, undefined)).toBe(
      undefined
    );
  });
});
