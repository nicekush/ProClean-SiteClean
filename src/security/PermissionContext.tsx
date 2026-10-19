import { createContext, useContext, useCallback } from 'react';
import type { UserAccount } from '../types';
import { can } from './permissions';

export const PermissionContext = createContext<UserAccount | null>(null);
export function usePermissions() {
  const user = useContext(PermissionContext);
  const check = useCallback((permission: string) => can(user, permission), [user]);
  return { user, can: check };
}
