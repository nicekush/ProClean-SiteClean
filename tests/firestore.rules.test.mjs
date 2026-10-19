import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where, writeBatch, setLogLevel } from 'firebase/firestore';
import { readModels, publicCoverage } from '../src/security/readModels.mjs';
const roles = JSON.parse(await readFile(new URL('../src/security/roleDefaults.json', import.meta.url)));
const projectId = 'proclean-siteclean-rules-test';
let testEnv;
setLogLevel('silent');
const account = (id, role, extra = {}) => ({ id, name: id, email: `${id}@example.test`, role, tenantId: 'tenant-a', contractId: 'c1', active: true, ...extra });
const profiles = {
  supervisorA: account('supervisorA', 'SUPERVISOR_TERRENO'),
  itoA: account('itoA', 'ITO_MANDANTE'),
  adminA: account('adminA', 'ADMINISTRADOR_CONTRATO'),
  principal: account('principal', 'SUPER_ADMIN'),
  supervisorB: account('supervisorB', 'SUPERVISOR_TERRENO', { tenantId: 'tenant-b' }),
  viewer: account('viewer', 'CLIENTE_VISUALIZADOR', { accessScope: 'CONTRACT', permissions: roles.CLIENTE_VISUALIZADOR }),
  mapOnly: account('mapOnly', 'CLIENTE_VISUALIZADOR', { permissions: ['map.view'] }),
  restricted: account('restricted', 'CLIENTE_VISUALIZADOR', { accessScope: 'CONTRACT', allowedAreaIds: ['area-a'], permissions: roles.CLIENTE_VISUALIZADOR }),
  empty: account('empty', 'ADMINISTRADOR_CONTRATO', { permissions: [] }),
  inactive: account('inactive', 'ADMINISTRADOR_CONTRATO', { active: false }),
  reporter: account('reporter', 'CLIENTE_VISUALIZADOR', { permissions: ['orders.view','users.view','reporting.view','reporting.assign'] }),
  editor: account('editor', 'CLIENTE_VISUALIZADOR', { permissions: ['orders.view','evidence.view','orders.edit'] }),
  uploader: account('uploader', 'CLIENTE_VISUALIZADOR', { permissions: ['orders.view','evidence.view','evidence.upload'] }),
  coverageViewer: account('coverageViewer', 'CLIENTE_VISUALIZADOR', { permissions: ['coverage.view'] }),
};
const orders = {
  'ot-a': { id: 'ot-a', tenantId: 'tenant-a', contractId: 'c1', areaId: 'area-a', status: 'PROGRAMADO', sapCode: 'OT-A', operationDetail: 'Limpieza', headcount: 2, realHours: 4, beforePhotoUrl: 'private-before', afterPhotoUrl: 'private-after' },
  'ot-b': { id: 'ot-b', tenantId: 'tenant-b', contractId: 'c1', areaId: 'area-b', status: 'PROGRAMADO', sapCode: 'OT-B' },
  'other-contract': { id: 'other-contract', tenantId: 'tenant-a', contractId: 'c2', areaId: 'area-a', status: 'PROGRAMADO', sapCode: 'OT-C' },
  'other-area': { id: 'other-area', tenantId: 'tenant-a', contractId: 'c1', areaId: 'area-b', status: 'PROGRAMADO', sapCode: 'OT-D' },
};
const wrappedUser = profile => ({ ...profile, payload: profile });
const wrappedOrder = order => ({ payload: order, tenantId: order.tenantId, contractId: order.contractId, areaId: order.areaId || '', status: order.status, sapCode: order.sapCode || '', equipoCorrea: order.equipoCorrea || '', staffingType: order.staffingType || null });
const dbFor = uid => testEnv.authenticatedContext(uid).firestore();
function saveOrder(db, order) {
  order = { ...order, revision: crypto.randomUUID() };
  const batch = writeBatch(db); const views = readModels(order);
  batch.set(doc(db, 'work_orders', order.id), wrappedOrder(order));
  batch.set(doc(db, 'work_order_details', order.id), views.detail);
  batch.set(doc(db, 'work_order_metrics', order.id), views.metrics);
  return batch.commit();
}
function removeOrder(db, id) {
  const batch = writeBatch(db);
  for (const name of ['work_orders','work_order_details','work_order_metrics']) batch.delete(doc(db, name, id));
  return batch.commit();
}
before(async () => { testEnv = await initializeTestEnvironment({ projectId, firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') } }); });
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid, profile] of Object.entries(profiles)) await setDoc(doc(db,'users',uid), wrappedUser(profile));
    for (const order of Object.values(orders)) await saveOrder(db, order);
    const assignment = { id:'asg-a', tenantId:'tenant-a', contractId:'c1', areaId:'area-a', cargoId:'c1', cargoName:'Operador', slotIndex:0, fecha:'2026-10-19', grupo:'A', shiftId:'day', personId:'person-a', personName:'Nombre privado', userEmail:'private@example.test' };
    await setDoc(doc(db,'proclean_dailyAssignments','asg-a'), { ...assignment, payload: assignment });
    await setDoc(doc(db,'coverage_public','asg-a'), publicCoverage(assignment));
  });
});
after(async () => { await testEnv?.cleanup(); });

test('unauthenticated clients cannot read operational data or profiles', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  for (const name of ['work_orders','work_order_details','work_order_metrics','users']) await assertFails(getDoc(doc(db,name,name==='users'?'viewer':'ot-a')));
});
test('supervisor reads only tenant-scoped work-order queries', async () => {
  const db=dbFor('supervisorA');
  await assertSucceeds(getDocs(query(collection(db,'work_orders'),where('tenantId','==','tenant-a'))));
  await assertFails(getDocs(collection(db,'work_orders')));
  await assertFails(getDoc(doc(db,'work_orders','ot-b')));
});
test('supervisor creates an OT and its projections atomically, only in own tenant', async () => {
  const db=dbFor('supervisorA');
  await assertSucceeds(saveOrder(db,{...orders['ot-a'],id:'new-a'}));
  await assertFails(saveOrder(db,{...orders['ot-b'],id:'new-b'}));
  await assertFails(setDoc(doc(db,'work_orders','missing-views'), wrappedOrder({...orders['ot-a'],id:'missing-views'})));
  await assertFails(removeOrder(db,'ot-a'));
});
test('ITO approves without editing production values or deleting orders', async () => {
  const db=dbFor('itoA');
  await assertSucceeds(saveOrder(db,{...orders['ot-a'],status:'APROBADO_MANDANTE',approvedById:'itoA',approvedAt:'2026-10-19T12:00:00Z'}));
  await assertFails(saveOrder(db,{...orders['ot-a'],headcount:99}));
  await assertFails(removeOrder(db,'ot-a'));
});
test('edit does not imply approval, deletion or replacement of photos', async () => {
  const db=dbFor('editor');
  await assertSucceeds(saveOrder(db,{...orders['ot-a'],headcount:3}));
  await assertFails(saveOrder(db,{...orders['ot-a'],headcount:3,beforePhotoUrl:'changed'}));
  await assertFails(saveOrder(db,{...orders['ot-a'],status:'APROBADO_MANDANTE',approvedById:'editor'}));
  await assertFails(removeOrder(db,'ot-a'));
});
test('photo uploader cannot change production values or ITO signatures', async () => {
  const db=dbFor('uploader');
  await assertSucceeds(saveOrder(db,{...orders['ot-a'],beforePhotoUrl:'new-photo'}));
  await assertFails(saveOrder(db,{...orders['ot-a'],beforePhotoUrl:'new-photo',realHours:100}));
  await assertFails(saveOrder(db,{...orders['ot-a'],beforePhotoUrl:'new-photo',itoSignatureDataUrl:'forged'}));
});
test('viewer reads authorized detail without photos; raw records are denied', async () => {
  const db=dbFor('viewer');
  const snapshot=await assertSucceeds(getDoc(doc(db,'work_order_details','ot-a')));
  assert.equal(snapshot.data().beforePhotoUrl,undefined); assert.equal(snapshot.data().itoSignatureDataUrl,undefined);
  assert.equal(snapshot.data().hasBeforeEvidence,true);
  await assertFails(getDoc(doc(db,'work_orders','ot-a')));
  await assertFails(saveOrder(db,{...orders['ot-a'],headcount:100}));
  await assertFails(removeOrder(db,'ot-a'));
});
test('map-only user receives metric records without OT detail or photos', async () => {
  const db=dbFor('mapOnly');
  const data=(await assertSucceeds(getDoc(doc(db,'work_order_metrics','ot-a')))).data();
  assert.equal(data.operationDetail,undefined); assert.equal(data.beforePhotoUrl,undefined); assert.equal(data.createdByName,undefined);
  await assertFails(getDoc(doc(db,'work_order_details','ot-a')));
  await assertFails(getDoc(doc(db,'work_orders','ot-a')));
});
test('contract and area restrictions apply to direct reads and queries', async () => {
  const db=dbFor('restricted');
  const q=query(collection(db,'work_order_metrics'),where('tenantId','==','tenant-a'),where('contractId','==','c1'),where('areaId','in',['area-a']));
  assert.equal((await assertSucceeds(getDocs(q))).size,1);
  await assertFails(getDocs(query(collection(db,'work_order_metrics'),where('tenantId','==','tenant-a'))));
  for (const id of ['ot-b','other-contract','other-area']) await assertFails(getDoc(doc(db,'work_order_metrics',id)));
});
test('explicit empty permissions override administrator defaults; disabled users lose data access', async () => {
  for (const uid of ['empty','inactive']) {
    const db=dbFor(uid); await assertFails(getDoc(doc(db,'work_order_metrics','ot-a')));
    await assertFails(saveOrder(db,{...orders['ot-a'],headcount:99}));
  }
  await assertSucceeds(getDoc(doc(dbFor('inactive'),'users','inactive')));
});
test('reporting assignment preserves photographs without granting access to them', async () => {
  const db=dbFor('reporter'); const batch=writeBatch(db); const revision=crypto.randomUUID();
  batch.update(doc(db,'work_orders','ot-a'), {'payload.revision':revision,'payload.responsibleSupervisorId':'supervisorA','payload.responsibleSupervisorName':'Supervisor A','payload.updatedById':'reporter'});
  batch.update(doc(db,'work_order_details','ot-a'),{revision,responsibleSupervisorId:'supervisorA',responsibleSupervisorName:'Supervisor A',updatedById:'reporter'});
  batch.update(doc(db,'work_order_metrics','ot-a'),{revision});
  await assertSucceeds(batch.commit());
  await assertFails(getDoc(doc(db,'work_orders','ot-a')));
  await assertFails(updateDoc(doc(db,'work_orders','ot-a'),{'payload.headcount':99}));
});
test('coverage-only viewer cannot read names, personal data or assignments', async () => {
  const db=dbFor('coverageViewer');
  const data=(await assertSucceeds(getDoc(doc(db,'coverage_public','asg-a')))).data();
  assert.equal(data.personName,''); assert.equal(data.personId,'covered'); assert.equal(data.userEmail,undefined);
  await assertFails(getDoc(doc(db,'proclean_dailyAssignments','asg-a')));
  await assertFails(getDocs(query(collection(db,'proclean_personnel'),where('tenantId','==','tenant-a'))));
  await assertFails(setDoc(doc(db,'proclean_dailyAssignments','new'),{tenantId:'tenant-a'}));
});
test('only authorized administrators manage staffing and master data in their tenant', async () => {
  const db=dbFor('adminA');
  await assertSucceeds(setDoc(doc(db,'proclean_personnel','person-a'),{tenantId:'tenant-a',nombre:'Persona A'}));
  await assertFails(setDoc(doc(db,'proclean_personnel','person-b'),{tenantId:'tenant-b',nombre:'Persona B'}));
  await assertSucceeds(setDoc(doc(db,'proclean_dailyAssignments','new'),{tenantId:'tenant-a',contractId:'c1'}));
  await assertFails(setDoc(doc(dbFor('supervisorA'),'proclean_dailyAssignments','bad'),{tenantId:'tenant-a',contractId:'c1'}));
});
test('contract administrator can assign a valid viewer profile', async () => {
  const next={...profiles.viewer,name:'Cliente',permissions:['map.view'],permissionProfileId:''};
  await assertSucceeds(setDoc(doc(dbFor('adminA'),'users','viewer'),wrappedUser(next)));
});
test('permissions cannot be elevated above administrator grants or omit dependencies', async () => {
  const db=dbFor('adminA');
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...profiles.viewer,permissions:['orders.edit']})));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...profiles.viewer,role:'SUPER_ADMIN',permissions:roles.SUPER_ADMIN})));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...profiles.viewer,permissions:['maintenance.reset']})));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...profiles.viewer,permissions:['orders.view','evidence.view','orders.approve']})));
});
test('users cannot change their own permissions or deactivate themselves', async () => {
  const db=dbFor('adminA');
  await assertFails(setDoc(doc(db,'users','adminA'),wrappedUser({...profiles.adminA,permissions:roles.SUPER_ADMIN})));
  await assertFails(setDoc(doc(db,'users','adminA'),wrappedUser({...profiles.adminA,active:false})));
  await assertFails(deleteDoc(doc(db,'users','adminA')));
});
test('principal accounts remain protected against demotion, deactivation and deletion', async () => {
  const db=dbFor('principal');
  await assertFails(setDoc(doc(db,'users','principal'),wrappedUser({...profiles.principal,active:false})));
  await assertFails(deleteDoc(doc(db,'users','principal')));
  await assertFails(setDoc(doc(dbFor('adminA'),'users','principal'),wrappedUser({...profiles.principal,role:'CLIENTE_VISUALIZADOR'})));
});
test('profiles cannot diverge between root and payload or introduce stored passwords', async () => {
  const db=dbFor('principal');
  await assertFails(setDoc(doc(db,'users','viewer'),{...wrappedUser(profiles.viewer),role:'SUPER_ADMIN'}));
  const next={...profiles.viewer,password:'do-not-store'};
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser(next)));
});
test('permission templates are tenant-scoped and validate dependency rules', async () => {
  const db=dbFor('principal');
  await assertSucceeds(setDoc(doc(db,'permission_profiles','client'),{id:'client',tenantId:'tenant-a',name:'Cliente',permissions:['map.view']}));
  await assertFails(setDoc(doc(db,'permission_profiles','bad'),{id:'bad',tenantId:'tenant-a',name:'Inválido',permissions:['orders.edit']}));
  await assertFails(setDoc(doc(dbFor('viewer'),'permission_profiles','other'),{id:'other',tenantId:'tenant-a',name:'Otro',permissions:['map.view']}));
});
test('operational copies cannot contain photographs or invented metrics', async () => {
  const db=dbFor('supervisorA'); const views=readModels(orders['ot-a']);
  await assertFails(setDoc(doc(db,'work_order_metrics','ot-a'),{...views.metrics,beforePhotoUrl:'private'}));
  await assertFails(setDoc(doc(db,'work_order_metrics','ot-a'),{...views.metrics,headcount:999}));
  await assertFails(setDoc(doc(db,'work_order_details','ot-a'),{...views.detail,itoSignatureDataUrl:'private'}));
  await assertFails(updateDoc(doc(db,'work_orders','ot-a'),{'payload.headcount':9}));
});
test('permission changes take effect for the existing authenticated identity', async () => {
  const db=dbFor('mapOnly'); await assertSucceeds(getDoc(doc(db,'work_order_metrics','ot-a')));
  const next={...profiles.mapOnly,permissions:[]};
  await assertSucceeds(setDoc(doc(dbFor('principal'),'users','mapOnly'),wrappedUser(next)));
  await assertFails(getDoc(doc(db,'work_order_metrics','ot-a')));
});
test('audit records are append-only and tenant isolation applies to user profiles', async () => {
  const db=dbFor('supervisorA');
  await assertSucceeds(setDoc(doc(db,'audit_logs','log-a'),{tenantId:'tenant-a',action:'CREACION'}));
  await assertFails(updateDoc(doc(db,'audit_logs','log-a'),{action:'EDICION'}));
  await assertFails(deleteDoc(doc(db,'audit_logs','log-a')));
  await assertSucceeds(getDoc(doc(db,'users','supervisorA')));
  await assertFails(getDoc(doc(db,'users','supervisorB')));
});

test('principal can save a canonical OT with both projections', async () => { await assertSucceeds(saveOrder(dbFor('principal'), {...orders['ot-a'],headcount:3})); });

test('delegated account editors can change names but cannot assign privileges', async () => {
  const operator=account('accountEditor','CLIENTE_VISUALIZADOR',{permissions:['users.view','users.edit']});
  await testEnv.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(),'users',operator.id),wrappedUser(operator)); });
  const db=dbFor(operator.id);
  await assertSucceeds(setDoc(doc(db,'users','viewer'),wrappedUser({...profiles.viewer,name:'Renamed client'})));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...profiles.viewer,name:'Renamed client',permissions:['map.view']})));
});
test('creating an account does not imply assigning permissions', async () => {
  const operator=account('accountCreator','CLIENTE_VISUALIZADOR',{permissions:['users.view','users.create']});
  await testEnv.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(),'users',operator.id),wrappedUser(operator)); });
  const db=dbFor(operator.id);
  await assertSucceeds(setDoc(doc(db,'users','newEmpty'),wrappedUser(account('newEmpty','CLIENTE_VISUALIZADOR',{permissions:[]}))));
  await assertFails(setDoc(doc(db,'users','newGranted'),wrappedUser(account('newGranted','CLIENTE_VISUALIZADOR',{permissions:['map.view']}))));
});
test('scoped administrators cannot broaden a user contract or area scope', async () => {
  const operator=account('scopedAdmin','ADMINISTRADOR_CONTRATO',{accessScope:'CONTRACT',allowedAreaIds:['area-a']});
  await testEnv.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(),'users',operator.id),wrappedUser(operator)); });
  const db=dbFor(operator.id);
  const next={...profiles.viewer,permissions:['map.view'],allowedAreaIds:['area-a']};
  await assertSucceeds(setDoc(doc(db,'users','viewer'),wrappedUser(next)));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...next,accessScope:'TENANT'})));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...next,allowedAreaIds:[]})));
  await assertFails(setDoc(doc(db,'users','viewer'),wrappedUser({...next,allowedAreaIds:['area-b']})));
});
test('permission template IDs cannot be taken over from another tenant', async () => {
  await testEnv.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(),'permission_profiles','foreign'),{id:'foreign',name:'Other tenant',tenantId:'tenant-b',permissions:['map.view']}); });
  await assertFails(setDoc(doc(dbFor('principal'),'permission_profiles','foreign'),{id:'foreign',name:'Takeover',tenantId:'tenant-a',permissions:['map.view']}));
});
test('batch writes reject both stale copies and malicious private fields', async () => {
  const db=dbFor('supervisorA'); const order={...orders['ot-a'],revision:crypto.randomUUID(),headcount:8}; const views=readModels(order);
  const batch=writeBatch(db);
  batch.set(doc(db,'work_orders',order.id),wrappedOrder(order));
  batch.set(doc(db,'work_order_details',order.id),{...views.detail,beforePhotoUrl:'leak'});
  batch.set(doc(db,'work_order_metrics',order.id),views.metrics);
  await assertFails(batch.commit());
});
test('nullable legacy photos generate correct evidence counts', async () => {
  await assertSucceeds(saveOrder(dbFor('supervisorA'),{...orders['ot-a'],id:'nullable',beforePhotoUrl:null,afterPhotoUrl:null}));
});
test('viewer cannot write operational copies even when the values are accurate', async () => {
  const db=dbFor('viewer');const data=(await getDoc(doc(db,'work_order_metrics','ot-a'))).data();
  await assertFails(setDoc(doc(db,'work_order_metrics','ot-a'),data));
});
test('staffing batches support eight assignments plus their sanitized copies', async () => {
  const db=dbFor('adminA');const batch=writeBatch(db);
  for(let i=0;i<8;i++){
    const assignment={id:`bulk-${i}`,tenantId:'tenant-a',contractId:'c1',areaId:'area-a',cargoId:'c1',cargoName:'Operador',slotIndex:i,fecha:'2026-10-19',grupo:'A',shiftId:'day',personId:`person-${i}`,personName:'Private',createdAt:'2026-10-19T12:00:00Z'};
    batch.set(doc(db,'proclean_dailyAssignments',assignment.id),{...assignment,payload:assignment});
    batch.set(doc(db,'coverage_public',assignment.id),publicCoverage(assignment));
  }
  await assertSucceeds(batch.commit());
});

test('unknown legacy OT metadata remains in detail and is safely omitted from metrics', async () => {
  await assertSucceeds(saveOrder(dbFor('supervisorA'),{...orders['ot-a'],legacyExtra:{internal:'not-for-metrics'}}));
  const detail=(await getDoc(doc(dbFor('viewer'),'work_order_details','ot-a'))).data();
  const metrics=(await getDoc(doc(dbFor('viewer'),'work_order_metrics','ot-a'))).data();
  assert.deepEqual(detail.legacyExtra,{internal:'not-for-metrics'}); assert.equal(metrics.legacyExtra,undefined);
});
