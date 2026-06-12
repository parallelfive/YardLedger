import { useState, useEffect, useCallback, useRef } from 'react';
import type { Metal } from '../types';
import { fetchMetals } from '../services/metals';

export function useMetals() {
  const [metals, setMetals] = useState<Metal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignore a stale response that resolves after a newer load (see useReceipts).
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMetals();
      if (myReq === reqId.current) setMetals(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { metals, loading, error, refresh: load };
}
