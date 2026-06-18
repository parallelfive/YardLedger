import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAppDispatch } from '../store';
import { setOnline } from '../store/appStore';
import { probeOnline } from '../services/connectivity';

const POLL_MS = 15000;

// Periodically probes backend reachability and keeps app.isOnline in sync.
// Also re-checks immediately when the app returns to the foreground. Mount once,
// near the app root. Returns nothing — it only drives Redux state.
export function useConnectivity(onReconnect?: () => void) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let active = true;
    let wasOnline = true;

    const check = async () => {
      const online = await probeOnline();
      if (!active) return;
      dispatch(setOnline(online));
      if (online && !wasOnline) onReconnect?.();
      wasOnline = online;
    };

    check();
    const interval = setInterval(check, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') check();
    });

    return () => {
      active = false;
      clearInterval(interval);
      sub.remove();
    };
  }, [dispatch, onReconnect]);
}
