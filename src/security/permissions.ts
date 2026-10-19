import catalog from './catalog.json';
import roleDefaults from './roleDefaults.json';
import type { UserAccount, UserRole } from '../types';

export type Permission = string;
export const PERMISSIONS = catalog;
export const ALL_PERMISSIONS = catalog.map(p => p.id);
export const ADMIN_ONLY = ['maintenance.reset'];
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = roleDefaults;
export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERVISOR_TERRENO: 'Supervisor de terreno', ITO_MANDANTE: 'ITO mandante',
  ADMINISTRADOR_CONTRATO: 'Administrador de contrato', SUPER_ADMIN: 'Administrador principal',
  CLIENTE_VISUALIZADOR: 'Cliente — Solo lectura',
};
export interface PermissionProfile { id: string; name: string; tenantId: string; permissions: string[]; }
export function normalizePermissions(input: readonly string[]): string[] {
  const enabled = new Set(input.filter(p => catalog.some(c => c.id === p)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of catalog) if (enabled.has(p.id)) for (const dep of p.requires) {
      if (!enabled.has(dep)) { enabled.add(dep); changed = true; }
    }
  }
  return ALL_PERMISSIONS.filter(p => enabled.has(p));
}
// Read authorization never adds missing dependencies from an invalid stored profile.
export function effectivePermissions(user?: UserAccount | null): string[] {
  if (!user || user.active === false) return [];
  if (user.role === 'SUPER_ADMIN') return ALL_PERMISSIONS;
  const result = new Set(user.permissions ?? ROLE_PERMISSIONS[user.role] ?? []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of catalog) if (result.has(p.id) && p.requires.some(dep => !result.has(dep))) {
      result.delete(p.id); changed = true;
    }
  }
  return ALL_PERMISSIONS.filter(p => result.has(p) && !ADMIN_ONLY.includes(p));
}
export function can(user: UserAccount | null | undefined, permission: string): boolean {
  return effectivePermissions(user).includes(permission);
}
export function togglePermission(current: string[], id: string, enabled: boolean): string[] {
  if (enabled) return normalizePermissions([...current, id]);
  let next = current.filter(p => p !== id);
  let changed = true;
  while (changed) {
    const before = next.length;
    next = next.filter(p => catalog.find(c => c.id === p)?.requires.every(dep => next.includes(dep)));
    changed = before !== next.length;
  }
  return next;
}
export const TAB_PERMISSIONS: Record<string, string[]> = {
  'work-orders': ['orders.view'], 'personnel-coverage': ['coverage.view'],
  'map-operational': ['map.view'], evidences: ['evidence.view'], dashboard: ['kpi.view'],
  'reporting-control': ['reporting.view'], 'audit-logs': ['audit.view'],
  parameters: ['structure.view', 'machines.view', 'workers.view', 'personnel.view', 'coverageConfig.view', 'manualMatrix.manage'],
  'system-config': ['users.view', 'contracts.manage', 'shifts.manage', 'contingencies.manage', 'branding.manage', 'maintenance.reset'],
};
export function canOpenTab(user: UserAccount | null | undefined, tab: string) {
  return TAB_PERMISSIONS[tab]?.some(p => can(user, p)) ?? false;
}
export function inScope(user: UserAccount, data: { tenantId?: string; contractId?: string; areaId?: string }): boolean {
  // The browser always uses the active tenant, including for the principal admin.
  return data.tenantId === (user.tenantId || 'tenant_cmz')
    && (user.accessScope !== 'CONTRACT' || (data.contractId || 'c1') === user.contractId)
    && (!user.allowedAreaIds?.length || user.allowedAreaIds.includes(data.areaId || ''));
}
