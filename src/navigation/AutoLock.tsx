import { useEffect, useRef, type ReactNode } from 'react';
import { View, AppState, Platform } from 'react-native';
import { useAppDispatch, useAppSelector, type RootState } from '../store';
import { lockTerminal } from '../store/authStore';

const IDLE_MS = 5 * 60 * 1000; // lock the terminal after 5 min idle

/** Locks the counter terminal back to the passcode pad after inactivity or a
 * long backgrounding — but only once someone has PIN'd in, so a freshly
 * email-signed-in user (no PIN yet) is never stranded. Resets on any touch. */
export default function AutoLock({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const source = useAppSelector((s: RootState) => s.auth.activeIdentitySource);
  const armed = source === 'pin';
  const last = useRef(Date.now());
  const backgroundedAt = useRef<number | null>(null);
  const armedRef = useRef(armed);
  armedRef.current = armed;

  const bump = () => {
    last.current = Date.now();
  };

  useEffect(() => {
    const tick = setInterval(() => {
      if (armedRef.current && Date.now() - last.current > IDLE_MS) {
        dispatch(lockTerminal());
      }
    }, 20000);

    // On the desktop/web shell an operator can type a long buy form for minutes
    // without a pointer event — the RN responder below only catches touch, so
    // count keystrokes too, or auto-lock destroys the in-progress form (#81).
    let removeWebListeners: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onActivity = () => bump();
      document.addEventListener('keydown', onActivity);
      document.addEventListener('pointerdown', onActivity);
      removeWebListeners = () => {
        document.removeEventListener('keydown', onActivity);
        document.removeEventListener('pointerdown', onActivity);
      };
    }

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (
          armedRef.current &&
          backgroundedAt.current &&
          Date.now() - backgroundedAt.current > IDLE_MS
        ) {
          dispatch(lockTerminal());
        }
        backgroundedAt.current = null;
        last.current = Date.now();
      } else {
        backgroundedAt.current = Date.now();
      }
    });

    return () => {
      clearInterval(tick);
      sub.remove();
      removeWebListeners?.();
    };
  }, [dispatch]);

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        bump();
        return false; // never steal the touch — just note activity
      }}
    >
      {children}
    </View>
  );
}
