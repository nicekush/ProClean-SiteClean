import type { WorkOrder } from '../types';

export interface WorkOrderFilters {
  quickStatus: string;
  shiftId: string;
  status: string;
  areaId: string;
  staffingType: string;
  taskType: string;
  startDate: string;
  endDate: string;
  search: string;
}

export function buildWorkOrderSearchIndex(orders: WorkOrder[], creatorName: (order: WorkOrder) => string) {
  const index = new WeakMap<WorkOrder, string[]>();
  for (const order of orders) {
    index.set(order, [order.sapCode, order.equipoCorrea, order.operationDetail, creatorName(order), order.areaName]
      .map(value => String(value ?? '').toLowerCase()));
  }
  return index;
}

export function filterWorkOrders(orders: WorkOrder[], filters: WorkOrderFilters, searchIndex: WeakMap<WorkOrder, string[]>) {
  const query = filters.search.toLowerCase();
  return orders.filter(order => {
    if (filters.quickStatus === 'PENDING' && order.status !== 'PENDIENTE_APROBACION_ITO') return false;
    if (filters.quickStatus === 'APPROVED' && order.status !== 'APROBADO_MANDANTE' && order.status !== 'COMPLETADO') return false;
    if (filters.shiftId !== 'ALL' && order.shiftId !== filters.shiftId) return false;
    if (filters.areaId !== 'ALL' && order.areaId !== filters.areaId) return false;
    if (filters.staffingType !== 'ALL' && (order.staffingType || 'UNCLASSIFIED') !== filters.staffingType) return false;
    if (filters.taskType !== 'ALL' && (order.taskType || 'PLANIFICADO') !== filters.taskType) return false;
    if (filters.status === 'PENDIENTE' && order.status !== 'PENDIENTE_APROBACION_ITO') return false;
    if (filters.status === 'APROBADO' && order.status !== 'APROBADO_MANDANTE') return false;
    if (filters.status === 'CONTINGENCIA' && order.status !== 'RECHAZADO_CONTINGENCIA' && order.status !== 'CONTINGENCIA') return false;
    const date = order.executionDate || '';
    if (filters.startDate && date < filters.startDate) return false;
    if (filters.endDate && (!date || date > filters.endDate)) return false;
    return !query || Boolean(searchIndex.get(order)?.some(value => value.includes(query)));
  });
}

export function getWorkOrderPage<T>(orders: T[], requestedPage: number, pageSize: number) {
  const size = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(orders.length / size));
  const page = Math.max(1, Math.min(Math.floor(requestedPage), pageCount));
  const offset = (page - 1) * size;
  return { orders: orders.slice(offset, offset + size), page, pageCount,
    start: orders.length ? offset + 1 : 0, end: Math.min(offset + size, orders.length) };
}
