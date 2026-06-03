// WatermelonDB ⇄ Supabase sync is NOT implemented.
//
// The previous version of this file LOOKED like working sync but its
// pullChanges/pushChanges were empty no-ops: calling it would advance
// WatermelonDB's sync checkpoint while pushing nothing and pulling nothing,
// silently masking the fact that local writes never reach Supabase. That is
// worse than no sync at all, so it is removed.
//
// The app currently operates online-only through the `services/` layer
// (direct Supabase queries). True offline-first sync against the multi-tenant,
// RLS-scoped schema is a separate piece of work: pullChanges must filter by
// company_id, pushChanges must respect every RLS WITH CHECK, and conflicts
// (e.g. server-generated receipt numbers) need a resolution strategy.
//
// This stub throws so that any accidental call is loud rather than silent.
export async function syncDatabase(): Promise<never> {
  throw new Error(
    'syncDatabase() is not implemented — the app runs online-only via services/. ' +
      'Implement company-scoped pull/push before enabling offline sync.'
  );
}
