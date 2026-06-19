import { useAppSelector, type RootState } from '../store';

/** The role the UI should gate on: the staffer PIN'd in for the shift
 * (activeIdentity), falling back to the device's session profile. This is an
 * affordance gate only (show/hide admin buttons) — NOT the security boundary.
 * Privileged DB writes are enforced server-side via admin-elevation windows
 * (has_admin_elevation); screens call useAdminElevation().ensureElevated()
 * before the action. See migrations 20260618000002-4. */
export function useRole(): {
  role: 'worker' | 'admin' | 'owner' | null;
  isAdmin: boolean;
  isOwner: boolean;
} {
  const role = useAppSelector(
    (s: RootState) =>
      s.auth.activeIdentity?.role ?? s.auth.profile?.role ?? null
  );
  return {
    role,
    isAdmin: role === 'admin' || role === 'owner',
    isOwner: role === 'owner',
  };
}
