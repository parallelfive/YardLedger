import { useEffect, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useAppSelector, type RootState } from '../store';

// Re-fetch the given loader when connectivity returns (app.lastSyncedAt bumps on
// reconnect + outbox replay), but only if the screen is currently focused — so
// the data the user is looking at updates itself without a manual tab switch.
// A blurred screen is left to its own useFocusEffect to refresh when shown.
export function useRefreshOnReconnect(refresh: () => void) {
  const lastSyncedAt = useAppSelector((s: RootState) => s.app.lastSyncedAt);
  const isFocused = useIsFocused();
  const seen = useRef(lastSyncedAt);

  useEffect(() => {
    if (lastSyncedAt === seen.current) return;
    const wasFocused = isFocused;
    seen.current = lastSyncedAt; // consume the tick either way
    if (wasFocused) refresh();
  }, [lastSyncedAt, isFocused, refresh]);
}
