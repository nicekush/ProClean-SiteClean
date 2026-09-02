import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const removeLegacyUsers = args.has('--remove-legacy-users');
const sanitizeLegacyUsers = args.has('--sanitize-legacy-users');
const useFirebaseCliCredentials = args.has('--use-firebase-cli-credentials');
const projectId = process.env.FIREBASE_PROJECT_ID || 'proclean-siteclean';
const confirmation = process.argv
  .find(argument => argument.startsWith('--confirm-project='))
  ?.split('=')[1];
const defaultTenantId = process.env.DEFAULT_TENANT_ID || 'tenant_cmz';

const sourceDb = JSON.parse(
  await readFile(new URL('../data/db.json', import.meta.url), 'utf8')
);
const sourceUsers = Array.isArray(sourceDb.users) ? sourceDb.users : [];

const collectionsToStamp = [
  'work_orders',
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

const validUsers = sourceUsers.filter(user => {
  return typeof user.email === 'string'
    && user.email.includes('@');
});
const usersRequiringPasswordReset = validUsers.filter(user => {
  return typeof user.password !== 'string' || user.password.length < 6;
});

console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
console.log(`Target project: ${projectId}`);
console.log(`Default tenant: ${defaultTenantId}`);
console.log(`Source accounts: ${sourceUsers.length}`);
console.log(`Accounts eligible for migration: ${validUsers.length}`);
console.log(`Accounts with invalid email requiring correction: ${sourceUsers.length - validUsers.length}`);
console.log(`Accounts requiring password reset: ${usersRequiringPasswordReset.length}`);
console.log(`Collections scheduled for tenant stamping: ${collectionsToStamp.length}`);
console.log(`Remove legacy user documents: ${removeLegacyUsers ? 'YES' : 'NO'}`);
console.log(`Sanitize legacy user passwords: ${sanitizeLegacyUsers ? 'YES' : 'NO'}`);
console.log(`Credential source: ${useFirebaseCliCredentials ? 'Firebase CLI session' : 'Application Default Credentials'}`);

if (!apply) {
  console.log('Dry run complete. No Firebase connection was opened and no data was changed.');
  console.log(`To apply: npm run migrate:auth -- --apply --confirm-project=${projectId}`);
  process.exit(0);
}

if (confirmation !== projectId) {
  throw new Error(`Refusing to write. Pass --confirm-project=${projectId} exactly.`);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !useFirebaseCliCredentials) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to an authorized service-account JSON file.');
}

if (getApps().length === 0) {
  initializeApp({
    credential: useFirebaseCliCredentials ? firebaseCliCredential() : applicationDefault(),
    projectId
  });
}

const auth = getAuth();
const firestore = getFirestore();
const migratedAccounts = [];

for (const sourceUser of validUsers) {
  let firebaseUser;
  try {
    firebaseUser = await auth.getUserByEmail(sourceUser.email.trim().toLowerCase());
    await auth.updateUser(firebaseUser.uid, {
      displayName: sourceUser.name,
      disabled: sourceUser.active === false
    });
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error;
    firebaseUser = await auth.createUser({
      email: sourceUser.email.trim().toLowerCase(),
      password: typeof sourceUser.password === 'string' && sourceUser.password.length >= 6
        ? sourceUser.password
        : randomBytes(24).toString('base64url'),
      displayName: sourceUser.name,
      disabled: sourceUser.active === false
    });
  }

  const safeProfile = {
    name: sourceUser.name,
    email: sourceUser.email.trim().toLowerCase(),
    role: sourceUser.role,
    tenantId: sourceUser.tenantId || defaultTenantId,
    contractId: sourceUser.contractId || null,
    active: sourceUser.active !== false,
    avatarColor: sourceUser.avatarColor || null,
    legacyId: sourceUser.id || null,
    migratedAt: new Date().toISOString(),
    needsPasswordReset: typeof sourceUser.password !== 'string' || sourceUser.password.length < 6
  };

  await firestore.collection('users').doc(firebaseUser.uid).set(safeProfile, { merge: true });
  migratedAccounts.push({
    uid: firebaseUser.uid,
    email: safeProfile.email,
    legacyId: sourceUser.id
  });
}

for (const collectionName of collectionsToStamp) {
  const snapshot = await firestore.collection(collectionName).get();
  let batch = firestore.batch();
  let operationCount = 0;

  for (const documentSnapshot of snapshot.docs) {
    const data = documentSnapshot.data();
    const tenantId = data.tenantId || data.payload?.tenantId || defaultTenantId;
    const update = { tenantId };
    if (data.payload && typeof data.payload === 'object') {
      update.payload = { ...data.payload, tenantId };
    }
    batch.set(documentSnapshot.ref, update, { merge: true });
    operationCount += 1;

    if (operationCount === 400) {
      await batch.commit();
      batch = firestore.batch();
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();
  console.log(`Stamped ${snapshot.size} documents in ${collectionName}.`);
}

if (sanitizeLegacyUsers || removeLegacyUsers) {
  for (const account of migratedAccounts) {
    const legacyDocs = await firestore
      .collection('users')
      .where('email', '==', account.email)
      .get();

    for (const legacyDoc of legacyDocs.docs) {
      if (legacyDoc.id === account.uid) continue;
      if (removeLegacyUsers) {
        await legacyDoc.ref.delete();
      } else if (sanitizeLegacyUsers) {
        await legacyDoc.ref.update({ password: FieldValue.delete() });
      }
    }
  }
}

console.log(`Migrated ${migratedAccounts.length} Firebase Authentication accounts.`);
console.log('Migration finished. Keep VITE_FIREBASE_AUTH_REQUIRED disabled until rules tests and Preview QA pass.');
