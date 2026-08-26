const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const outExcelPath = path.join(__dirname, '../Tabla_4Columnas_Area_Sector_Equipo_Sububicaciones_Zaldivar.xlsx');

const col1 = '1. Área de Planta (Nivel 1)';
const col2 = '2. Sector / Proceso Principal (Nivel 2)';
const col3 = '3. Equipo / Correa / Sistema (Nivel 3)';
const col4 = '4. Sub-Sectores, Traspasos & Componentes A Intervenir (Nivel 4)';

// Standard belt components
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

// Rich text data tree provided by the user
const promptData = [
  // 1. ÁREA SECA
  // Chancery Primario
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'Apron Feeder', subs: ['Tolva de Alimentación Apron Feeder', 'Aseo de Estructura y Chasis Apron Feeder', 'Piso Chumacera / Foso'] },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-03', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-04', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-05', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-06', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-07', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-08', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-105', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'CT-106', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'Alimentador 5A', subs: ['Mesa de Impacto', 'Chute de Vaciado', 'Sistema Motriz'] },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'Alimentador 5B', subs: ['Mesa de Impacto', 'Chute de Vaciado', 'Sistema Motriz'] },
  { area: 'Área Seca', sector: 'Chancado Primario', equipo: 'Traspasos & Chutes Primarios', subs: [
    'Traspaso CT-03/04', 'Traspaso CT-06/07', 'Traspaso CT-07/08',
    'Chute By-Pass', 'Chute Pantalón', 'Chute Alimentación Harneros 13-14 / CT-105',
    'Chute Descarga CT-05', 'Chute Descarga Harneros 13-14 / CT-106',
    'Chute Descarga CT-106/07', 'Chute Descarga CT-08 / Domo',
    'Tolvas de Alimentación Chancery Secundarios'
  ]},

  // Chancado Terciario
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'Alimentadores Línea 14 y 15', subs: ['Alimentador Línea 14', 'Alimentador Línea 15A', 'CT-16', 'CT-17', 'CT-18', 'CT-19'] },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-14A', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-15A', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-14B', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-15B', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-16', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-17', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-18', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-19', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-20', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-21', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-22', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-23', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-26', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-27', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-40', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-41', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-42', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'CT-43', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'Harneros Terciarios & Correas', subs: ['Harnero 188', 'Harnero 223', 'Harnero 1A', 'Harnero 1B', 'Harnero 2A', 'Harnero 2B', 'Correas de Harneros 1A/1B/2A/2B'] },
  { area: 'Área Seca', sector: 'Chancador Terciario', equipo: 'Traspasos & Chutes Terciarios', subs: [
    'Traspaso CT-14A / Harnero 188', 'Traspaso CT-15A / Harnero 223',
    'Traspaso Harnero 188 / CT-40', 'Traspaso Harnero 223 / CT-40',
    'Traspaso Harnero 188 / 14B', 'Traspaso Harnero 223 / 15B',
    'CT-14B y CT-15B hacia Chute Pantalón', 'Traspaso CT-23 / 15B',
    'CT-42 / Chute Pantalón Chancadores HP', 'Descarga HP-5001 / CT-43',
    'Descarga HP-6001 / CT-43', 'Traspaso CT-40 / 41', 'Traspaso CT-43 / 41',
    'Traspaso CT-41 / 26', 'Traspaso CT-26 / 27', 'Traspaso CT-27 / 32',
    'Traspaso CT-27 / 30', 'Traspaso CT-20 / 22', 'Traspaso CT-21 / 23',
    'Traspaso CT-22 / 42', 'Traspaso CT-22 / 14B', 'Traspaso CT-23 / 42'
  ]},

  // Apilado
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-30', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-31', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-31A', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-31B', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-32', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-34', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-35', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-200', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-201', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Apilado', equipo: 'CT-202', subs: stdBeltComponents },

  // Remanejo
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'Rotopala', subs: ['Disco Rotopala', 'Estructura Principal Rotopala', 'Pasillos de Inspección', 'Chasis y Orugas'] },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-135', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-136', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-137', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-138', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-139', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-140', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-141', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-143', subs: stdBeltComponents },
  { area: 'Área Seca', sector: 'Remanejo', equipo: 'CT-144', subs: stdBeltComponents },

  // Planta Concentradora & Relaves
  { area: 'Área Seca', sector: 'Planta Concentradora & Relaves', equipo: 'Espesadores & Bombas', subs: [
    'Espesador de Fino', 'Espesador de Concentrado', 'Espesador de Colas',
    'Cuadro de Válvulas Concentradora', 'Sistema Spigot Tranque Relaves', 'Bomba Warman'
  ]},

  // Planta de Salmuera
  { area: 'Área Seca', sector: 'Planta de Salmuera', equipo: 'Stacker & Harnero Salmuera', subs: [
    'Correa Stacker de la Sal', 'Correa Descarga de Harnero Salmuera', 'Bombas de Salmuera', 'Pretiles Salmuera'
  ]},

  // 2. ÁREA HÚMEDA (LIX-SX-EW-RO)
  // Lixiviación
  { area: 'Área Húmeda (LIX-SX-EW-RO)', sector: 'Lixiviación (LIX)', equipo: 'Pilas HL & Trincheras', subs: [
    'Trincheras de Alimentación Pila HL', 'Correa CT-137 Lixiviación', 'Emergencias Operacionales LIX',
    'Piscinas de Proceso PLS / ILS', 'Caminos Operacionales LIX', 'Sifón SX',
    'Caminos Periféricos CT-32 y CT-34', 'Perímetros Pilas de Lixiviación (HL)',
    'Áreas Periféricas DL y RAL'
  ]},

  // SX (Extracción por Solventes)
  { area: 'Área Húmeda (LIX-SX-EW-RO)', sector: 'Extracción por Solventes (SX)', equipo: 'Planta SX & Trenes', subs: [
    'Zona de Estanques e Intercambiadores de Calor (A/A, A/E, E/E)',
    'Sumideros en Zona de Estanques SX', 'Trincheras de la Planta SX',
    'Área Periférica de Filtros Multilecho', 'Área de Tratamiento de Orgánico',
    'Perímetros Tren A de SX', 'Perímetros Tren B de SX', 'Perímetros Tren C de SX', 'Perímetros Tren D de SX'
  ]},

  // EW (Electrowinning)
  { area: 'Área Húmeda (LIX-SX-EW-RO)', sector: 'Electrowinning (EW)', equipo: 'Naves EW & Maquinaria', subs: [
    'Máquina Despegadora de Cátodos N° 1', 'Máquina Despegadora de Cátodos N° 2',
    'Planta Baja Nave A EW', 'Planta Baja Nave B EW', 'Planta Baja Nave C EW', 'Planta Baja Nave D EW',
    'Puente Grúa Nave A', 'Puente Grúa Nave B', 'Puente Grúa Nave C', 'Puente Grúa Nave D', 'Puente Grúa Kones',
    'Nave Exterior (Oficinas y Bodega Almacenamiento Transitorio)', 'Pasillos Interiores EW'
  ]},

  // Patio de Embarque
  { area: 'Área Húmeda (LIX-SX-EW-RO)', sector: 'Patio de Embarque', equipo: 'Patio & Romana', subs: [
    'Sector Patio de Embarque y Romana', 'Patio Lateral de la Nave',
    'Sector Almacenamiento Borras Plomadas', 'Cercos Perimetrales Patio de Embarque'
  ]},

  // Planta de Ósmosis
  { area: 'Área Húmeda (LIX-SX-EW-RO)', sector: 'Planta de Ósmosis (RO)', equipo: 'Ósmosis Industrial', subs: [
    'Área General Planta de Ósmosis Industrial', 'Filtros Multimedia RO', 'Bastidores de Membranas RO'
  ]},

  // Descarga Ácido Sulfúrico
  { area: 'Área Húmeda (LIX-SX-EW-RO)', sector: 'Descarga de Ácido Sulfúrico', equipo: 'Estanques TK & Canaletas Ácido', subs: [
    'Perímetros Internos y Externos Estanque TK1', 'Perímetros Internos y Externos Estanque TK2',
    'Perímetros Internos y Externos Estanque TK3', 'Perímetros Internos y Externos Estanque TK6',
    'Piscinas de Contención Estanques TK', 'Limpieza Canaletas Líneas de Ácido',
    'Remanentes de Ácido', 'Atención Emergencias Roturas en Líneas de Ácido'
  ]},

  // 3. SECTORES COMPLEMENTARIOS
  { area: 'Sectores Complementarios', sector: 'Talleres Faena', equipo: 'Talleres Mantenimiento', subs: [
    'Taller Mantenimiento Mecánico', 'Taller Mantenimiento Eléctrico', 'Pañol de Herramientas'
  ]},
  { area: 'Sectores Complementarios', sector: 'Calzadas & Estacionamiento', equipo: 'Infraestructura Vial', subs: [
    'Calzadas Principales Faena', 'Estacionamiento Gerencia Planta'
  ]}
];

const rows = [];
const seen = new Set();

promptData.forEach(item => {
  item.subs.forEach(sub => {
    const key = `${item.area}||${item.sector}||${item.equipo}||${sub}`;
    if (!seen.has(key)) {
      seen.add(key);
      rows.push({
        [col1]: item.area,
        [col2]: item.sector,
        [col3]: item.equipo,
        [col4]: sub
      });
    }
  });
});

// Sort rows logically by Area -> Sector -> Equipo -> Sub
rows.sort((a, b) => {
  const c1 = a[col1].localeCompare(b[col1]);
  if (c1 !== 0) return c1;
  const c2 = a[col2].localeCompare(b[col2]);
  if (c2 !== 0) return c2;
  const c3 = a[col3].localeCompare(b[col3]);
  if (c3 !== 0) return c3;
  return a[col4].localeCompare(b[col4]);
});

const totalCount = rows.length;

// Summary row
rows.push({
  [col1]: 'TOTAL REGISTROS INTEGRADOS',
  [col2]: 'Consolidado Zaldívar (Área Seca + Área Húmeda LIX-SX-EW-RO)',
  [col3]: 'Planta Completa Zaldívar',
  [col4]: `${totalCount} Sububicaciones, Traspasos y Componentes`
});

const newWb = xlsx.utils.book_new();
const newWs = xlsx.utils.json_to_sheet(rows);
xlsx.utils.book_append_sheet(newWb, newWs, 'Master_Zaldivar_4Niveles');
xlsx.writeFile(newWb, outExcelPath);

console.log('--- EXCEL DE 4 COLUMNAS CREADO EXITOSAMENTE ---');
console.log('Total registros integrados:', totalCount);
console.log('Ruta del archivo:', outExcelPath);
