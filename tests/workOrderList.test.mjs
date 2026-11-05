import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkOrderSearchIndex, filterWorkOrders, getWorkOrderPage } from '../src/utils/workOrderList.ts';
import { shiftHoursBreakdown } from '../src/utils/kpiMetrics.ts';
import { matchesSearchText } from '../src/utils/searchText.ts';

const all = { quickStatus: 'ALL', shiftId: 'ALL', status: 'ALL', areaId: 'ALL',
  staffingType: 'ALL', taskType: 'ALL', startDate: '', endDate: '', search: '' };
const author = order => order.createdByName || 'Sin autor identificado';
const fixtures = [
  { id: '1', executionDate: '2026-11-04', shiftId: 's1', shiftName: 'Día', status: 'PENDIENTE_APROBACION_ITO', areaId: 'a1', staffingType: 'Base', sapCode: 'OT-1', equipoCorrea: 'CT32', operationDetail: 'Aseo', createdByName: 'Supervisor Uno' },
  { id: '2', executionDate: '2026-11-04', shiftId: 's2', shiftName: 'Noche', status: 'APROBADO_MANDANTE', areaId: 'a2', staffingType: 'Spot13P', taskType: 'EMERGENTE', sapCode: 123456, equipoCorrea: null, areaName: 'Área Seca' },
  { id: '3', executionDate: '2026-11-05', shiftId: 's1', status: 'COMPLETADO', areaId: 'a1', taskType: 'MANTENIMIENTO_PROGRAMADO', operationDetail: 'Hidrojet' },
  { id: '4', executionDate: '2026-11-03', shiftId: 's2', status: 'CONTINGENCIA', areaId: 'a1', staffingType: 'Spot72P', taskType: 'PLANIFICADO' },
  { id: '5', executionDate: '', status: 'RECHAZADO_CONTINGENCIA', areaId: 'a2', taskType: 'PLANIFICADO' },
];
const index = buildWorkOrderSearchIndex(fixtures, author);
const select = change => filterWorkOrders(fixtures, { ...all, ...change }, index).map(order => order.id);

test('advanced filters combine operational dates, shift, type and status without losing the night shift', () => {
  assert.deepEqual(select({ startDate: '2026-11-04', endDate: '2026-11-04' }), ['1', '2']);
  assert.deepEqual(select({ startDate: '2026-11-04', endDate: '2026-11-04', shiftId: 's2', taskType: 'EMERGENTE', staffingType: 'Spot13P', areaId: 'a2', status: 'APROBADO' }), ['2']);
  assert.deepEqual(select({ taskType: 'PLANIFICADO' }), ['1', '4', '5']);
  assert.deepEqual(select({ staffingType: 'UNCLASSIFIED' }), ['3', '5']);
  assert.deepEqual(select({ quickStatus: 'APPROVED' }), ['2', '3']);
  assert.deepEqual(select({ quickStatus: 'APPROVED', status: 'PENDIENTE' }), []);
  assert.deepEqual(select({ status: 'CONTINGENCIA' }), ['4', '5']);
  assert.deepEqual(select({ startDate: '2026-11-05', endDate: '2026-11-04' }), []);
  assert.deepEqual(select({ endDate: '2026-11-04' }), ['1', '2', '4']);
});

test('indexed search retains the previous behavior for historical and incomplete records', () => {
  for (const search of ['', 'CT32', 'supervisor', '2345', 'ÁREA SECA', 'hidrojet', 'null', 'undefined', 'aseo ct32']) {
    const expected = fixtures.filter(order => matchesSearchText([
      order.sapCode, order.equipoCorrea, order.operationDetail, author(order), order.areaName,
    ], search));
    assert.deepEqual(filterWorkOrders(fixtures, { ...all, search }, index), expected);
  }
  const updated = { ...fixtures[0], operationDetail: 'Trabajo actualizado' };
  const updatedIndex = buildWorkOrderSearchIndex([updated], author);
  assert.equal(filterWorkOrders([updated], { ...all, search: 'actualizado' }, updatedIndex).length, 1);
});

test('pagination bounds render work while preserving every match for totals and export', () => {
  const orders = Array.from({ length: 121 }, (_, i) => ({ id: String(i), shiftName: 'Día', headcount: 2, realHours: 8, machineHours: 1.5 }));
  const original = [...orders];
  const first = getWorkOrderPage(orders, 1, 50);
  const second = getWorkOrderPage(orders, 2, 50);
  const last = getWorkOrderPage(orders, 999, 50);
  assert.equal(first.orders.length, 50);
  assert.deepEqual([first.start, first.end, first.pageCount], [1, 50, 3]);
  assert.deepEqual([second.start, second.end, second.orders[0].id], [51, 100, '50']);
  assert.deepEqual([last.page, last.start, last.end, last.orders.length], [3, 101, 121, 21]);
  assert.deepEqual([...first.orders, ...second.orders, ...last.orders], original);
  assert.deepEqual(orders, original);
  assert.deepEqual(shiftHoursBreakdown(orders, []).total, { hh: 1936, hm: 181.5, orders: 121 });
  assert.deepEqual([getWorkOrderPage([], 4, 50).start, getWorkOrderPage([], 4, 50).end], [0, 0]);
  assert.equal(getWorkOrderPage(orders, 0, 25).orders.length, 25);
  assert.equal(getWorkOrderPage(orders, 1, 100).orders.length, 100);
});
