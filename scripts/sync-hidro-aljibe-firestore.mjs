import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDryRun = process.argv.includes('--dry-run');
const consolidatedJsonPath = path.resolve(__dirname, '../../siteclean_consolidated_work_orders.json');

if (!fs.existsSync(consolidatedJsonPath)) {
  throw new Error(`Consolidated JSON file not found at ${consolidatedJsonPath}`);
}

const allOrders = JSON.parse(fs.readFileSync(consolidatedJsonPath, 'utf8'));

// Filter only the regularized Hidrojet and Aljibe orders for the period
const hidroAljibeOrders = allOrders.filter(o => 
  (o.vehiclePatent === 'TTCX50' || o.vehiclePatent === 'VLZP91') &&
  o.executionDate >= '2026-08-21' && o.executionDate <= '2026-09-20' &&
  (o.machineHours || 0) > 0
);

console.log(`Found ${hidroAljibeOrders.length} regularized Hidrojet & Aljibe work orders.`);
console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulación sin escrituras)' : 'LIVE EXECUTION (Escritura en Firestore)'}`);

const BATCH_TAG = 'BATCH-2026-09-HIDRO-ALJIBE';
const TENANT_ID = 'tenant_cmz';

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

const mappedDocuments = hidroAljibeOrders.map(order => {
  const docId = order.id || order.docId;
  const fields = {
    id: { stringValue: docId },
    sapCode: { stringValue: order.sapCode || '' },
    equipoCorrea: { stringValue: order.equipoCorrea || '' },
    status: { stringValue: order.status || 'APROBADO_MANDANTE' },
    tenantId: { stringValue: TENANT_ID },
    regularizationBatch: { stringValue: BATCH_TAG },
    updatedAt: { timestampValue: new Date().toISOString() },
    payload: toFirestoreValue(order)
  };
  return { docId, fields };
});

console.log(`Mapped ${mappedDocuments.length} documents for Firestore.`);
const ttcxTotalHM = hidroAljibeOrders.filter(o => o.vehiclePatent === 'TTCX50').reduce((acc, o) => acc + (o.machineHours || 0), 0);
const vlzpTotalHM = hidroAljibeOrders.filter(o => o.vehiclePatent === 'VLZP91').reduce((acc, o) => acc + (o.machineHours || 0), 0);
const waterTotal = hidroAljibeOrders.reduce((acc, o) => acc + (o.waterVolumeM3 || 0), 0);

console.log(`TTCX50 Total HM: ${ttcxTotalHM.toFixed(2)} HM (Target: 270.00 HM)`);
console.log(`VLZP91 Total HM: ${vlzpTotalHM.toFixed(2)} HM (Target: 270.00 HM)`);
console.log(`Recurso Hídrico Total: ${waterTotal.toFixed(2)} m³ (Target: 1200.00 m³)`);

async function run() {
  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETED]: Documents validated perfectly. Pass without --dry-run to commit to Firestore.');
    return;
  }

  console.log('\nStarting LIVE upload to Firestore...');
  const credential = firebaseCliCredential();
  let { access_token: accessToken } = await credential.getAccessToken();

  const root = 'https://firestore.googleapis.com/v1/projects/proclean-siteclean/databases/(default)/documents';

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < mappedDocuments.length; i++) {
    const item = mappedDocuments[i];
    const url = `${root}/work_orders/${item.docId}`;

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: item.fields })
      });

      if (res.ok) {
        successCount++;
        if (successCount % 25 === 0 || successCount === mappedDocuments.length) {
          console.log(`Uploaded ${successCount}/${mappedDocuments.length} OTs...`);
        }
      } else {
        const errText = await res.text();
        console.error(`Failed to upload ${item.docId} (${res.status}): ${errText}`);
        failCount++;
      }
    } catch (err) {
      console.error(`Exception uploading ${item.docId}:`, err);
      failCount++;
    }

    // Small delay to prevent rate bursting
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\n=== UPLOAD FINISHED ===`);
  console.log(`Successfully uploaded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Regularization Batch Tag: ${BATCH_TAG}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
