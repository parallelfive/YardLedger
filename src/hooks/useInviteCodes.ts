import { useState, useEffect, useCallback } from 'react';
import type { UserRole } from '../types';
import {
  createInviteCode,
  listInviteCodes,
  deleteInviteCode,
  type InviteCode,
} from '../services/inviteCodes';

export function useInviteCodes() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listInviteCodes();
      setCodes(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async (role: UserRole): Promise<string> => {
    const code = await createInviteCode(role);
    await load();
    return code;
  };

  const remove = async (id: string) => {
    await deleteInviteCode(id);
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  const unused = codes.filter((c) => !c.is_used);

  return { codes, unused, loading, error, refresh: load, generate, remove };
}
