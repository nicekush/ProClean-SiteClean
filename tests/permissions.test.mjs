import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { readModels, PHOTO_FIELDS, publicCoverage } from '../src/security/readModels.mjs';
const catalog = JSON.parse(await readFile(new URL('../src/security/catalog.json', import.meta.url)));
const defaults = JSON.parse(await readFile(new URL('../src/security/roleDefaults.json', import.meta.url)));
const source = (await readFile(new URL('../src/security/permissions.ts', import.meta.url), 'utf8'))
  .replace("import catalog from './catalog.json';", `const catalog = ${JSON.stringify(catalog)};`)
  .replace("import roleDefaults from './roleDefaults.json';", `const roleDefaults = ${JSON.stringify(defaults)};`);
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 } }).outputText;
const { normalizePermissions, togglePermission, effectivePermissions, canOpenTab, inScope } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const user = extra => ({ id:'test', name:'Test', email:'test@example.test', role:'CLIENTE_VISUALIZADOR', tenantId:'tenant-a', active:true, ...extra });
test('catalogue IDs are unique, dependencies exist and form an acyclic graph', () => {
  assert.equal(new Set(catalog.map(p => p.id)).size, catalog.length);
  function visit(id, path = []) {
    assert.ok(!path.includes(id), `Cycle: ${[...path,id]}`);
    const entry=catalog.find(p => p.id===id); assert.ok(entry, `Unknown: ${id}`);
    for (const dep of entry.requires) visit(dep,[...path,id]);
  }
  for (const p of catalog) visit(p.id);
});
test('approval enables viewing photos and OT without enabling editing, deletion or export', () => {
  const result=normalizePermissions(['orders.approve']);
  assert.deepEqual(new Set(result), new Set(['orders.approve','orders.view','evidence.view']));
});
test('removing a prerequisite removes all transitive dependents and preserves independent permissions', () => {
  const enabled=normalizePermissions(['orders.approve','map.orders','evidence.upload','map.view','kpi.view']);
  assert.deepEqual(new Set(togglePermission(enabled,'orders.view',false)), new Set(['map.view','kpi.view']));
});
test('explicit empty permissions suppress role defaults; inactive and malformed profiles fail closed', () => {
  assert.deepEqual(effectivePermissions(user({role:'ADMINISTRADOR_CONTRATO',permissions:[]})),[]);
  assert.deepEqual(effectivePermissions(user({active:false,role:'SUPER_ADMIN'})),[]);
  assert.deepEqual(effectivePermissions(user({permissions:['orders.approve','unknown']})),[]);
});
test('maps and KPI do not require opening the OT interface', () => {
  const profile=user({permissions:['map.view','kpi.view']});
  assert.ok(canOpenTab(profile,'map-operational')); assert.ok(canOpenTab(profile,'dashboard'));
  assert.equal(canOpenTab(profile,'work-orders'),false); assert.equal(canOpenTab(profile,'system-config'),false);
});
test('default templates contain complete dependencies; viewer has no mutation, export or administration grants', () => {
  for (const permissions of Object.values(defaults)) assert.deepEqual(normalizePermissions(permissions),permissions);
  for (const permission of defaults.CLIENTE_VISUALIZADOR) assert.match(permission,/^(orders\.view|kpi\.view|map\.view|map\.orders)$/);
});
test('tenant, contract and area scopes intersect', () => {
  const profile=user({accessScope:'CONTRACT',contractId:'c1',allowedAreaIds:['a1']});
  assert.ok(inScope(profile,{tenantId:'tenant-a',contractId:'c1',areaId:'a1'}));
  for (const change of [{tenantId:'tenant-b'},{contractId:'c2'},{areaId:'a2'}]) assert.equal(inScope(profile,{tenantId:'tenant-a',contractId:'c1',areaId:'a1',...change}),false);
});
test('metric data omit photos, signatures, names and activity text while retaining evidence counts and OT number', () => {
  const {detail,metrics}=readModels({id:'1',tenantId:'a',sapCode:'OT-7',operationDetail:'Internal text',createdByName:'Private name',beforePhotoUrl:'data:image/jpeg;base64,abc',afterPhotoUrl:null,itoSignatureDataUrl:'signature',headcount:5});
  for (const field of PHOTO_FIELDS) { assert.equal(detail[field],undefined); assert.equal(metrics[field],undefined); }
  for (const field of ['createdByName','operationDetail']) assert.equal(metrics[field],undefined);
  assert.equal(metrics.sapCode,'OT-7'); assert.equal(metrics.headcount,5); assert.equal(metrics.hasBeforeEvidence,true); assert.equal(metrics.hasAfterEvidence,false);
});
test('public staffing preserves coverage totals without leaking identity', () => {
  const projected=publicCoverage({id:'1',personId:'private-id',personName:'Private',userEmail:'private@example.test',rut:'private',cargoName:'Operador'});
  assert.equal(projected.personId,'covered'); assert.equal(projected.personName,''); assert.equal(projected.userEmail,undefined); assert.equal(projected.rut,undefined);
  assert.equal(publicCoverage({id:'2',personId:'',personName:''}).personId,'');
});
