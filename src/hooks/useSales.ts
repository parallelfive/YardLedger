import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchSales } from '../services/sales';

export function useSales(startDate?: string, endDate?: string) {
  const [sales, setSales] = useState<Awaited<ReturnType<typeof fetchSales>>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignore a stale response that resolves after a newer load (see useReceipts).
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSales(startDate, endDate);
      if (myReq === reqId.current) setSales(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { sales, loading, error, refresh: load };
}
