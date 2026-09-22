import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chileDate, orderDate, delayDays, person, createTrace, editTrace, recoverAuthors, reviewIssues } from '../src/utils/reportability.ts';
const user = {id:'u1',name:'Supervisor Uno',role:'SUPERVISOR_TERRENO',tenantId:'t1'};
const order = {id:'o1',tenantId:'t1',sapCode:'SAP1',status:'COMPLETADO',executionDate:'2026-09-07',headcount:4,realHours:8,hasManualLabor:true,hasEquipment:false,shiftId:'d',equipoCorrea:'CT32',operationDetail:'Aseo',imageBeforeUrl:'before',imageAfterUrl:'after'};
const log = {id:'l1',tenantId:'t1',entityName:'Orden de Trabajo',entityId:'SAP1',action:'CREACION',userName:'Supervisor Uno (SUPERVISOR_TERRENO)'};
test('Chile dates and calendar delay respect midnight boundary',()=>{
  assert.equal(chileDate('2026-09-08T01:00:00Z'),'2026-09-07');
  assert.equal(delayDays({...order,createdAt:'2026-09-09T12:00:00Z'}),2);
  assert.equal(orderDate(order,'creation'),'');
  assert.equal(chileDate('07-09-2026, 2:00 p.m.'),'');
});
test('creation identity persists through editing and cannot change tenant or ID',()=>{
  const original={...order,...createTrace(user,'2026-09-08T12:00:00Z')};
  const edited=editTrace(original,{createdById:'fake',createdAt:'fake',id:'fake',tenantId:'other',machineHours:9},{...user,id:'u2'},'2026-09-09T12:00:00Z');
  assert.equal(edited.createdById,'u1');assert.equal(edited.updatedById,'u2');assert.equal(edited.id,'o1');assert.equal(edited.tenantId,'t1');
  assert.equal(edited.responsibleSupervisorId,'u1');
  assert.equal(editTrace(order,{},user).createdById,undefined);
});
test('historical recovery requires unique same-tenant order, event and user',()=>{
  const [recovered]=recoverAuthors([order],[log],[user]);
  assert.equal(person(recovered,'author').id,'u1');assert.equal(recovered.authorSource,'audit');assert.equal(recovered.createdAt,undefined);
  assert.equal(order.createdById,undefined);
  for(const [orders,logs,users] of [
    [[order,{...order,id:'o2'}],[log],[user]],
    [[order],[log,{...log,id:'l2'}],[user]],
    [[order],[log],[user,{...user,id:'u2'}]],
    [[order],[{...log,tenantId:'t2'}],[user]],
    [[order],[log,{...log,action:'ELIMINACION'}],[user]],
  ]) assert.equal(recoverAuthors(orders,logs,users)[0].createdById,undefined);
});
test('exact OT ID recovers despite reused SAP; existing author wins',()=>{
  assert.equal(recoverAuthors([order,{...order,id:'o2'}],[{...log,entityId:'o1',userId:'u1'}],[user])[0].createdById,'u1');
  assert.equal(recoverAuthors([{...order,createdById:'u3'}],[log],[user])[0].createdById,'u3');
});
test('quality review considers execution state and resource type',()=>{
  assert.deepEqual(reviewIssues(order),[]);
  assert.ok(reviewIssues({...order,hasEquipment:true,machineHours:0,vehiclePatent:'X'}).includes('Maquinaria sin HM positivas'));
  assert.ok(!reviewIssues({...order,status:'PROGRAMADO',imageBeforeUrl:'',imageAfterUrl:'',realHours:0}).some(x=>x.includes('evidencia')||x.includes('duración')));
});
