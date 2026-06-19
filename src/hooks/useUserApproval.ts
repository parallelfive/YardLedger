import { useState, useEffect, useCallback } from 'react';
import type { PendingUser, UserRole } from '../types';
import {
  fetchAllUsers,
  approveUser,
  deactivateUser,
  promoteToAdmin,
  updateUserRole,
} from '../services/users';
import { useAdminElevation } from '../providers/AdminElevationProvider';

export function useUserApproval() {
  const { ensureElevated } = useAdminElevation();
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
    if (!(await ensureElevated())) return;
    await approveUser(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u))
    );
  };

  const handleDeactivate = async (userId: string) => {
    // Deactivating an owner is owner-grade; the DB enforces the matrix either way.
    const target = users.find((u) => u.id === userId);
    if (!(await ensureElevated(target?.role === 'owner'))) return;
    await deactivateUser(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u))
    );
  };

  const handlePromote = async (userId: string) => {
    if (!(await ensureElevated())) return;
    await promoteToAdmin(userId);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: 'admin' } : u))
    );
  };

  const handleChangeRole = async (userId: string, role: UserRole) => {
    // Granting/altering owner requires owner-grade elevation.
    const target = users.find((u) => u.id === userId);
    const ownerGrade = role === 'owner' || target?.role === 'owner';
    if (!(await ensureElevated(ownerGrade))) return;
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
