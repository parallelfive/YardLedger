// Jurisdiction registry. Add a state = add a module and register it here.
// getJurisdiction(company_settings.state) selects the active one; unknown or
// unset falls back to New Mexico (this build's home state) so behavior is never
// undefined for an existing yard.

import type { Jurisdiction } from './types';
import { newMexico } from './nm';

export * from './types';

export const DEFAULT_JURISDICTION = 'NM';

const REGISTRY: Record<string, Jurisdiction> = {
  NM: newMexico,
};

// Accept a 2-letter code or a full state name ('New Mexico'); case-insensitive.
export function getJurisdiction(state?: string | null): Jurisdiction {
  const key = (state ?? '').trim().toUpperCase();
  if (REGISTRY[key]) return REGISTRY[key];
  const byName = Object.values(REGISTRY).find(
    (j) => j.copy.stateName.toUpperCase() === key
  );
  return byName ?? REGISTRY[DEFAULT_JURISDICTION];
}

export function supportedStateCodes(): string[] {
  return Object.keys(REGISTRY);
}
