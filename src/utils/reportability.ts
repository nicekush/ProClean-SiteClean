import type { WorkOrder, UserAccount, AuditLogEntry } from '../types';

// Read-only recovery. Ambiguous codes, users or creation events are never attributed.
export function recoverAuthors(orders: WorkOrder[], logs: AuditLogEntry[], users: UserAccount[]): WorkOrder[] {
  return orders.map(o => {
    if (o.createdById || !o.tenantId) return o;
    const relevant = logs.filter(l => l.tenantId === o.tenantId && l.entityName === 'Orden de Trabajo');
    const exact = relevant.filter(l => l.action === 'CREACION' && l.entityId === o.id);
    const uniqueCode = o.sapCode && orders.filter(x => x.tenantId === o.tenantId && x.sapCode === o.sapCode).length === 1;
    const matches = exact.length ? exact : uniqueCode ? relevant.filter(l => l.action === 'CREACION' && l.entityId === o.sapCode) : [];
    if (matches.length !== 1 || (!exact.length && relevant.some(l => l.action === 'ELIMINACION' && l.entityId === o.sapCode))) return o;
    const log = matches[0];
    const candidates = users.filter(u => u.tenantId === o.tenantId && (log.userId ? u.id === log.userId : `${u.name} (${u.role})` === log.userName));
    if (candidates.length !== 1) return o;
    const user = candidates[0];
    return { ...o, createdById: user.id, createdByName: user.name, authorSource: 'audit', authorAuditId: log.id,
      ...(log.recordedAt && chileDate(log.recordedAt) ? { createdAt: log.recordedAt } : {}) };
  });
}

export type DateBasis = 'execution' | 'creation' | 'update' | 'approval';
export type PersonBasis = 'author' | 'responsible';
export const UNKNOWN = '__unknown__';
export function chileDate(value?: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(k => parts.find(p => p.type === k)?.value).join('-');
}
export function orderDate(o: WorkOrder, basis: DateBasis) {
  if (basis === 'execution') return /^\d{4}-\d{2}-\d{2}$/.test(o.executionDate || '') ? o.executionDate! : '';
  return chileDate(basis === 'creation' ? o.createdAt : basis === 'update' ? o.updatedAt : o.approvedAt);
}
export const positive = (n: unknown) => Math.max(0, Number(n) || 0);
export function delayDays(o: WorkOrder): number | null {
  const start = orderDate(o, 'execution'), end = orderDate(o, 'creation');
  if (!start || !end) return null;
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
}
export function person(o: WorkOrder, basis: PersonBasis) {
  const id = basis === 'author' ? o.createdById : o.responsibleSupervisorId;
  const name = basis === 'author' ? o.createdByName : o.responsibleSupervisorName;
  return { id: id || UNKNOWN, name: id ? (name || id) : basis === 'author' ? 'Sin autor identificado' : 'Sin responsable asignado' };
}
export function reviewIssues(o: WorkOrder): string[] {
  const issues: string[] = [];
  const executed = !['PROGRAMADO', 'CONTINGENCIA', 'RECHAZADO_CONTINGENCIA'].includes(o.status);
  const manual = o.hasManualLabor ?? (positive(o.headcount) > 0 || positive(o.realHours) > 0 && !o.vehiclePatent);
  const machinery = o.hasEquipment ?? Boolean(o.vehiclePatent || positive(o.machineHours));
  if (!o.executionDate) issues.push('Sin fecha de ejecución');
  if (!o.shiftId) issues.push('Sin turno');
  if (!o.equipmentId && !o.equipmentName && !o.equipoCorrea?.trim()) issues.push('Sin equipo / sector');
  if (!o.operationDetail?.trim()) issues.push('Sin detalle de actividad');
  if (executed && manual && (!positive(o.headcount) || !positive(o.realHours))) issues.push('Dotación o duración manual sin informar');
  if (executed && machinery && !positive(o.machineHours)) issues.push('Maquinaria sin HM positivas');
  if (machinery && !o.vehiclePatent?.trim()) issues.push('Maquinaria sin patente / código');
  if (executed && !(o.imageBeforeUrl || o.beforePhotoUrl)) issues.push('Sin evidencia antes');
  if (executed && !(o.imageAfterUrl || o.afterPhotoUrl)) issues.push('Sin evidencia después');
  return issues;
}
export function createTrace(user: UserAccount, at = new Date().toISOString()): Partial<WorkOrder> {
  return { createdById: user.id, createdByName: user.name, createdAt: at, updatedById: user.id, updatedByName: user.name, updatedAt: at,
    ...(user.role === 'SUPERVISOR_TERRENO' ? { responsibleSupervisorId: user.id, responsibleSupervisorName: user.name } : {}) };
}
export function editTrace(original: WorkOrder, changes: Partial<WorkOrder>, user: UserAccount, at = new Date().toISOString()): WorkOrder {
  const { createdAt: _a, createdById: _b, createdByName: _c, approvedAt: _d, approvedById: _e, authorSource: _f, authorAuditId: _g, id: _h, tenantId: _i, ...safe } = changes;
  return { ...original, ...safe, updatedById: user.id, updatedByName: user.name, updatedAt: at };
}
