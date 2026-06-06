import { useState, useCallback } from 'react';
import PasscodeLoginScreen, {
  type TareRole,
} from '../screens/auth/PasscodeLoginScreen';
import { validatePin } from '../services/pin';
import { useAppDispatch, useAppSelector, type RootState } from '../store';
import { setActiveIdentity, signOut } from '../store/authStore';

/** Shown when the device has a company session but the terminal is locked
 * (no active staff identity). Validates the PIN → attributes the shift. */
export default function PasscodeGate() {
  const dispatch = useAppDispatch();
  const company = useAppSelector((s: RootState) => s.auth.company);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failNonce, setFailNonce] = useState(0);

  const onSubmit = useCallback(
    async (pin: string, _role: TareRole) => {
      setBusy(true);
      setError(null);
      try {
        const identity = await validatePin(pin);
        dispatch(setActiveIdentity(identity));
      } catch (e) {
        setError((e as Error).message || 'Wrong passcode');
        setFailNonce((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [dispatch]
  );

  return (
    <PasscodeLoginScreen
      companyName={company?.name ?? 'Tare'}
      busy={busy}
      error={error}
      failNonce={failNonce}
      onSubmit={onSubmit}
      onSignOut={() => dispatch(signOut())}
    />
  );
}
