import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, setLogLevel, updateDoc, writeBatch } from 'firebase/firestore';
import { componentNameKey } from '../src/utils/components.mjs';

// Exercise the production service against the emulator, without importing the
// browser-only Firebase configuration or using a production connection.
const catalogue = JSON.parse(await readFile(new URL('../src/security/catalog.json', import.meta.url)));
const roles = JSON.parse(await readFile(new URL('../src/security/roleDefaults.json', import.meta.url)));
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText;
const asModule = source => `data:text/javascript;base64,${Buffer.from(transpile(source)).toString('base64')}`;
const permissionsSource = (await readFile(new URL('../src/security/permissions.ts', import.meta.url), 'utf8'))
  .replace("import catalog from './catalog.json';", `const catalog = ${JSON.stringify(catalogue)};`)
  .replace("import roleDefaults from './roleDefaults.json';", `const roleDefaults = ${JSON.stringify(roles)};`);
const apiSource = (await readFile(new URL('../src/api/components.ts', import.meta.url), 'utf8'))
  .replace("from 'firebase/firestore'", `from '${import.meta.resolve('firebase/firestore')}'`)
  .replace("from '../security/permissions'", `from '${asModule(permissionsSource)}'`)
  .replace("from '../utils/components.mjs'", `from '${new URL('../src/utils/components.mjs', import.meta.url).href}'`);
const { createEquipmentComponent } = await import(asModule(apiSource));

let env;
setLogLevel('silent');
const profile = (id, extra = {}) => ({ id, name: id, email: `${id}@example.test`, role: 'SUPERVISOR_TERRENO', active: true,
  tenantId: 'tenant-a', contractId: 'c1', permissions: [...roles.SUPERVISOR_TERRENO, 'components.create'], ...extra });
const actors = {
  enabled: profile('enabled'), second: profile('second'),
  restricted: profile('restricted', { allowedAreaIds: ['area-a'], accessScope: 'CONTRACT' }),
  ordinary: profile('ordinary', { permissions: roles.SUPERVISOR_TERRENO }),
  inactive: profile('inactive', { active: false }),
  admin: profile('admin', { role: 'ADMINISTRADOR_CONTRATO', permissions: roles.ADMINISTRADOR_CONTRATO }),
};
const input = extra => ({ areaId: 'area-a', sectorId: 'sector-a', equipmentId: 'eq-a', name: 'Pasillo poniente', ...extra });
const dbFor = actor => env.authenticatedContext(actor.id).firestore();
const create = (actor = actors.enabled, values = {}) => createEquipmentComponent(dbFor(actor), actor, input(values));
const inspect = callback => env.withSecurityRulesDisabled(context => callback(context.firestore()));

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-component-creation', firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } });
});
beforeEach(async () => {
  await env.clearFirestore();
  await inspect(async db => {
    const batch = writeBatch(db);
    for (const actor of Object.values(actors)) batch.set(doc(db, 'users', actor.id), { ...actor, payload: actor });
    for (const [name, id, data] of [
      ['plant_areas', 'area-a', { name: 'Área A' }], ['plant_areas', 'area-b', { name: 'Área B' }],
      ['sectors', 'sector-a', { areaId: 'area-a', name: 'Sector A' }], ['sectors', 'sector-b', { areaId: 'area-b', name: 'Sector B' }],
      ['equipments', 'eq-a', { sectorId: 'sector-a', name: 'Equipo A' }], ['equipments', 'eq-a2', { sectorId: 'sector-a', name: 'Equipo A2' }],
      ['equipments', 'eq-b', { sectorId: 'sector-b', name: 'Equipo B' }],
    ]) {
      const record = { id, tenantId: 'tenant-a', ...data };
      batch.set(doc(db, name, id), { ...record, payload: record });
    }
    batch.set(doc(db, 'equipments', 'eq-foreign'), { id: 'eq-foreign', tenantId: 'tenant-b', sectorId: 'sector-a', name: 'Equipo ajeno' });
    await batch.commit();
  });
});
after(async () => { await env?.cleanup(); });

function rawCreation(actor, overrides = {}, { audit = true, idOverride, logOverrides = {} } = {}) {
  const db = dbFor(actor);
  const auditRef = doc(collection(db, 'audit_logs'));
  const key = componentNameKey(overrides.name || 'Pasillo poniente');
  const id = idOverride || `eq-a::${key}`;
  const component = { id, tenantId: 'tenant-a', areaId: 'area-a', sectorId: 'sector-a', sectorName: 'Sector A',
    equipmentId: 'eq-a', equipmentName: 'Equipo A', name: 'Pasillo poniente', nameKey: key, code: 'CMP-TEST',
    createdById: actor.id, createdByName: actor.name, createdAt: serverTimestamp(), creationSource: 'wizard', auditId: auditRef.id, ...overrides };
  const batch = writeBatch(db);
  batch.set(doc(db, 'sub_sectors', id), component);
  if (audit) batch.set(auditRef, { id: auditRef.id, tenantId: 'tenant-a', contractId: 'c1', areaId: component.areaId, userId: actor.id, userName: actor.name,
    userRole: actor.role, action: 'CREACION', entityName: 'Componente de equipo', entityId: id, serverRecordedAt: serverTimestamp(), ...logOverrides });
  return batch.commit();
}

test('authorized creation saves a component and its real author, server date and audit atomically', async () => {
  const result = await assertSucceeds(create());
  assert.equal(result.created, true);
  assert.equal(result.component.id, 'eq-a::pasillo-poniente');
  await inspect(async db => {
    const component = (await getDoc(doc(db, 'sub_sectors', result.component.id))).data();
    const log = (await getDoc(doc(db, 'audit_logs', component.auditId))).data();
    assert.equal(component.createdById, actors.enabled.id);
    assert.equal(component.equipmentName, 'Equipo A');
    assert.equal(component.createdAt.toMillis(), log.serverRecordedAt.toMillis());
    assert.equal(log.entityId, component.id);
    assert.equal(log.action, 'CREACION');
  });
  await assertSucceeds(getDoc(doc(dbFor(actors.ordinary), 'sub_sectors', result.component.id)));
});

test('a repeated component is selected without rewriting its creator or audit', async () => {
  const first = await create();
  const duplicate = await create(actors.second, { name: '  PASÍLLO    PONIENTE  ' });
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.component.id, first.component.id);
  assert.equal(duplicate.component.createdById, actors.enabled.id);
  await inspect(async db => { assert.equal((await getDocs(collection(db, 'audit_logs'))).size, 1); });
});

test('concurrent supervisors create one shared component and one audit event', async () => {
  const results = await Promise.all([create(actors.enabled), create(actors.second, { name: 'PASÍLLO PONIENTE' })]);
  assert.equal(results.filter(result => result.created).length, 1);
  assert.equal(new Set(results.map(result => result.component.id)).size, 1);
  await inspect(async db => {
    assert.equal((await getDocs(collection(db, 'sub_sectors'))).size, 1);
    assert.equal((await getDocs(collection(db, 'audit_logs'))).size, 1);
  });
});

test('legacy random IDs and sector-wide components are reused; sibling equipment stays independent', async () => {
  await inspect(async db => {
    const legacy = { id: 'legacy', tenantId: 'tenant-a', equipmentId: 'eq-a', name: 'Cajón descarga', code: 'OLD' };
    await setDoc(doc(db, 'sub_sectors', legacy.id), { ...legacy, payload: legacy });
    await setDoc(doc(db, 'sub_sectors', 'shared'), { id: 'shared', tenantId: 'tenant-a', sectorId: 'sector-a', name: 'Pasillo lateral', code: 'SHARED' });
  });
  assert.equal((await create(actors.enabled, { name: 'CAJON DESCARGA' })).component.id, 'legacy');
  assert.equal((await create(actors.enabled, { name: 'Pasíllo lateral' })).component.id, 'shared');
  assert.equal((await create(actors.enabled, { name: 'Cajón descarga', equipmentId: 'eq-a2' })).created, true);
});

test('an ordinary supervisor cannot bypass the individual permission through direct writes', async () => {
  await assert.rejects(create(actors.ordinary), /permiso/);
  await assertFails(rawCreation(actors.ordinary));
  await assertFails(rawCreation(actors.inactive));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'sub_sectors', 'missing')));
});

test('creation permission does not authorize changing components, equipment, sectors or areas', async () => {
  const { component } = await create();
  const db = dbFor(actors.enabled);
  await assertFails(updateDoc(doc(db, 'sub_sectors', component.id), { name: 'Alterado' }));
  await assertFails(deleteDoc(doc(db, 'sub_sectors', component.id)));
  for (const name of ['equipments', 'sectors', 'plant_areas']) await assertFails(setDoc(doc(db, name, 'injected'), { tenantId: 'tenant-a' }));
  const adminDb = dbFor(actors.admin);
  await assertSucceeds(updateDoc(doc(adminDb, 'sub_sectors', component.id), { name: 'Corregido por administración' }));
  await assertSucceeds(deleteDoc(doc(adminDb, 'sub_sectors', component.id)));
});

test('authorized areas and the real parent hierarchy constrain both the service and direct writes', async () => {
  await assertSucceeds(create(actors.restricted));
  await assert.rejects(create(actors.restricted, { areaId: 'area-b', sectorId: 'sector-b', equipmentId: 'eq-b' }), /área/);
  await assertFails(rawCreation(actors.restricted, { areaId: 'area-b' }));
  await assert.rejects(create(actors.enabled, { areaId: 'area-b' }), /no pertenece/);
  await assertFails(rawCreation(actors.enabled, { areaId: 'area-b' }));
  await assertFails(rawCreation(actors.enabled, { sectorId: 'sector-b', sectorName: 'Sector B' }));
  await assertFails(rawCreation(actors.enabled, { tenantId: 'tenant-b' }));
  await assertFails(rawCreation(actors.enabled, { equipmentId: 'eq-foreign' }, { idOverride: 'eq-foreign::pasillo-poniente' }));
});

test('forged attribution, inconsistent IDs, payloads and missing or forged audit records are denied', async () => {
  await assertFails(rawCreation(actors.enabled, { createdById: 'other' }));
  await assertFails(rawCreation(actors.enabled, { createdByName: 'Other person' }));
  await assertFails(rawCreation(actors.enabled, { createdAt: 'yesterday' }));
  await assertFails(rawCreation(actors.enabled, { nameKey: 'different-key' }));
  await assertFails(rawCreation(actors.enabled, {}, { idOverride: 'random-id' }));
  await assertFails(rawCreation(actors.enabled, { payload: { name: 'Forged' } }));
  await assertFails(rawCreation(actors.enabled, {}, { audit: false }));
  await assertFails(rawCreation(actors.enabled, {}, { logOverrides: { userId: 'other' } }));
  await assertFails(rawCreation(actors.enabled, {}, { logOverrides: { userRole: 'SUPER_ADMIN' } }));
  await assertFails(rawCreation(actors.enabled, {}, { logOverrides: { areaId: 'area-b' } }));
  await inspect(async db => {
    assert.equal((await getDocs(collection(db, 'sub_sectors'))).size, 0);
    assert.equal((await getDocs(collection(db, 'audit_logs'))).size, 0);
  });
});

test('client and server normalize composed and decomposed Spanish component names consistently', async () => {
  for (const name of ['  ÁÉÍÓÚ ÜÑ Ç  ', 'Pasi\u0301llo / norte', 'Descarga___tolva', 'Uno---dos']) {
    await assertSucceeds(rawCreation(actors.enabled, { name }));
  }
});

test('an administrator can grant and revoke the individual permission for the same session', async () => {
  const db = dbFor(actors.admin);
  const granted = { ...actors.ordinary, permissions: actors.enabled.permissions };
  await assertSucceeds(setDoc(doc(db, 'users', granted.id), { ...granted, payload: granted }));
  await assertSucceeds(create(granted));
  await assertSucceeds(setDoc(doc(db, 'users', granted.id), { ...actors.ordinary, payload: actors.ordinary }));
  // The caller still holds the old in-memory profile; the server is authoritative.
  await assertFails(create(granted, { name: 'Nuevo después de revocar' }));
});

test('blank names, oversized names, missing hierarchy and offline creation leave no writes', async () => {
  await assert.rejects(create(actors.enabled, { name: ' / ' }), /nombre/);
  await assert.rejects(create(actors.enabled, { name: 'a'.repeat(121) }), /120/);
  await assert.rejects(create(actors.enabled, { equipmentId: '' }), /Selecciona/);
  // Missing parent documents are intentionally unreadable under catalog rules.
  await assert.rejects(create(actors.enabled, { equipmentId: 'missing' }), { code: 'permission-denied' });
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false } });
  try { await assert.rejects(create(), /Conéctate/); }
  finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  }
  await inspect(async db => { assert.equal((await getDocs(collection(db, 'sub_sectors'))).size, 0); });
});
