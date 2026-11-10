import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Exercise the production transaction against a deterministic in-memory adapter.
// Writes become visible only when its callback completes, as in Firestore.
const firestore = `
export const doc = (db, collection, id) => ({ db, key: collection + '/' + id });
export const serverTimestamp = () => 'server-time';
export const runTransaction = async (db, callback) => {
  const pending = [];
  await callback({
    get: async ref => ({ exists: () => db.has(ref.key), data: () => structuredClone(db.get(ref.key)), ref }),
    update: (ref, fields) => pending.push({ ref, fields })
  });
  for (const { ref, fields } of pending) {
    const record = db.get(ref.key);
    for (const [key, value] of Object.entries(fields)) {
      if (key.startsWith('payload.')) record.payload[key.slice(8)] = value;
      else record[key] = value;
    }
  }
};`;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = (await readFile(new URL('../src/api/hierarchy.ts', import.meta.url), 'utf8'))
  .replace("from 'firebase/firestore'", `from '${url(firestore)}'`)
  .replace("from '../utils/components.mjs'", `from '${new URL('../src/utils/components.mjs', import.meta.url).href}'`);
const { planHierarchyEdit, saveHierarchyEdit } = await import(url(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 }
}).outputText));

const area = { id: 'a1', name: 'Área', code: 'A1' };
const sector = { id: 's1', areaId: 'a1', areaName: 'Área', name: 'Chancdo', code: 'S1' };
const equipment = { id: 'e1', sectorId: 's1', sectorName: 'Chancdo', name: 'Alimentdor', code: 'E1' };
const component = { id: 'e1::pasilo', sectorId: 's1', sectorName: 'Chancdo', equipmentId: 'e1', equipmentName: 'Alimentdor', name: 'Pasilo', code: 'C1', nameKey: 'pasilo', creationSource: 'wizard', auditId: 'audit-1' };
const catalogue = { plantAreas: [area], sectors: [sector], equipments: [equipment], subSectors: [component] };
const values = { name: 'Alimentador', code: 'E1' };

test('equipment correction preserves IDs and updates own and legacy components without touching a sibling', () => {
  const legacy = { ...component, id: 'legacy', equipmentId: undefined };
  const sibling = { ...component, id: 'sibling', equipmentId: 'e2' };
  const foreign = { ...legacy, id: 'foreign', sectorId: 's2' };
  const edits = planHierarchyEdit('equipment', equipment, values, { ...catalogue, subSectors: [component, legacy, sibling, foreign] });
  assert.deepEqual(edits.map(edit => edit.original.id), ['e1', 'e1::pasilo', 'legacy']);
  assert.deepEqual(edits[0].changes, values);
  assert.deepEqual(edits[1].changes, { equipmentName: 'Alimentador' });
  assert.equal(component.equipmentName, 'Alimentdor');
});

test('area and sector renames refresh cached parent names with IDs taking precedence', () => {
  const other = { ...sector, id: 's2', areaId: 'a2' };
  const edits = planHierarchyEdit('area', area, { name: 'Área corregida', code: 'A1' }, { ...catalogue, sectors: [sector, other] });
  assert.deepEqual(edits.map(edit => edit.original.id), ['a1', 's1']);
  const sectorEdits = planHierarchyEdit('sector', sector, { name: 'Chancado', code: 'S1', description: '  Primario  ' }, catalogue);
  assert.deepEqual(sectorEdits.map(edit => edit.collection), ['sectors', 'equipments', 'sub_sectors']);
  assert.equal(sectorEdits[0].changes.description, 'Primario');
  assert.equal(sectorEdits[2].changes.sectorName, 'Chancado');
});

test('component correction keeps deterministic ID and authorship while refreshing normalized search key', () => {
  const [edit] = planHierarchyEdit('component', component, { name: '  Pasillo lateral ', code: ' C2 ' }, catalogue);
  assert.equal(edit.original.id, 'e1::pasilo');
  assert.equal(edit.original.auditId, 'audit-1');
  assert.deepEqual(edit.changes, { name: 'Pasillo lateral', code: 'C2', nameKey: 'pasillo-lateral' });
  assert.throws(() => planHierarchyEdit('component', component, { name: ' ', code: 'C1' }, catalogue));
  assert.throws(() => planHierarchyEdit('component', component, { name: '---', code: 'C1' }, catalogue));
  assert.throws(() => planHierarchyEdit('equipment', equipment, { name: 'Equipo', code: ' ' }, catalogue));
});

const database = () => new Map([
  ['equipments/e1', { ...equipment, tenantId: 't1', payload: { ...equipment, tenantId: 't1' } }],
  ['sub_sectors/e1::pasilo', { ...component, tenantId: 't1', createdAt: 'original-time' }],
]);

test('save persists the correction in both storage formats and preserves component metadata', async () => {
  const db = database();
  await saveHierarchyEdit(db, 't1', planHierarchyEdit('equipment', equipment, values, catalogue));
  assert.equal(db.get('equipments/e1').name, 'Alimentador');
  assert.equal(db.get('equipments/e1').payload.name, 'Alimentador');
  const child = db.get('sub_sectors/e1::pasilo');
  assert.equal(child.equipmentName, 'Alimentador');
  assert.equal(child.equipmentId, 'e1');
  assert.equal(child.auditId, 'audit-1');
  assert.equal(child.createdAt, 'original-time');
  assert.equal(child.payload, undefined);
});

test('concurrent correction or reassignment rejects the entire rename', async () => {
  for (const mutation of [record => { record.equipmentName = 'Otra corrección'; }, record => { record.equipmentId = 'e2'; }]) {
    const db = database();
    mutation(db.get('sub_sectors/e1::pasilo'));
    await assert.rejects(saveHierarchyEdit(db, 't1', planHierarchyEdit('equipment', equipment, values, catalogue)), /Otro usuario/);
    assert.equal(db.get('equipments/e1').name, 'Alimentdor');
  }
});

test('missing and foreign-contract records fail without partially saving the parent', async () => {
  for (const mutation of [db => db.delete('sub_sectors/e1::pasilo'), db => { db.get('sub_sectors/e1::pasilo').tenantId = 't2'; }]) {
    const db = database();
    mutation(db);
    await assert.rejects(saveHierarchyEdit(db, 't1', planHierarchyEdit('equipment', equipment, values, catalogue)));
    assert.equal(db.get('equipments/e1').name, 'Alimentdor');
  }
  await assert.rejects(saveHierarchyEdit(null, 't1', []), /conexión/);
});
