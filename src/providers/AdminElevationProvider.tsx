import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AdminElevationModal from '../components/AdminElevationModal';
import { useAppDispatch, useAppSelector } from '../store';
import { setElevation } from '../store/authStore';

interface ElevationContextValue {
  // Resolves true once an admin-elevation window is active (immediately if one
  // is already live, otherwise after the user enters a valid admin/owner PIN),
  // or false if the user cancels. Pass requireOwner for owner-grade actions.
  ensureElevated: (requireOwner?: boolean) => Promise<boolean>;
}

const ElevationContext = createContext<ElevationContextValue | null>(null);

interface PendingRequest {
  requireOwner: boolean;
  resolve: (elevated: boolean) => void;
}

export function AdminElevationProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const expiresAt = useAppSelector((s) => s.auth.elevationExpiresAt);
  const isOwner = useAppSelector((s) => s.auth.elevationIsOwner);

  // Keep the latest window in a ref so ensureElevated stays referentially stable
  // (callers can use it in deps without re-subscribing on every window change).
  const windowRef = useRef({ expiresAt, isOwner });
  windowRef.current = { expiresAt, isOwner };

  const [pending, setPending] = useState<PendingRequest | null>(null);

  const ensureElevated = useCallback((requireOwner = false) => {
    const w = windowRef.current;
    const live =
      w.expiresAt != null &&
      w.expiresAt > Date.now() &&
      (!requireOwner || w.isOwner);
    if (live) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        // If a prompt is already open, abandon the older waiter (treat as cancel).
        prev?.resolve(false);
        return { requireOwner, resolve };
      });
    });
  }, []);

  const handleSuccess = (newExpiresAt: number, newIsOwner: boolean) => {
    dispatch(setElevation({ expiresAt: newExpiresAt, isOwner: newIsOwner }));
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  return (
    <ElevationContext.Provider value={{ ensureElevated }}>
      {children}
      <AdminElevationModal
        visible={pending != null}
        requireOwner={pending?.requireOwner ?? false}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ElevationContext.Provider>
  );
}

export function useAdminElevation(): ElevationContextValue {
  const ctx = useContext(ElevationContext);
  if (!ctx) {
    throw new Error(
      'useAdminElevation must be used within an AdminElevationProvider'
    );
  }
  return ctx;
}
