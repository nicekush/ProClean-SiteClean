import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

async function main() {
  const { access_token } = await firebaseCliCredential().getAccessToken();

  console.log('1. Creating new ruleset...');
  const createRes = await fetch('https://firebaserules.googleapis.com/v1/projects/proclean-siteclean/rulesets', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source: {
        files: [{ name: 'firestore.rules', content: rules }]
      }
    })
  });

  const createData = await createRes.json();
  if (!createRes.ok) {
    console.error('Failed to create ruleset:', createData);
    process.exit(1);
  }

  console.log('Created ruleset:', createData.name);

  console.log('2. Releasing ruleset to cloud.firestore...');
  const releaseRes = await fetch('https://firebaserules.googleapis.com/v1/projects/proclean-siteclean/releases/cloud.firestore', {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + access_token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      release: {
        name: 'projects/proclean-siteclean/releases/cloud.firestore',
        rulesetName: createData.name
      }
    })
  });

  const releaseData = await releaseRes.json();
  if (!releaseRes.ok) {
    console.error('Failed to update release:', releaseData);
    process.exit(1);
  }

  console.log('Successfully released new ruleset!');
  console.log('Release details:', releaseData);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
