import { describe, it, expect } from 'vitest';
import { matchesQuery } from './textSearch';

describe('matchesQuery', () => {
  it('matches everything for a blank or whitespace query', () => {
    expect(matchesQuery('Copper #1', '')).toBe(true);
    expect(matchesQuery('Copper #1', '   ')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesQuery('Bare Bright Copper', 'copper')).toBe(true);
    expect(matchesQuery('bare bright copper', 'COPPER')).toBe(true);
  });

  it('matches on a substring anywhere in the name', () => {
    expect(matchesQuery('Aluminum Rims', 'rim')).toBe(true);
    expect(matchesQuery('Catalytic Converter', 'conv')).toBe(true);
  });

  it('trims surrounding whitespace from the query', () => {
    expect(matchesQuery('Yellow Brass', '  brass  ')).toBe(true);
  });

  it('returns false when the substring is absent', () => {
    expect(matchesQuery('Copper #2', 'steel')).toBe(false);
  });
});
