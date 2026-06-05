import { useAppSelector, type RootState } from '../store';

/** The role the UI should gate on: the staffer PIN'd in for the shift
 * (activeIdentity), falling back to the device's session profile. Server RLS
 * still derives from the session user — see docs/TARE_REBRAND.md. */
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
