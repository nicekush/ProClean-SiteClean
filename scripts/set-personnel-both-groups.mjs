import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const projectId = process.env.FIREBASE_PROJECT_ID || 'proclean-siteclean';
const tenantId = process.env.DEFAULT_TENANT_ID || 'tenant_cmz';
const confirmedProject = process.argv.find(arg => arg.startsWith('--confirm-project='))?.split('=')[1];
const confirmedTenant = process.argv.find(arg => arg.startsWith('--confirm-tenant='))?.split('=')[1];
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = resolve(`../backups/personnel-groups-${projectId}-${tenantId}-${timestamp}.json`);

if (apply && (confirmedProject !== projectId || confirmedTenant !== tenantId)) {
  throw new Error(`Refusing to write. Pass --confirm-project=${projectId} and --confirm-tenant=${tenantId} exactly.`);
}

const { access_token: accessToken } = await firebaseCliCredential().getAccessToken();
const databaseRoot = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)`;

async function firestoreRequest(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`Firestore request failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function fetchPersonnelDocuments() {
  const documents = [];
  let pageToken;
  do {
    const query = new URLSearchParams({ pageSize: '1000' });
    if (pageToken) query.set('pageToken', pageToken);
    const result = await firestoreRequest(`${databaseRoot}/documents/proclean_personnel?${query}`);
    documents.push(...(result.documents || []));
    pageToken = result.nextPageToken;
  } while (pageToken);
  return documents;
}

function getStringField(document, fieldName) {
  return document.fields?.[fieldName]?.stringValue;
}

function getPayloadStringField(document, fieldName) {
  return document.fields?.payload?.mapValue?.fields?.[fieldName]?.stringValue;
}

const personnelDocuments = await fetchPersonnelDocuments();
const tenantDocuments = personnelDocuments.filter(document => {
  return (getStringField(document, 'tenantId') || getPayloadStringField(document, 'tenantId')) === tenantId;
});
const affectedDocuments = tenantDocuments.filter(document => {
  const rootGroup = getStringField(document, 'grupo');
  const payloadGroup = getPayloadStringField(document, 'grupo');
  const hasPayload = Boolean(document.fields?.payload?.mapValue);
  return rootGroup !== 'AMBOS' || (hasPayload && payloadGroup !== 'AMBOS');
});

const groupCounts = tenantDocuments.reduce((counts, document) => {
  const group = getStringField(document, 'grupo') || getPayloadStringField(document, 'grupo') || 'SIN_GRUPO';
  counts[group] = (counts[group] || 0) + 1;
  return counts;
}, {});

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
console.log(`Target project: ${projectId}`);
console.log(`Target tenant: ${tenantId}`);
console.log(`Personnel documents in project: ${personnelDocuments.length}`);
console.log(`Personnel documents in tenant: ${tenantDocuments.length}`);
console.log(`Current groups: ${JSON.stringify(groupCounts)}`);
console.log(`Documents requiring update: ${affectedDocuments.length}`);

if (!apply) {
  console.log('Dry run complete. No data was changed.');
  process.exit(0);
}

const backup = {
  format: 'siteclean-personnel-group-backup-v1',
  projectId,
  tenantId,
  createdAt: new Date().toISOString(),
  documentCount: affectedDocuments.length,
  documents: affectedDocuments.map(document => {
    return {
      id: document.name.split('/').at(-1),
      grupo: getStringField(document, 'grupo') ?? null,
      payloadGrupo: getPayloadStringField(document, 'grupo') ?? null
    };
  })
};

await mkdir(dirname(backupPath), { recursive: true });
await writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');
console.log(`Backup written: ${backupPath}`);

for (let offset = 0; offset < affectedDocuments.length; offset += 400) {
  const writes = affectedDocuments.slice(offset, offset + 400).map(document => {
    const hasPayload = Boolean(document.fields?.payload?.mapValue);
    return {
      update: {
        name: document.name,
        fields: {
          grupo: { stringValue: 'AMBOS' },
          ...(hasPayload ? {
            payload: { mapValue: { fields: { grupo: { stringValue: 'AMBOS' } } } }
          } : {})
        }
      },
      updateMask: {
        fieldPaths: ['grupo', ...(hasPayload ? ['payload.grupo'] : [])]
      }
    };
  });
  await firestoreRequest(`${databaseRoot}/documents:commit`, {
    method: 'POST',
    body: JSON.stringify({ writes })
  });
}

const verificationDocuments = await fetchPersonnelDocuments();
const remaining = verificationDocuments.filter(document => {
  const belongsToTenant = (getStringField(document, 'tenantId') || getPayloadStringField(document, 'tenantId')) === tenantId;
  const hasPayload = Boolean(document.fields?.payload?.mapValue);
  return belongsToTenant && (
    getStringField(document, 'grupo') !== 'AMBOS'
    || (hasPayload && getPayloadStringField(document, 'grupo') !== 'AMBOS')
  );
});

if (remaining.length > 0) {
  throw new Error(`Verification failed: ${remaining.length} tenant personnel documents are not fully set to AMBOS.`);
}

console.log(`Updated ${affectedDocuments.length} personnel documents to AMBOS.`);
console.log('Verification passed: all tenant personnel documents are available to both groups.');
