import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  getAccessToken,
  getGlobalDefaultAccount
} = require('firebase-tools/lib/auth');

export function firebaseCliCredential() {
  const account = getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error('Firebase CLI is not authenticated. Run firebase login first.');
  }

  return {
    async getAccessToken() {
      const tokens = await getAccessToken(account.tokens.refresh_token, []);
      if (!tokens?.access_token) {
        throw new Error('Firebase CLI did not return an access token.');
      }
      return {
        access_token: tokens.access_token,
        expires_in: Number(tokens.expires_in) || 3600
      };
    }
  };
}

// firebase-admin only accepts its own credential classes for Firestore. Use
// the CLI session with the Cloud SDK directly, keeping its auth-library version
// aligned with google-gax (older copies return an incompatible headers object).
export async function firebaseCliFirestore(projectId) {
  const { Firestore } = await import('@google-cloud/firestore');
  const gaxRequire = createRequire(require.resolve('google-gax'));
  const { OAuth2Client } = gaxRequire('google-auth-library');
  const client = new OAuth2Client();
  client.refreshHandler = async () => {
    const token = await firebaseCliCredential().getAccessToken();
    return { access_token: token.access_token, expiry_date: Date.now() + token.expires_in * 1000 };
  };
  const token = await firebaseCliCredential().getAccessToken();
  client.setCredentials({ access_token: token.access_token, expiry_date: Date.now() + token.expires_in * 1000 });
  return new Firestore({ projectId, authClient: client });
}

