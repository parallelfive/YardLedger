import { useState, useEffect, useCallback } from 'react';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReceipts(workerId, startDate, endDate);
      setReceipts(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workerId, startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { receipts, loading, error, refresh: load };
}
