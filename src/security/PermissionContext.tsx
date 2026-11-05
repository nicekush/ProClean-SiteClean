import { createContext, useContext, useCallback, useMemo } from 'react';
import type { UserAccount } from '../types';
import { effectivePermissions } from './permissions';

export const PermissionContext = createContext<UserAccount | null>(null);
export function usePermissions() {
  const user = useContext(PermissionContext);
  const enabled = useMemo(() => new Set(effectivePermissions(user)), [user]);
  const check = useCallback((permission: string) => enabled.has(permission), [enabled]);
  return { user, can: check };
}
