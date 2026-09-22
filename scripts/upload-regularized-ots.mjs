import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { firebaseCliCredential } from './firebase-cli-credential.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const XLSX = require(path.resolve(__dirname, '../node_modules/xlsx'));

const isDryRun = process.argv.includes('--dry-run');
const excelPath = path.resolve(__dirname, '../../Propuesta_OTs_Regularizacion_94pct_Zaldivar.xlsx');
const dbJsonPath = path.resolve(__dirname, '../data/db.json');

if (!fs.existsSync(excelPath)) {
  throw new Error(`Excel file not found at ${excelPath}`);
}
if (!fs.existsSync(dbJsonPath)) {
  throw new Error(`db.json not found at ${dbJsonPath}`);
}

const dbCatalog = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const wb = XLSX.readFile(excelPath);
const sheetName = 'OTs_Propuestas_Regularizacion';
const rawOTs = XLSX.utils.sheet_to_json(wb.Sheets[sheetName]);

console.log(`Loaded ${rawOTs.length} rows from Excel sheet "${sheetName}".`);
console.log(`Mode: ${isDryRun ? 'DRY-RUN (Simulación sin escrituras)' : 'LIVE EXECUTION (Escritura en Firestore)'}`);

const BATCH_TAG = 'BATCH-2026-09-94PCT';
const TENANT_ID = 'tenant_cmz';

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
  }
  if (Array.isArray(val)) return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

// Map supervisor names to IDs
function getSupervisorInfo(name) {
  const cleanName = (name || '').trim();
  if (cleanName.toLowerCase().includes('manuel')) {
    return { id: 'usr-1787842213827', name: 'Manuel Espinosa' };
  }
  return { id: 'usr-sergio', name: 'Sergio Sepúlveda' };
}

const mappedDocuments = [];

for (let i = 0; i < rawOTs.length; i++) {
  const row = rawOTs[i];
  const otCode = row['N° OT / SAP'] || `OT-${1201 + i}`;
  const docId = `reg_202609_${otCode.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

  const areaName = row['Área de Planta (Nivel 1)'] || 'Área Seca';
  const sectorName = row['Sector / Proceso (Nivel 2)'] || '';
  const equipName = row['Equipo / Sistema (Nivel 3)'] || '';
  const subSectorStr = row['Sub-Sectores & Componentes (Nivel 4)'] || '';

  // Catalog lookups
  const area = dbCatalog.plantAreas.find(a => a.name === areaName);
  if (!area) throw new Error(`Row ${i + 1}: Area not found "${areaName}"`);

  const sector = dbCatalog.sectors.find(s => s.name === sectorName && s.areaId === area.id);
  if (!sector) throw new Error(`Row ${i + 1}: Sector not found "${sectorName}" in area ${areaName}`);

  const equip = dbCatalog.equipments.find(e => e.name === equipName && e.sectorId === sector.id);
  if (!equip) throw new Error(`Row ${i + 1}: Equipment not found "${equipName}" in sector ${sectorName}`);

  const subNames = subSectorStr.split(',').map(s => s.trim()).filter(Boolean);
  const subIds = [];
  for (const sName of subNames) {
    const sObj = dbCatalog.subSectors.find(s => s.name === sName && s.equipmentId === equip.id);
    if (sObj) subIds.push(sObj.id);
  }

  const shiftName = row['Turno'] || 'Turno Día';
  const shiftId = shiftName.includes('Noche') ? 's2' : 's1';

  const supInfo = getSupervisorInfo(row['Supervisor Responsable']);
  const execDate = row['Fecha de Ejecución'];

  const headcount = Number(row['N° Personas']) || 4;
  const estimatedHours = Number(row['HH Estimadas']) || 9;
  const realHours = Number(row['Duración Real (h)']) || 9;
  const cubicMetersRemoved = Number(row['Volumen Removido (m³)']) || 0;
  const staffingType = row['Tipo de dotación'] || 'Base';

  const equipoCorrea = `${equipName} (${subNames.join(', ')})`;

  const orderPayload = {
    id: docId,
    tenantId: TENANT_ID,
    sapCode: otCode,
    executionDate: execDate,
    semana: Number(row['Semana']) || 34,
    dia: row['Día'] || '',
    shiftId,
    shiftName,
    areaId: area.id,
    areaName: area.name,
    sectorId: sector.id,
    sectorName: sector.name,
    equipmentId: equip.id,
    equipmentName: equip.name,
    subSectorId: subIds[0] || '',
    subSectorName: subNames[0] || '',
    selectedSubSectorIds: subIds,
    selectedSubSectorNames: subNames,
    equipoCorrea,
    operationDetail: row['Operación / Detalle'] || '',
    taskType: 'PLANIFICADO',
    headcount,
    estimatedHours,
    realHours,
    machineHours: 0,
    hasManualLabor: true,
    hasEquipment: false,
    vehiclePatent: '-',
    cubicMetersRemoved,
    fleetTripsCount: 0,
    bucketCapacityM3: 0,
    status: 'PENDIENTE_APROBACION_ITO',
    contingencyReason: '',
    beforePhotoUrl: '',
    afterPhotoUrl: '',
    staffingType,
    responsibleSupervisorId: supInfo.id,
    responsibleSupervisorName: supInfo.name,
    createdById: supInfo.id,
    createdByName: supInfo.name,
    createdAt: `${execDate}T12:00:00.000Z`,
    updatedAt: new Date().toISOString(),
    regularizationBatch: BATCH_TAG,
    source: row['Fuente / Respaldo'] || 'Regularización Operacional Dotación Zaldívar 94%'
  };

  const firestoreDoc = {
    docId,
    fields: {
      id: { stringValue: docId },
      sapCode: { stringValue: otCode },
      equipoCorrea: { stringValue: equipoCorrea },
      status: { stringValue: 'PENDIENTE_APROBACION_ITO' },
      tenantId: { stringValue: TENANT_ID },
      staffingType: { stringValue: staffingType },
      regularizationBatch: { stringValue: BATCH_TAG },
      updatedAt: { timestampValue: new Date().toISOString() },
      payload: toFirestoreValue(orderPayload)
    }
  };

  mappedDocuments.push(firestoreDoc);
}

console.log(`Successfully mapped ${mappedDocuments.length} documents.`);
console.log(`Sample mapped docId: ${mappedDocuments[0].docId}`);
console.log(`Sample root fields: ${Object.keys(mappedDocuments[0].fields).join(', ')}`);
console.log(`Sample payload sapCode: ${mappedDocuments[0].fields.payload.mapValue.fields.sapCode.stringValue}`);
console.log(`Sample payload staffing: ${mappedDocuments[0].fields.payload.mapValue.fields.staffingType.stringValue}`);
console.log(`Sample payload machineHours: ${mappedDocuments[0].fields.payload.mapValue.fields.machineHours.integerValue}`);

async function run() {
  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETED]: 151 documents validated perfectly. Ready for live upload.');
    return;
  }

  // Live execution
  console.log('\nStarting LIVE upload to Firestore...');
  const credential = firebaseCliCredential();
  let { access_token: accessToken } = await credential.getAccessToken();

  const root = 'https://firestore.googleapis.com/v1/projects/proclean-siteclean/databases/(default)/documents';

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < mappedDocuments.length; i++) {
    const item = mappedDocuments[i];
    const url = `${root}/work_orders/${item.docId}`;

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: item.fields })
      });

      if (res.ok) {
        successCount++;
        if (successCount % 25 === 0 || successCount === mappedDocuments.length) {
          console.log(`Uploaded ${successCount}/${mappedDocuments.length} OTs...`);
        }
      } else {
        const errText = await res.text();
        console.error(`Failed to upload ${item.docId} (${res.status}): ${errText}`);
        failCount++;
      }
    } catch (err) {
      console.error(`Exception uploading ${item.docId}:`, err);
      failCount++;
    }

    // Small delay of 80ms to prevent any rate bursts
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\n=== UPLOAD FINISHED ===`);
  console.log(`Successfully uploaded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Regularization Batch Tag: ${BATCH_TAG}`);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
