import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentNameKey, componentsForEquipment, selectedComponentIds } from '../src/utils/components.mjs';

const equipment = { id: 'eq-1', name: 'Correa 1' };
const sector = { id: 'sector-1', name: 'Sector 1' };

test('component matching ignores accents, case, repeated whitespace and combining accents', () => {
  for (const name of ['  PASÍLLO   LATERAL ', 'pasillo lateral', 'Pasi\u0301llo lateral', 'pasillo-lateral']) {
    assert.equal(componentNameKey(name), 'pasillo-lateral');
  }
  assert.equal(componentNameKey('Cajón / Descarga Ñandú'), 'cajon-descarga-nandu');
  assert.equal(componentNameKey('  /  '), '');
});

test('visible components combine own equipment with sector and global legacy records', () => {
  const records = [
    { id: 'specific', equipmentId: 'eq-1', name: 'Pasillo lateral' },
    { id: 'sector', sectorId: 'sector-1', name: 'Descarga' },
    { id: 'global', name: 'General' },
    { id: 'sibling', equipmentId: 'eq-2', equipmentName: 'Correa 1', name: 'Otra correa' },
    { id: 'foreign', sectorId: 'sector-2', sectorName: 'Sector 1', name: 'Otro sector' },
    { id: 'name-only', equipmentName: 'Correa 1', name: 'Motor' },
  ];
  assert.deepEqual(componentsForEquipment(records, equipment, sector).map(component => component.id), ['specific', 'name-only', 'sector', 'global']);
  assert.deepEqual(componentsForEquipment(records, undefined, sector), []);
});

test('duplicate badges prefer the specific equipment and do not remove sector-only components', () => {
  const records = [
    { id: 'shared', sectorId: 'sector-1', name: ' PASÍLLO LATERAL ' },
    { id: 'own', equipmentId: 'eq-1', name: 'Pasillo lateral' },
    { id: 'shared-only', sectorId: 'sector-1', name: 'Chute' },
  ];
  assert.deepEqual(componentsForEquipment(records, equipment, sector).map(component => component.id), ['own', 'shared-only']);
});

test('OT component IDs include shared records, new records and unchanged historical selections', () => {
  const records = [{ id: 'shared', name: 'Descarga' }, { id: 'new', name: 'Pasillo' }];
  assert.deepEqual(selectedComponentIds(['Descarga', 'Pasillo'], records), ['shared', 'new']);
  assert.deepEqual(selectedComponentIds(['Pasillo', 'Antiguo'], records, ['old-pasillo', 'old-missing'], ['Pasillo', 'Antiguo']), ['old-pasillo', 'old-missing']);
  assert.deepEqual(selectedComponentIds(['Pasillo'], records, ['unrelated'], ['Otro', 'Pasillo']), ['new']);
});
