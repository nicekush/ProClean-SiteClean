import initialDbData from '../../data/db.json';

// Official ProCleanMG wordmark already supplied in the historical system
// configuration. Keeping it as the application fallback prevents an empty
// Firestore white-label document or stale browser cache from showing a text
// placeholder in the sidebar.
export const OFFICIAL_PROCLEAN_LOGO_URL = initialDbData.whiteLabel.companyLogoUrl;

