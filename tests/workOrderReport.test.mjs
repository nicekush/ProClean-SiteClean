import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getReportCalendar, getReportDateRange, getReportFilename, intersectReportDateRanges } from '../src/utils/workOrderReport.mjs';

test('the morning report uses the previous operational date in Chile', () => {
  const calendar = getReportCalendar(new Date('2026-11-05T11:00:00Z'));
  const range = getReportDateRange('YESTERDAY', '', '', calendar);
  assert.deepEqual(range, { start: '2026-11-04', end: '2026-11-04' });
  assert.equal(getReportFilename(range), 'Reporte_ProCleanMG_04.11.2026.xlsx');
});

test('UTC midnight does not advance the Chilean reporting day', () => {
  const calendar = getReportCalendar(new Date('2026-11-05T01:00:00Z'));
  assert.equal(calendar.today, '2026-11-04');
  assert.equal(calendar.yesterday, '2026-11-03');
  const winter = getReportCalendar(new Date('2026-07-05T03:30:00Z'));
  assert.equal(winter.today, '2026-07-04');
});

test('previous operational day handles new year and leap day', () => {
  assert.equal(getReportCalendar(new Date('2027-01-01T12:00:00Z')).yesterday, '2026-12-31');
  assert.equal(getReportCalendar(new Date('2028-03-01T12:00:00Z')).yesterday, '2028-02-29');
});

test('filename preserves selected boundaries, including days with no records', () => {
  const calendar = getReportCalendar(new Date('2026-11-05T12:00:00Z'));
  const range = getReportDateRange('CUSTOM', '2026-10-31', '2026-11-04', calendar);
  assert.equal(getReportFilename(range), 'Reporte_ProCleanMG_31.10.2026_al_04.11.2026.xlsx');
  assert.equal(getReportFilename(getReportDateRange('THIS_WEEK', '', '', calendar)), 'Reporte_ProCleanMG_02.11.2026_al_05.11.2026.xlsx');
  assert.equal(getReportFilename(getReportDateRange('THIS_MONTH', '', '', calendar)), 'Reporte_ProCleanMG_01.11.2026_al_30.11.2026.xlsx');
  assert.equal(calendar.shiftStart, '2026-11-04');
  assert.equal(calendar.shiftEnd, '2026-11-10');
});

test('combined date filters use their intersection and reject empty or incomplete periods', () => {
  const range = intersectReportDateRanges(
    { start: '2026-11-04', end: '2026-11-10' },
    { start: '2026-11-01', end: '2026-11-05' },
  );
  assert.equal(getReportFilename(range), 'Reporte_ProCleanMG_04.11.2026_al_05.11.2026.xlsx');
  for (const invalid of [
    { start: '', end: '' }, { start: '2026-11-04', end: '' },
    { start: '', end: '2026-11-04' }, { start: '2026-11-05', end: '2026-11-04' },
  ]) assert.equal(getReportFilename(invalid), null);
});
