import { useState, useEffect, useCallback } from 'react';
import type { PendingUser, UserRole } from '../types';
import {
  fetchAllUsers,
  approveUser,
  deactivateUser,
  promoteToAdmin,
  updateUserRole,
} from '../services/users';

export function useUserApproval() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllUsers();
      setUsers(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingUsers = users.filter((u) => !u.is_active);
  const activeUsers = users.filter((u) => u.is_active);

  const handleApprove = async (userId: string) => {
    await approveUser(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u))
    );
  };

  const handleDeactivate = async (userId: string) => {
    await deactivateUser(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u))
    );
  };

  const handlePromote = async (userId: string) => {
    await promoteToAdmin(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: 'admin' } : u))
    );
  };

  const handleChangeRole = async (userId: string, role: UserRole) => {
    await updateUserRole(userId, role);
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
  };

  return {
    users,
    pendingUsers,
    activeUsers,
    loading,
    error,
    refresh: load,
    handleApprove,
    handleDeactivate,
    handlePromote,
    handleChangeRole,
  };
}
