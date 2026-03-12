import { useState, useEffect, useCallback } from 'react';
import { fetchSales } from '../services/sales';

export function useSales(startDate?: string, endDate?: string) {
  const [sales, setSales] = useState<Awaited<ReturnType<typeof fetchSales>>>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSales(startDate, endDate);
      setSales(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    load();
  }, [load]);

  return { sales, loading, error, refresh: load };
}
