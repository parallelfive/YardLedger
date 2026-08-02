// Case- and whitespace-insensitive substring match for filtering local lists
// (material pickers, seller lookups). A blank query matches everything, so the
// full list shows before the operator types. Kept pure + framework-free so both
// the mobile RN pickers and desktop can share it and it's unit-testable in the
// node vitest env (no RN module graph).
export function matchesQuery(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return haystack.toLowerCase().includes(q);
}
