// Convert a local calendar date (YYYY-MM-DD, as produced by getDateRange) to the
// UTC instant for the start / end of that day in the device's timezone.
//
// Report and list filters compare against `created_at`, which is a Postgres
// `timestamptz` (UTC). Passing a naive "YYYY-MM-DDT00:00:00" string makes
// Postgres interpret it as UTC, so an evening transaction in a behind-UTC
// timezone (e.g. America/Denver) is stored on the next UTC day and silently
// drops out of "today"/"week" reports. Parsing the same string WITHOUT an
// offset uses local time, and toISOString() yields the correct UTC instant for
// that local day boundary.
export function startOfLocalDayUtc(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

export function endOfLocalDayUtc(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}
