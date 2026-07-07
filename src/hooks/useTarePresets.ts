import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTarePresets,
  createTarePreset,
  deleteTarePreset,
  type TarePreset,
} from '../services/tarePresets';

export function useTarePresets() {
  const [presets, setPresets] = useState<TarePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ignore a stale response that resolves after a newer load (see useMetals).
  const reqId = useRef(0);

  const load = useCallback(async () => {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTarePresets();
      if (myReq === reqId.current) setPresets(data);
    } catch (err) {
      if (myReq === reqId.current) setError((err as Error).message);
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Mutations throw (per project convention); callers surface the error and
  // refresh optimistically off the returned/removed row.
  const create = useCallback(
    async (input: {
      name: string;
      tareWeight: number;
      createdBy?: string | null;
    }) => {
      const row = await createTarePreset(input);
      setPresets((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name))
      );
      return row;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteTarePreset(id);
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { presets, loading, error, refresh: load, create, remove };
}
