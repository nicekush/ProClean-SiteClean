import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const projectId = process.env.FIREBASE_PROJECT_ID || 'proclean-siteclean';
const projectNumber = process.env.FIREBASE_PROJECT_NUMBER || '345091105482';
const credential = firebaseCliCredential();
const { access_token: accessToken } = await credential.getAccessToken();

async function readJson(label, url) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.log(`${label}: unavailable (${response.status} ${body?.error?.status || ''})`);
    if (body?.error?.message) console.log(`  ${body.error.message}`);
    return null;
  }
  return body;
}

const billing = await readJson(
  'Billing information',
  `https://cloudbilling.googleapis.com/v1/projects/${projectId}/billingInfo`
);
if (billing) {
  console.log(`Billing enabled: ${billing.billingEnabled === true ? 'YES' : 'NO'}`);
  console.log(`Billing account linked: ${billing.billingAccountName ? 'YES' : 'NO'}`);
}

const service = await readJson(
  'Firestore API',
  `https://serviceusage.googleapis.com/v1/projects/${projectNumber}/services/firestore.googleapis.com`
);
if (service) console.log(`Firestore API state: ${service.state || 'UNKNOWN'}`);

const quota = await readJson(
  'Firestore quota metrics',
  `https://serviceusage.googleapis.com/v1beta1/projects/${projectNumber}/services/firestore.googleapis.com/consumerQuotaMetrics?view=FULL&pageSize=200`
);
if (quota) {
  const relevant = (quota.metrics || []).filter(metric => {
    const text = `${metric.metric || ''} ${metric.displayName || ''}`.toLowerCase();
    return ['read', 'write', 'delete'].some(keyword => text.includes(keyword));
  });
  console.log(`Relevant Firestore quota metrics: ${relevant.length}`);
  for (const metric of relevant) {
    console.log(`- ${metric.displayName || metric.metric}`);
    for (const limit of metric.consumerQuotaLimits || []) {
      for (const bucket of limit.quotaBuckets || []) {
        console.log(`  limit=${bucket.effectiveLimit ?? bucket.defaultLimit ?? 'unknown'} dimensions=${JSON.stringify(bucket.dimensions || {})}`);
      }
    }
  }
}

