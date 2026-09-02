import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where
} from 'firebase/firestore';

const projectId = 'proclean-siteclean-rules-test';
let testEnv;

const profiles = {
  supervisorA: {
    name: 'Supervisor A',
    email: 'supervisor-a@example.test',
    role: 'SUPERVISOR_TERRENO',
    tenantId: 'tenant-a',
    active: true
  },
  itoA: {
    name: 'ITO A',
    email: 'ito-a@example.test',
    role: 'ITO_MANDANTE',
    tenantId: 'tenant-a',
    active: true
  },
  adminA: {
    name: 'Admin A',
    email: 'admin-a@example.test',
    role: 'ADMINISTRADOR_CONTRATO',
    tenantId: 'tenant-a',
    active: true
  },
  supervisorB: {
    name: 'Supervisor B',
    email: 'supervisor-b@example.test',
    role: 'SUPERVISOR_TERRENO',
    tenantId: 'tenant-b',
    active: true
  }
};

async function seedBaseData() {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [uid, profile] of Object.entries(profiles)) {
      await setDoc(doc(db, 'users', uid), profile);
    }
    await setDoc(doc(db, 'work_orders', 'ot-a'), {
      tenantId: 'tenant-a',
      status: 'PROGRAMADO',
      sapCode: 'OT-A'
    });
    await setDoc(doc(db, 'work_orders', 'ot-b'), {
      tenantId: 'tenant-b',
      status: 'PROGRAMADO',
      sapCode: 'OT-B'
    });
  });
}

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedBaseData();
});

after(async () => {
  await testEnv.cleanup();
});

test('denies all work-order reads to unauthenticated clients', async () => {
  const db = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, 'work_orders', 'ot-a')));
});

test('supervisor reads only a tenant-scoped work-order query', async () => {
  const db = testEnv.authenticatedContext('supervisorA').firestore();
  const ownTenantQuery = query(collection(db, 'work_orders'), where('tenantId', '==', 'tenant-a'));
  await assertSucceeds(getDocs(ownTenantQuery));
  await assertFails(getDocs(collection(db, 'work_orders')));
  const otherTenantQuery = query(collection(db, 'work_orders'), where('tenantId', '==', 'tenant-b'));
  await assertFails(getDocs(otherTenantQuery));
});

test('supervisor creates an OT for their tenant but not another tenant', async () => {
  const db = testEnv.authenticatedContext('supervisorA').firestore();
  await assertSucceeds(setDoc(doc(db, 'work_orders', 'new-a'), {
    tenantId: 'tenant-a',
    status: 'PROGRAMADO',
    sapCode: 'NEW-A'
  }));
  await assertFails(setDoc(doc(db, 'work_orders', 'new-b'), {
    tenantId: 'tenant-b',
    status: 'PROGRAMADO',
    sapCode: 'NEW-B'
  }));
  await assertFails(deleteDoc(doc(db, 'work_orders', 'ot-a')));
});

test('ITO can update an OT in its tenant but cannot delete it', async () => {
  const db = testEnv.authenticatedContext('itoA').firestore();
  await assertSucceeds(updateDoc(doc(db, 'work_orders', 'ot-a'), {
    status: 'APROBADO_MANDANTE'
  }));
  await assertFails(deleteDoc(doc(db, 'work_orders', 'ot-a')));
});

test('only contract administrators manage daily staffing', async () => {
  const adminDb = testEnv.authenticatedContext('adminA').firestore();
  await assertSucceeds(setDoc(doc(adminDb, 'proclean_dailyAssignments', 'asg-a'), {
    tenantId: 'tenant-a',
    fecha: '2026-09-01',
    areaId: 'area-a',
    cargoId: 'cargo-a'
  }));

  const supervisorDb = testEnv.authenticatedContext('supervisorA').firestore();
  await assertFails(setDoc(doc(supervisorDb, 'proclean_dailyAssignments', 'asg-b'), {
    tenantId: 'tenant-a',
    fecha: '2026-09-01',
    areaId: 'area-a',
    cargoId: 'cargo-a'
  }));
});

test('contract administrator manages master data only within its tenant', async () => {
  const db = testEnv.authenticatedContext('adminA').firestore();
  await assertSucceeds(setDoc(doc(db, 'proclean_personnel', 'person-a'), {
    tenantId: 'tenant-a',
    nombre: 'Persona A',
    active: true
  }));
  await assertFails(setDoc(doc(db, 'proclean_personnel', 'person-b'), {
    tenantId: 'tenant-b',
    nombre: 'Persona B',
    active: true
  }));
});

test('audit logs are append-only', async () => {
  const db = testEnv.authenticatedContext('supervisorA').firestore();
  await assertSucceeds(setDoc(doc(db, 'audit_logs', 'log-a'), {
    tenantId: 'tenant-a',
    action: 'CREACION'
  }));
  await assertFails(updateDoc(doc(db, 'audit_logs', 'log-a'), { action: 'EDICION' }));
  await assertFails(deleteDoc(doc(db, 'audit_logs', 'log-a')));
});

test('users read their own profile but not another tenant profile', async () => {
  const db = testEnv.authenticatedContext('supervisorA').firestore();
  await assertSucceeds(getDoc(doc(db, 'users', 'supervisorA')));
  await assertFails(getDoc(doc(db, 'users', 'supervisorB')));
});
