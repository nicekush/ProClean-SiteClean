const xlsx = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, '../Tabla_3Columnas_Area_Sector_Sububicaciones.xlsx');
const wb = xlsx.readFile(excelPath);
const existingData = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

const col1 = '1. Área de Planta (Nivel 1)';
const col2 = '2. Sector / Equipo Principal (Nivel 2)';
const col3 = '3. Sub-Sectores / Componentes A Intervenir (Nivel 3)';

// Standard belt components template
const stdBeltComponents = [
  'Polea de Cola',
  'Pasillo Lateral Izquierdo',
  'Pasillo Lateral Derecho',
  'Chute de Traspaso / Vaciado',
  'Chute de Alimentación',
  'Polines de Carga',
  'Mesa de Impacto',
  'Polines de Retorno',
  'Carro Tensor',
  'Sistema Motriz / Reductor',
  'Polea Motriz / Cabezal',
  'Plataforma de Rejilla (Grating)',
  'Piso Chumacera',
  'Techo Chino / Protecciones',
  'Rascador V-Plow / Rascador Primario'
];

// Belt maps from Zaldívar HTML panel
const processBelts = {
  'Área Seca': {
    'Chancado Primario': ['CT-1', 'CT-3', 'CT-4', 'CT-5', 'CT-5A', 'CT-5B', 'CT-6', 'CT-7', 'CT-8', 'CT-105', 'CT-106', 'Harnero H013', 'Harnero H014'],
    'Chancador Terciario': ['CT-14A', 'CT-14B', 'CT-15A', 'CT-15B', 'CT-16', 'CT-17', 'CT-18', 'CT-19', 'CT-20', 'CT-21', 'CT-22', 'CT-23', 'CT-26', 'CT-27', 'CT-40', 'CT-41', 'CT-42', 'CT-43', 'Domo Stock Pile', 'Chute Pantalón Izquierdo', 'Chute Pantalón Derecho'],
    'Apilado': ['CT-30', 'CT-31', 'CT-31A', 'CT-31B', 'CT-32', 'CT-34', 'CT-35', 'CT-201', 'CT-202', 'Stock de Emergencia', 'Tripper Sennet'],
    'Remanejo': ['CT-135', 'CT-136', 'CT-137', 'CT-138', 'CT-139', 'CT-140', 'CT-143', 'CT-144', 'Rotopala MRCH', 'MOH', 'Tripper CT-138']
  }
};

const rows = [];
const seen = new Set();

// 1. Add existing clean rows from Excel
existingData.forEach(r => {
  const c1 = (r[col1] || '').toString().trim();
  const c2 = (r[col2] || '').toString().trim();
  const c3 = (r[col3] || '').toString().trim();

  if (!c1 || c1.includes('TOTAL')) return;

  const key = c1 + '||' + c2 + '||' + c3;
  if (!seen.has(key)) {
    seen.add(key);
    rows.push({
      [col1]: c1,
      [col2]: c2,
      [col3]: c3
    });
  }
});

// 2. Add belts from Zaldívar panel
Object.entries(processBelts).forEach(([area, sectors]) => {
  Object.entries(sectors).forEach(([sectorGroup, belts]) => {
    belts.forEach(belt => {
      // If it is a belt (CT-XX), generate standard components
      if (belt.startsWith('CT-')) {
        stdBeltComponents.forEach(comp => {
          const key = area + '||' + belt + '||' + comp;
          if (!seen.has(key)) {
            seen.add(key);
            rows.push({
              [col1]: area,
              [col2]: belt,
              [col3]: comp
            });
          }
        });
      } else {
        const key = area + '||' + sectorGroup + '||' + belt;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push({
            [col1]: area,
            [col2]: sectorGroup,
            [col3]: belt
          });
        }
      }
    });
  });
});

// Sort rows logically by Area -> Sector -> SubSector
rows.sort((a, b) => {
  const areaCmp = a[col1].localeCompare(b[col1]);
  if (areaCmp !== 0) return areaCmp;
  const secCmp = a[col2].localeCompare(b[col2]);
  if (secCmp !== 0) return secCmp;
  return a[col3].localeCompare(b[col3]);
});

const totalCount = rows.length;

// Add summary row at the bottom
rows.push({
  [col1]: 'TOTAL SUBUBICACIONES REGISTRADAS',
  [col2]: 'Consolidado Zaldívar (Planta Completa)',
  [col3]: totalCount + ' Sububicaciones y Componentes'
});

const newWb = xlsx.utils.book_new();
const newWs = xlsx.utils.json_to_sheet(rows);
xlsx.utils.book_append_sheet(newWb, newWs, 'Ubicaciones_Zaldivar');
const outExcelPath = path.join(__dirname, '../Tabla_3Columnas_Area_Sector_Sububicaciones_Consolidado.xlsx');
xlsx.writeFile(newWb, outExcelPath);

console.log('--- ACTUALIZACION EXITOSA DE EXCEL ---');
console.log('Total registros actualizados:', totalCount);
console.log('Archivo guardado en:', outExcelPath);
