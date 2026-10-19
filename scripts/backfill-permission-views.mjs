import { readFile } from 'node:fs/promises';
import { readModels, publicCoverage } from '../src/security/readModels.mjs';
import { firebaseCliFirestore } from './firebase-cli-credential.mjs';
const apply = process.argv.includes('--apply');
const useCli = process.argv.includes('--use-firebase-cli-credentials');
const repairOnly = process.argv.includes('--repair-only');
const projectId = process.env.FIREBASE_PROJECT_ID;
const defaultContractId = process.env.DEFAULT_CONTRACT_ID || 'c1';
if (!apply) {
  const seed = JSON.parse(await readFile(new URL('../data/db.json', import.meta.url), 'utf8'));
  console.log(JSON.stringify({ mode: 'dry-run-local', orders: seed.workOrders?.length || 0, contractFallback: defaultContractId,
    collections: ['work_order_details', 'work_order_metrics', 'coverage_public'], writes: 0 }));
  process.exit(0);
}
if (!projectId || !process.argv.includes(`--confirm-project=${projectId}`)) throw new Error('Set FIREBASE_PROJECT_ID and pass --confirm-project=<same project>.');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIRESTORE_EMULATOR_HOST && !useCli) throw new Error('An administrative credential outside the repository or an authenticated Firebase CLI session is required.');
const { initializeApp, applicationDefault } = await import('firebase-admin/app');
const { getFirestore } = await import('firebase-admin/firestore');
if (!useCli) initializeApp({ projectId, ...(process.env.FIRESTORE_EMULATOR_HOST ? {} : { credential: applicationDefault() }) });
const db = useCli ? await firebaseCliFirestore(projectId) : getFirestore();
let writes = 0;
async function migrateCollection(name, migrate) {
  const refs = await db.collection(name).listDocuments();
  let next = 0, completed = 0;
  await Promise.all(Array.from({ length: Math.min(6, refs.length) }, async () => {
    while (next < refs.length) {
      const ref = refs[next++];
      await migrate(ref);
      completed++;
      if (completed % 100 === 0 || completed === refs.length) console.log(`${name}: ${completed}/${refs.length}`);
    }
  }));
}
// Read the latest source in each transaction: never overwrite an OT edited during migration.
await migrateCollection('work_orders', async ref => {
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const data = snapshot.data();
    if (repairOnly && data.payload?.revision) {
      const [detailSnapshot, metricsSnapshot] = await transaction.getAll(db.collection('work_order_details').doc(ref.id), db.collection('work_order_metrics').doc(ref.id));
      if (detailSnapshot.data()?.revision === data.payload.revision && metricsSnapshot.data()?.revision === data.payload.revision) return;
    }
    const order = { ...(data.payload || data), revision: crypto.randomUUID(), id: ref.id, tenantId: data.tenantId || data.payload?.tenantId || 'tenant_cmz',
      contractId: data.contractId || data.payload?.contractId || defaultContractId };
    delete order.payload; delete order.hasBeforeEvidence; delete order.hasAfterEvidence;
    if (order.updatedAt && typeof order.updatedAt !== 'string') order.updatedAt = order.updatedAt.toDate?.().toISOString() || '';
    const { detail, metrics } = readModels(order);
    transaction.set(ref, { payload: order, tenantId: order.tenantId, contractId: order.contractId, areaId: order.areaId || '',
      status: order.status, staffingType: order.staffingType || null, sapCode: order.sapCode || '', equipoCorrea: order.equipoCorrea || '', updatedAt: data.updatedAt || null });
    transaction.set(db.collection('work_order_details').doc(ref.id), detail);
    transaction.set(db.collection('work_order_metrics').doc(ref.id), metrics);
    writes += 3;
  });
});
await migrateCollection('proclean_dailyAssignments', async ref => {
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const data = snapshot.data();
    const assignment = { ...(data.payload || data), id: ref.id, tenantId: data.tenantId || data.payload?.tenantId || 'tenant_cmz', contractId: data.contractId || data.payload?.contractId || defaultContractId };
    delete assignment.payload;
    transaction.set(ref, { ...assignment, payload: assignment });
    transaction.set(db.collection('coverage_public').doc(ref.id), publicCoverage(assignment));
    writes += 2;
  });
});
for (const name of ['contracts', 'audit_logs']) {
  for (const ref of await db.collection(name).listDocuments()) await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref); if (!snapshot.exists) return;
    const data = snapshot.data();
    if (!data.contractId) {
      const contractId = name === 'contracts' ? ref.id : data.payload?.contractId || defaultContractId;
      transaction.update(ref, { contractId, ...(data.payload ? { 'payload.contractId': contractId } : {}) });
    }
  });
}
console.log(JSON.stringify({ mode: 'applied', projectId, projectionWrites: writes }));
