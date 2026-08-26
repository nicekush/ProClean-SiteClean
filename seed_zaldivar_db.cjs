const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const masterExcelPath = path.join(__dirname, '../Tabla_4Columnas_Area_Sector_Equipo_Sububicaciones_Zaldivar.xlsx');
const dbPath = path.join(__dirname, 'data/db.json');

const wb = xlsx.readFile(masterExcelPath);
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const col1 = '1. Área de Planta (Nivel 1)';
const col2 = '2. Sector / Proceso Principal (Nivel 2)';
const col3 = '3. Equipo / Correa / Sistema (Nivel 3)';
const col4 = '4. Sub-Sectores, Traspasos & Componentes A Intervenir (Nivel 4)';

const areasMap = new Map();
const sectorsMap = new Map();
const equipmentsMap = new Map();
const subSectorsList = [];

let areaCounter = 1;
let sectorCounter = 1;
let equipCounter = 1;
let subCounter = 1;

rows.forEach(r => {
  const aName = (r[col1] || '').toString().trim();
  const sName = (r[col2] || '').toString().trim();
  const eName = (r[col3] || '').toString().trim();
  const subName = (r[col4] || '').toString().trim();

  if (!aName || aName.includes('TOTAL')) return;

  // 1. Plant Area
  if (!areasMap.has(aName)) {
    const code = aName.substring(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, '');
    areasMap.set(aName, {
      id: `pa_${areaCounter++}`,
      name: aName,
      code: code
    });
  }
  const areaObj = areasMap.get(aName);

  // 2. Sector
  const sectorKey = aName + '||' + sName;
  if (!sectorsMap.has(sectorKey)) {
    const code = sName.substring(0, 8).toUpperCase().replace(/[^A-Z0-9]/g, '');
    sectorsMap.set(sectorKey, {
      id: `sec_${sectorCounter++}`,
      areaId: areaObj.id,
      areaName: areaObj.name,
      name: sName,
      code: code
    });
  }
  const sectorObj = sectorsMap.get(sectorKey);

  // 3. Equipment
  const equipKey = sectorKey + '||' + eName;
  if (!equipmentsMap.has(equipKey)) {
    const code = eName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
    equipmentsMap.set(equipKey, {
      id: `eq_${equipCounter++}`,
      sectorId: sectorObj.id,
      sectorName: sectorObj.name,
      name: eName,
      code: code
    });
  }
  const equipObj = equipmentsMap.get(equipKey);

  // 4. SubSector
  const subCode = subName.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '');
  subSectorsList.push({
    id: `sub_${subCounter++}`,
    sectorId: sectorObj.id,
    sectorName: sectorObj.name,
    equipmentId: equipObj.id,
    equipmentName: equipObj.name,
    name: subName,
    code: subCode
  });
});

const plantAreas = Array.from(areasMap.values());
const sectors = Array.from(sectorsMap.values());
const equipments = Array.from(equipmentsMap.values());

// Read current db.json
let currentDb = {};
if (fs.existsSync(dbPath)) {
  try {
    currentDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (e) {}
}

currentDb.plantAreas = plantAreas;
currentDb.sectors = sectors;
currentDb.equipments = equipments;
currentDb.subSectors = subSectorsList;

fs.writeFileSync(dbPath, JSON.stringify(currentDb, null, 2), 'utf8');

console.log('--- BASE DE DATOS SEMILLA ZALDIVAR CARGADA EXITOSAMENTE ---');
console.log('Áreas (Nivel 1):', plantAreas.length);
console.log('Sectores (Nivel 2):', sectors.length);
console.log('Equipos (Nivel 3):', equipments.length);
console.log('Sub-Sectores / Componentes (Nivel 4):', subSectorsList.length);
