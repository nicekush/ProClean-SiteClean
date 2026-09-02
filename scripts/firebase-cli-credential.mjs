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

