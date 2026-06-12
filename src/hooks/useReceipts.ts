import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchReceipts } from '../services/receipts';

export function useReceipts(
  workerId?: string,
  startDate?: string,
  endDate?: string
) {
  const [receipts, setReceipts] = useState<
    Awaited<ReturnType<typeof fetchReceipts>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignore a slow response that resolves after a newer load has been kicked off
  // (e.g. filters changed rapidly) so stale data can't clobber fresh data.
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReceipts(workerId, startDate, endDate);
      if (myReq === reqId.current) setReceipts(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, [workerId, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { receipts, loading, error, refresh: load };
}
