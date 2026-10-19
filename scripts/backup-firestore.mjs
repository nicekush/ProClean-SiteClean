import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { firebaseCliCredential } from './firebase-cli-credential.mjs';
const credential = process.argv.includes('--use-firebase-cli-credentials') ? firebaseCliCredential() : null;
const projectId = process.env.FIREBASE_PROJECT_ID || 'proclean-siteclean';
const apiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCyRmnH6xKA41-lVm5jzb56qCsED1gpWsI';
const outputPath = resolve(
  process.argv.find(argument => argument.startsWith('--output='))?.slice('--output='.length)
    || `../backups/firestore-${projectId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);

const databaseRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
let knownCollections = [
  'work_orders',
  'users',
  'proclean_dailyAssignments',
  'proclean_personnel',
  'proclean_coverageAreas',
  'proclean_cargos',
  'contracts',
  'shifts',
  'contingencies',
  'plant_areas',
  'sectors',
  'sub_sectors',
  'equipments',
  'machines',
  'workers',
  'whitelabel',
  'audit_logs', 'work_order_details', 'work_order_metrics', 'coverage_public', 'permission_profiles'
];
const collections = {};
let documentCount = 0;

function encodeDocumentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function firestoreRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(credential ? { Authorization: `Bearer ${(await credential.getAccessToken()).access_token}` } : {}),
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`Firestore backup request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function backupCollection(collectionPath) {
  let pageToken;
  const records = [];
  do {
    const query = new URLSearchParams({ pageSize: '1000', key: apiKey });
    if (pageToken) query.set('pageToken', pageToken);
    const result = await firestoreRequest(
      `${databaseRoot}/documents/${encodeDocumentPath(collectionPath)}?${query}`
    );
    for (const document of result.documents || []) {
      records.push(document);
      documentCount += 1;
    }
    pageToken = result.nextPageToken;
  } while (pageToken);

  collections[collectionPath] = records;
  console.log(`Backed up ${records.length} documents from ${collectionPath}.`);
}

if (credential) {
  let pageToken;
  const discovered = [];
  do {
    const result = await firestoreRequest(`${databaseRoot}/documents:listCollectionIds`, {
      method: 'POST', body: JSON.stringify({ pageSize: 1000, ...(pageToken ? { pageToken } : {}) })
    });
    discovered.push(...(result.collectionIds || []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  knownCollections = [...new Set([...knownCollections, ...discovered])];
}
for (const collectionId of knownCollections) {
  await backupCollection(collectionId);
}

const backup = {
  format: 'siteclean-firestore-logical-backup-v1',
  projectId,
  createdAt: new Date().toISOString(),
  documentCount,
  collectionCount: Object.keys(collections).length,
  collections
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(backup, null, 2), 'utf8');
const saved = await readFile(outputPath);
const verified = JSON.parse(saved.toString('utf8'));
if (Object.values(verified.collections).reduce((n, docs) => n + docs.length, 0) !== documentCount) throw new Error('Backup count verification failed.');
console.log(`Backup complete: ${documentCount} documents in ${backup.collectionCount} collections.`);
console.log(`SHA256: ${createHash('sha256').update(saved).digest('hex')}`);
console.log(`Output: ${outputPath}`);
