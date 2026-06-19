import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchInventory } from '../services/inventory';

export function useInventory() {
  const [inventory, setInventory] = useState<
    Awaited<ReturnType<typeof fetchInventory>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignore a stale response that resolves after a newer load (see useReceipts).
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInventory();
      if (myReq === reqId.current) setInventory(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { inventory, loading, error, refresh: load };
}
