import type { WorkOrder } from '../types';

export const hhOf = (order: WorkOrder) => Math.max(0, Number(order.headcount) || 0) * Math.max(0, Number(order.realHours) || 0);
export const hmOf = (order: WorkOrder) => Math.max(0, Number(order.machineHours) || 0);
export const volumeOf = (order: WorkOrder) => Math.max(0, Number(order.cubicMetersRemoved) || 0);
export const waterOf = (order: WorkOrder) => {
  if (typeof order.waterVolumeM3 === 'number') return Math.max(0, order.waterVolumeM3);
  if (order.vehiclePatent === 'TTCX50') {
    return Math.max(0, Number(((order.machineHours || 0) * (20.0 / 4.5)).toFixed(2)));
  }
  return 0;
};

export function staffingBreakdown(orders: WorkOrder[]) {
  const rows = ['Base', 'Spot13P', 'Spot72P', 'Sin clasificar'].map(name => ({
    name, ots: 0, volume: 0, hh: 0, hm: 0, water: 0,
  }));
  for (const order of orders) {
    const row = rows.find(row => row.name === order.staffingType) || rows[3];
    row.ots += 1;
    row.volume += volumeOf(order);
    row.hh += hhOf(order);
    row.hm += hmOf(order);
    row.water += waterOf(order);
  }
  return rows.filter(row => row.name !== 'Sin clasificar' || row.ots > 0);
}
