import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftHoursBreakdown } from '../src/utils/kpiMetrics.ts';

const shifts = [
  { id: 's1', name: 'Turno Día', code: 'TRN-DIA', startTime: '07:00', endTime: '19:00' },
  { id: 's2', name: 'Turno Noche', code: 'TRN-NCH', startTime: '19:00', endTime: '07:00' },
];

test('sums reported HH and HM separately for both shifts on the same operational date', () => {
  const totals = shiftHoursBreakdown([
    { shiftId: 's1', executionDate: '2026-11-04', headcount: 4, realHours: 8, machineHours: 3.5, status: 'PENDIENTE_APROBACION_ITO' },
    { shiftId: 's1', executionDate: '2026-11-04', headcount: 2, realHours: 1.25, machineHours: 0 },
    { shiftId: 's2', executionDate: '2026-11-04', headcount: 3, realHours: 7.5, machineHours: 6.25 },
  ], shifts);
  assert.deepEqual(totals.day, { hh: 34.5, hm: 3.5, orders: 2 });
  assert.deepEqual(totals.night, { hh: 22.5, hm: 6.25, orders: 1 });
  assert.deepEqual(totals.total, { hh: 57, hm: 9.75, orders: 3 });
});

test('a filtered subset has no contribution from excluded dates or shifts', () => {
  const orders = [
    { shiftId: 's1', executionDate: '2026-11-04', headcount: 4, realHours: 8, machineHours: 3 },
    { shiftId: 's2', executionDate: '2026-11-04', headcount: 2, realHours: 8, machineHours: 5 },
    { shiftId: 's1', executionDate: '2026-11-03', headcount: 10, realHours: 12, machineHours: 12 },
  ];
  const visible = orders.filter(order => order.executionDate === '2026-11-04' && order.shiftId === 's2');
  assert.deepEqual(shiftHoursBreakdown(visible, shifts), {
    day: { hh: 0, hm: 0, orders: 0 }, night: { hh: 16, hm: 5, orders: 1 },
    unclassified: { hh: 0, hm: 0, orders: 0 }, total: { hh: 16, hm: 5, orders: 1 },
  });
});

test('historical names and shifts with generic names use names, codes or the configured hours', () => {
  const totals = shiftHoursBreakdown([
    { shiftName: 'TURNO DÍA', headcount: 2, realHours: 2 },
    { shiftName: 'Nocturno', machineHours: 3 },
    { shiftId: 'generic', machineHours: 4 },
    { shiftId: 'code', headcount: 1, realHours: 5 },
  ], [
    ...shifts,
    { id: 'generic', name: 'Turno B', code: 'B', startTime: '19:00', endTime: '07:00' },
    { id: 'code', name: 'Turno C', code: 'TRN-NCH' },
  ]);
  assert.equal(totals.day.hh, 4);
  assert.deepEqual(totals.night, { hh: 5, hm: 7, orders: 3 });
});

test('unidentified shifts remain visible in overall totals without being assigned to daytime', () => {
  const totals = shiftHoursBreakdown([{ shiftName: 'Sin informar', headcount: 2, realHours: 3, machineHours: 1.5 }], shifts);
  assert.deepEqual(totals.unclassified, { hh: 6, hm: 1.5, orders: 1 });
  assert.deepEqual(totals.total, totals.unclassified);
  assert.equal(totals.day.orders, 0);
  assert.equal(totals.night.orders, 0);
});

test('empty selection and missing hours show zero, and negative hours do not subtract from totals', () => {
  assert.deepEqual(shiftHoursBreakdown([], shifts).total, { hh: 0, hm: 0, orders: 0 });
  const totals = shiftHoursBreakdown([
    { shiftId: 's1' }, { shiftId: 's2', headcount: 2, realHours: -8, machineHours: -2 },
  ], shifts);
  assert.deepEqual(totals.total, { hh: 0, hm: 0, orders: 2 });
});
