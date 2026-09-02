import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const projectId = process.env.FIREBASE_PROJECT_ID || 'proclean-siteclean';
const apiKey = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyCyRmnH6xKA41-lVm5jzb56qCsED1gpWsI';
const outputPath = resolve(
  process.argv.find(argument => argument.startsWith('--output='))?.slice('--output='.length)
    || `../backups/firestore-${projectId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
);

const databaseRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;
const knownCollections = [
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
  'audit_logs'
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
console.log(`Backup complete: ${documentCount} documents in ${backup.collectionCount} collections.`);
console.log(`Output: ${outputPath}`);
