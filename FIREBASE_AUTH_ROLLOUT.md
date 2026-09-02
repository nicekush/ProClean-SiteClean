# Firebase Authentication and Firestore Rules rollout

This rollout is intentionally staged. Do not publish `firestore.rules` while
the production frontend still uses legacy local authentication.

## 1. Prerequisites

- Confirm the Firebase project ID is `proclean-siteclean`.
- Create a full Firestore export or another verified backup.
- Record document counts for every operational collection.
- Install a Java 21 JRE locally so the Firestore emulator can run.
- Never commit a Firebase service-account JSON file or place it under this
  repository.

Recommended: perform the complete procedure first against a separate Firebase
staging project and a Vercel Preview deployment.

## 2. Validate the source accounts without connecting to Firebase

```powershell
npm run migrate:auth
```

This is the default dry-run mode. It only reads `data/db.json`, reports account
counts and exits. It does not initialize Firebase Admin and cannot write data.

Correct accounts with invalid email before continuing. Accounts whose legacy
password is missing or shorter than six characters are created with a random,
non-disclosed password and marked `needsPasswordReset`. Those users must use
“¿Olvidaste tu contraseña?” to establish their own password.

## 3. Run the Firestore rules test suite

```powershell
npm run test:rules
```

The suite starts the official local Firestore emulator and verifies:

- unauthenticated access is denied;
- tenant isolation is mandatory in queries;
- supervisors can create OT only in their tenant;
- ITO users can update but not delete OT;
- only contract administrators manage staffing/master data;
- audit records are append-only;
- users cannot read profiles from another tenant.

All tests must pass before a rules deployment.

## 4. Prepare an administrative credential

Create or select a narrowly controlled service account that can administer
Firebase Authentication and Firestore. Store its JSON outside the repository,
then set these variables only in the administrative PowerShell session:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\firebase-admin.json'
$env:FIREBASE_PROJECT_ID = 'proclean-siteclean'
$env:DEFAULT_TENANT_ID = 'tenant_cmz'
```

Do not add this credential to Vercel. The browser application never needs an
Admin SDK credential.

## 5. Create Auth accounts and UID-keyed profiles

The first apply pass is non-destructive toward legacy user documents:

```powershell
npm run migrate:auth -- --apply --confirm-project=proclean-siteclean
```

The script:

- creates or updates Firebase Authentication email/password accounts;
- assigns a non-disclosed random password when the legacy password is invalid;
- creates `users/{firebaseUid}` profiles without passwords;
- adds `tenantId` to existing operational documents;
- preserves legacy user documents for verification;
- never prints passwords.

Verify manually in Firebase Console:

- Auth user count matches the eligible dry-run count;
- every UID has a corresponding `users/{uid}` profile;
- roles, active state, tenant and contract are correct;
- operational document counts did not change.

## 6. Sanitize legacy profiles

After verification, remove password fields from legacy Firestore user docs:

```powershell
npm run migrate:auth -- --apply --confirm-project=proclean-siteclean --sanitize-legacy-users
```

Deleting legacy user documents is a separate, explicitly destructive step:

```powershell
npm run migrate:auth -- --apply --confirm-project=proclean-siteclean --remove-legacy-users
```

Only run the deletion after a backup, count reconciliation and explicit
approval. The migration script never removes them by default.

## 7. Vercel Preview validation

Configure the Preview environment with the Firebase web variables from
`.env.example`, including:

```text
VITE_FIREBASE_AUTH_REQUIRED=true
VITE_API_BASE_URL=
```

Deploy a Preview and validate login with each role. At this point do not expose
the Preview publicly while legacy Firestore rules are still permissive.

## 8. Coordinated production cutover

Use a controlled maintenance window:

1. Confirm the Firestore backup and migration reconciliation.
2. Confirm all emulator tests pass.
3. Deploy the frontend with `VITE_FIREBASE_AUTH_REQUIRED=true`.
4. Verify Firebase Auth login on the production deployment.
5. Immediately deploy `firestore.rules`:

   ```powershell
   npx firebase-tools deploy --only firestore:rules --project proclean-siteclean
   ```

6. Test every role from separate browser sessions.
7. Force users with an old tab to reload the application.
8. Monitor permission-denied errors and pending OT writes.

Do not reverse steps 3 and 5: publishing authenticated rules before the new
frontend is active would block every legacy session.

## 9. Acceptance tests

- Create OT online on PC and observe it on a phone.
- Create OT offline, close/reopen the browser, reconnect and verify confirmation.
- Confirm only new OT creation is allowed offline.
- Save and clear staffing for the active day from an administrator account.
- Verify a supervisor cannot modify staffing.
- Verify an ITO cannot delete OT.
- Verify tenant A cannot query tenant B.
- Verify unauthenticated Firestore access is denied.
- Verify no browser request targets `localhost:3001`.
