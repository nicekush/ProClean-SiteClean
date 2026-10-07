import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesSearchText } from '../src/utils/searchText.ts';

test('OT searches tolerate null and missing fields while matching other text', () => {
  assert.equal(matchesSearchText([null, undefined, 'Aseo de correa CT32'], 'CORREA'), true);
  assert.equal(matchesSearchText(['SAP-1', null, 'Aseo', undefined, null], 'hidrojet'), false);
  assert.equal(matchesSearchText([null, undefined, null], 'aseo'), false);
  assert.equal(matchesSearchText([null, undefined, null], 'null'), false);
  assert.equal(matchesSearchText([null, undefined, null], 'undefined'), false);
});

test('empty search retains incomplete OTs and numeric SAP codes remain searchable', () => {
  assert.equal(matchesSearchText([null, undefined, null], ''), true);
  assert.equal(matchesSearchText([123456, null, 'Aseo'], '2345'), true);
  assert.equal(matchesSearchText([123456, null, 'Aseo'], '999'), false);
});

test('OT author, area and equipment searches remain case-insensitive', () => {
  const fields = ['SAP-1', 'CT32', 'Aseo industrial', 'Supervisor Uno', 'Área Seca'];
  for (const query of ['sap-1', 'ct32', 'INDUSTRIAL', 'SUPERVISOR', 'ÁREA SECA']) {
    assert.equal(matchesSearchText(fields, query), true);
  }
});
