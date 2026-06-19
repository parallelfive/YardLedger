import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchAllCustomers, type Customer } from '../services/customers';

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignore a stale response that resolves after a newer load (see useReceipts).
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllCustomers();
      if (myReq === reqId.current) setCustomers(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { customers, loading, error, refresh: load };
}
