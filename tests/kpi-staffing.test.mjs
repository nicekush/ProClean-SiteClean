import { test } from 'node:test';
import assert from 'node:assert/strict';
import { staffingBreakdown, hhOf, hmOf, volumeOf, waterOf, machineServiceOf, matchesStaffingService } from '../src/utils/kpiMetrics.ts';
import { readModels } from '../src/security/readModels.mjs';

test('staffing segments reconcile all resources including unknown classifications', () => {
  const orders = [
    { staffingType: 'Base', headcount: 2, realHours: 4, machineHours: 3, cubicMetersRemoved: 12, waterVolumeM3: 8 },
    { staffingType: 'Spot13P', headcount: 3, realHours: 2, machineHours: 0, cubicMetersRemoved: 7 },
    { staffingType: 'Spot72P', headcount: 10, realHours: 9, machineHours: 4.5, vehiclePatent: 'TTCX50' },
    { headcount: 1, realHours: 2, machineHours: 1, waterVolumeM3: 0, vehiclePatent: 'TTCX50' },
    { staffingType: 'legacy', headcount: 2, realHours: 1, machineHours: 0 },
  ];
  const rows = staffingBreakdown(orders);
  assert.equal(rows.find(r => r.name === 'Sin clasificar').ots, 2);
  assert.equal(rows.find(r => r.name === 'Spot72P').hh, 90);
  assert.equal(rows.find(r => r.name === 'Spot72P').water, 20);
  assert.equal(rows.reduce((sum, row) => sum + row.ots, 0), orders.length);
  for (const [key, measure] of Object.entries({ hh: hhOf, hm: hmOf, volume: volumeOf, water: waterOf })) {
    assert.equal(rows.reduce((sum, row) => sum + row[key], 0), orders.reduce((sum, order) => sum + measure(order), 0));
  }
});

test('filtered or empty reports preserve named segments without importing excluded orders', () => {
  const rows = staffingBreakdown([{ staffingType: 'Spot13P', headcount: 4, realHours: 9 }]);
  assert.deepEqual(rows.map(row => [row.name, row.ots, row.hh]), [['Base', 0, 0], ['Spot13P', 1, 36], ['Spot72P', 0, 0]]);
  assert.equal(staffingBreakdown([]).length, 3);
});

test('mixed OT keeps manual HH and assigns machinery to AAP without duplicating global resources', () => {
  const mixed = { id: 'mixed', staffingType: 'Spot13P', machineStaffingType: 'AAP', headcount: 4, realHours: 9,
    machineHours: 5, cubicMetersRemoved: 28.8, waterVolumeM3: 7 };
  const legacy = { id: 'legacy', staffingType: 'Base', machineHours: 3 };
  const rows = staffingBreakdown([mixed, legacy]);
  assert.equal(rows.find(r => r.name === 'Spot13P').hh, 36);
  assert.equal(rows.find(r => r.name === 'Spot13P').hm, 0);
  assert.equal(rows.find(r => r.name === 'AAP').hh, 0);
  assert.equal(rows.find(r => r.name === 'AAP').hm, 5);
  assert.equal(rows.find(r => r.name === 'AAP').water, 7);
  assert.equal(rows.reduce((n, r) => n + r.ots, 0), 2);
  assert.equal(rows.reduce((n, r) => n + r.hh, 0), 36);
  assert.equal(rows.reduce((n, r) => n + r.hm, 0), 8);
  assert.equal(machineServiceOf(legacy), 'Base');
  assert.ok(matchesStaffingService(mixed, 'AAP'));
  assert.ok(matchesStaffingService(mixed, 'Spot13P'));
  assert.equal(matchesStaffingService(mixed, 'Spot72P'), false);
  const projections = readModels(mixed);
  assert.equal(projections.metrics.machineStaffingType, 'AAP');
  assert.equal(projections.detail.machineStaffingType, 'AAP');
});
