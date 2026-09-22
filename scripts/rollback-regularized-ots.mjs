import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

const excelPath = path.resolve(__dirname, '../../Propuesta_OTs_Regularizacion_94pct_Zaldivar.xlsx');
const wb = XLSX.readFile(excelPath);
const rawOTs = XLSX.utils.sheet_to_json(wb.Sheets['OTs_Propuestas_Regularizacion']);

console.log(`Starting ROLLBACK of ${rawOTs.length} regularized OTs...`);
const credential = firebaseCliCredential();
const { access_token: accessToken } = await credential.getAccessToken();

const root = 'https://firestore.googleapis.com/v1/projects/proclean-siteclean/databases/(default)/documents';

let deletedCount = 0;
let notFoundCount = 0;

for (let i = 0; i < rawOTs.length; i++) {
  const otCode = rawOTs[i]['N° OT / SAP'] || `OT-${1201 + i}`;
  const docId = `reg_202609_${otCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const url = `${root}/work_orders/${docId}`;

  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.ok) {
      deletedCount++;
    } else if (res.status === 404) {
      notFoundCount++;
    } else {
      console.error(`Failed to delete ${docId}: ${res.status}`);
    }
  } catch (err) {
    console.error(`Error deleting ${docId}:`, err);
  }

  await new Promise(r => setTimeout(r, 50));
}

console.log(`Rollback completed: ${deletedCount} deleted, ${notFoundCount} not found.`);
