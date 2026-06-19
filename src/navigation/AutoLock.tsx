import { useEffect, useRef, type ReactNode } from 'react';
import { View, AppState } from 'react-native';
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
