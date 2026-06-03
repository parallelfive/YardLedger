import { useAppSelector, type RootState } from '../store';

export function useCurrentCompany() {
  return useAppSelector((state: RootState) => state.auth.company);
}
