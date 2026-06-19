import { useCallback, useState } from 'react';
import {
  fetchCurrentDrawer,
  fetchDrawerHistory,
  type CurrentDrawer,
  type DrawerSession,
} from '../services/cashDrawer';

export function useCashDrawer() {
  const [current, setCurrent] = useState<CurrentDrawer | null>(null);
  const [history, setHistory] = useState<DrawerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cur, hist] = await Promise.all([
        fetchCurrentDrawer(),
        fetchDrawerHistory(),
      ]);
      setCurrent(cur);
      setHistory(hist);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { current, history, loading, error, refresh: load };
}
