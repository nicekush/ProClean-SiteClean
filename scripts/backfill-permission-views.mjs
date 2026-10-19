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
let repairIds, coverageRepairIds;
if (repairOnly) {
  const [sources, details, metrics] = await Promise.all([
    db.collection('work_orders').select('payload.revision').get(),
    db.collection('work_order_details').select('revision').get(),
    db.collection('work_order_metrics').select('revision').get()
  ]);
  const detailRevisions = new Map(details.docs.map(doc => [doc.id, doc.data().revision]));
  const metricRevisions = new Map(metrics.docs.map(doc => [doc.id, doc.data().revision]));
  repairIds = new Set(sources.docs.filter(doc => {
    const revision = doc.data().payload?.revision;
    return !revision || detailRevisions.get(doc.id) !== revision || metricRevisions.get(doc.id) !== revision;
  }).map(doc => doc.id));
  console.log(`Work orders requiring repair: ${repairIds.size}`);
  const [assignments, publicAssignments] = await Promise.all([
    db.collection('proclean_dailyAssignments').get(), db.collection('coverage_public').get()
  ]);
  const canonical = value => JSON.stringify(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
  const publicRows = new Map(publicAssignments.docs.map(doc => [doc.id, canonical(doc.data())]));
  coverageRepairIds = new Set(assignments.docs.filter(doc => {
    const data = doc.data();
    const projected = publicCoverage({ ...(data.payload || data), id: doc.id,
      tenantId: data.tenantId || data.payload?.tenantId || 'tenant_cmz',
      contractId: data.contractId || data.payload?.contractId || defaultContractId });
    return publicRows.get(doc.id) !== canonical(projected);
  }).map(doc => doc.id));
  console.log(`Coverage assignments requiring repair: ${coverageRepairIds.size}`);
}
async function migrateCollection(name, migrate) {
  const ids = name === 'work_orders' ? repairIds : coverageRepairIds;
  const refs = ids ? [...ids].map(id => db.collection(name).doc(id))
    : (await db.collection(name).select().get()).docs.map(doc => doc.ref);
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
  const snapshot = await db.collection(name).select('contractId', 'payload.contractId').get();
  let batch = db.batch(), pending = 0, updated = 0;
  for (const document of snapshot.docs) {
    const ref = document.ref;
    const data = document.data();
    if (!data.contractId) {
      const contractId = name === 'contracts' ? ref.id : data.payload?.contractId || defaultContractId;
      batch.update(ref, { contractId, ...(data.payload ? { 'payload.contractId': contractId } : {}) });
      pending++; updated++;
      if (pending === 400) { await batch.commit(); batch = db.batch(); pending = 0; }
    }
  }
  if (pending) await batch.commit();
  console.log(`${name}: ${updated} missing contract scopes updated`);
}
console.log(JSON.stringify({ mode: 'applied', projectId, projectionWrites: writes }));
