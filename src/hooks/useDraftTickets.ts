import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPendingDrafts, type DraftTicket } from '../services/draftTickets';

// Pending scale tickets for the cashier queue. Polls so a ticket the worker
// just sent appears at the front desk without a manual refresh. `pollMs = 0`
// disables polling (e.g. when the queue isn't on screen).
export function useDraftTickets(pollMs = 6000) {
  const [drafts, setDrafts] = useState<DraftTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setError(null);
    try {
      const data = await fetchPendingDrafts();
      if (myReq === reqId.current) setDrafts(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return;
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { drafts, loading, error, refresh: load };
}
