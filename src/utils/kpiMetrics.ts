import type { WorkOrder, ShiftType } from '../types';

export const hhOf = (order: WorkOrder) => Math.max(0, Number(order.headcount) || 0) * Math.max(0, Number(order.realHours) || 0);
export const hmOf = (order: WorkOrder) => Math.max(0, Number(order.machineHours) || 0);

function reportShiftPeriod(order: WorkOrder, shifts: ShiftType[]): 'day' | 'night' | 'unclassified' {
  const normalize = (value: string = '') => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const shift = shifts.find(item => item.id === order.shiftId)
    || shifts.find(item => normalize(item.name) === normalize(order.shiftName) && Boolean(order.shiftName));
  const classifyName = (value: string) => {
    const name = normalize(value);
    if (/\b(noche|nocturno|nocturna|night|nch|tn)\b/.test(name)) return 'night';
    if (/\b(dia|diurno|diurna|day|td)\b/.test(name)) return 'day';
    return undefined;
  };
  const configuredPeriod = shift && classifyName(`${shift.name} ${shift.code}`);
  if (configuredPeriod) return configuredPeriod;
  if (shift && /^\d{2}:\d{2}$/.test(shift.startTime) && /^\d{2}:\d{2}$/.test(shift.endTime) && shift.startTime !== shift.endTime) {
    return shift.endTime < shift.startTime ? 'night' : 'day';
  }
  return classifyName(order.shiftName || '') || 'unclassified';
}

export function shiftHoursBreakdown(orders: WorkOrder[], shifts: ShiftType[]) {
  const empty = () => ({ hh: 0, hm: 0, orders: 0 });
  const totals = { day: empty(), night: empty(), unclassified: empty(), total: empty() };
  for (const order of orders) {
    const bucket = totals[reportShiftPeriod(order, shifts)];
    const hh = hhOf(order);
    const hm = hmOf(order);
    bucket.hh += hh;
    bucket.hm += hm;
    bucket.orders += 1;
    totals.total.hh += hh;
    totals.total.hm += hm;
    totals.total.orders += 1;
  }
  return totals;
}
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
