import { useState, useEffect, useCallback } from 'react';
import type { MetalCategory } from '../types';
import { fetchMetalCategories } from '../services/metals';

export function useMetalCategories() {
  const [categories, setCategories] = useState<MetalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMetalCategories();
      setCategories(data);
    } catch (error_) {
      setError((error_ as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { categories, loading, error, refresh: load };
}
