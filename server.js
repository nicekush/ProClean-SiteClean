const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Ensure data folder exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// Initial DB Seed structure
const defaultDb = {
  whiteLabel: {
    companyName: 'Gestión Operacional',
    companyLogoUrl: '',
    brandBadgeText: 'SC',
    primaryColor: '#3F3D73',
    actionColor: '#05A6A6',
    tableHeaderColor: '#025951',
    headerTitle: 'Plataforma de Gestión de Aseo Industrial y Control Operacional',
    targetAdherence: 85,
    enablePhotoEvidence: true,
    columnLabels: {
      semana: 'Semana',
      dia: 'Día',
      sapCode: 'N° OT / SAP',
      equipoCorrea: 'Equipo / Correa',
      operationDetail: 'Operación / Detalle',
      vehiclePatent: 'Patente / Vehículo',
      headcount: 'N° Personas',
      estimatedHours: 'HH Estimadas',
      realHours: 'Trabajo Real (HH)',
      status: 'Estado'
    },
    customColumns: []
  },
  contracts: [
    { id: 'c1', clientName: 'Contrato Minera CMZ', contractNumber: 'CNT-2026-CMZ', siteLocation: 'Planta Principal CMZ', active: true },
    { id: 'c2', clientName: 'Contrato Minera Escondida', contractNumber: 'CNT-2026-MEL', siteLocation: 'Chancado Primario MEL', active: false }
  ],
  shifts: [
    { id: 's1', name: 'Área Seca (Día)', code: 'TRN-DIA', startTime: '08:00', endTime: '20:00', colorHex: '#05A6A6' },
    { id: 's2', name: 'Nocheros (Noche)', code: 'TRN-NCH', startTime: '20:00', endTime: '08:00', colorHex: '#3F3D73' },
    { id: 's3', name: 'Hidrolavadora (Especializado)', code: 'TRN-HDR', startTime: '08:00', endTime: '18:00', colorHex: '#025951' }
  ],
  contingencies: [
    { id: '1', code: 'MOT-01', name: 'Interferencia Operacional Mantenimiento Mecánico', category: 'MANTENCION' },
    { id: '2', code: 'MOT-02', name: 'Detención de Planta por Bloqueo Eléctrico', category: 'OPERACIONAL' },
    { id: '3', code: 'MOT-03', name: 'Condición Climática / Alerta Polvo', category: 'CLIMA' }
  ],
  workOrders: [
    {
      id: '1',
      semana: 33,
      dia: 'Lunes 15/08',
      sapCode: 'OT-10492',
      equipoCorrea: 'Correa 002-CV-001',
      operationDetail: 'Limpieza profunda de chute de descarga y retiro de finos en pasarela',
      headcount: 4,
      estimatedHours: 8,
      realHours: 8,
      shiftId: 's1',
      shiftName: 'Área Seca (Día)',
      vehiclePatent: 'HP-9921',
      status: 'COMPLETADO'
    },
    {
      id: '2',
      semana: 33,
      dia: 'Martes 16/08',
      sapCode: 'OT-10495',
      equipoCorrea: 'Chancador Secundario CH-02',
      operationDetail: 'Lavado con hidrolavadora de alta presión en tolva de alimentación',
      headcount: 2,
      estimatedHours: 6,
      realHours: 6,
      shiftId: 's3',
      shiftName: 'Hidrolavadora (Especializado)',
      vehiclePatent: 'HJ-3382',
      status: 'COMPLETADO'
    }
  ],
  sectors: [
    { id: '1', name: 'Chancado Secundario', code: 'CH-SEC' },
    { id: '2', name: 'Correas Transportadoras', code: 'CV-LINE' }
  ],
  machines: [
    { id: '1', name: 'Camión Hidrolavador 01', patent: 'HP-9921', category: 'Hidrolavadora', status: 'DISPONIBLE' },
    { id: '2', name: 'Camión Aljibe Aseo', patent: 'HJ-3382', category: 'Camión Aljibe', status: 'DISPONIBLE' }
  ],
  workers: [
    { id: '1', name: 'Carlos Mendoza', role: 'Supervisión Terreno', shiftId: 's1', shiftName: 'Área Seca (Día)' },
    { id: '2', name: 'Juan Reyes', role: 'Operador Hidrolavadora', shiftId: 's3', shiftName: 'Hidrolavadora (Especializado)' }
  ]
};

function readDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    return defaultDb;
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return defaultDb;
  }
}

function writeDb(dbData) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'Local JSON DB File Active', port: PORT });
});

// Full DB state
app.get('/api/db', (req, res) => {
  res.json(readDb());
});

// WhiteLabel
app.get('/api/whitelabel', (req, res) => {
  const db = readDb();
  res.json(db.whiteLabel);
});

app.post('/api/whitelabel', (req, res) => {
  const db = readDb();
  db.whiteLabel = req.body;
  writeDb(db);
  res.json(db.whiteLabel);
});

// Contracts
app.get('/api/contracts', (req, res) => {
  const db = readDb();
  res.json(db.contracts);
});

app.post('/api/contracts', (req, res) => {
  const db = readDb();
  db.contracts = req.body;
  writeDb(db);
  res.json(db.contracts);
});

// Shifts
app.get('/api/shifts', (req, res) => {
  const db = readDb();
  res.json(db.shifts);
});

app.post('/api/shifts', (req, res) => {
  const db = readDb();
  db.shifts = req.body;
  writeDb(db);
  res.json(db.shifts);
});

// Contingencies
app.get('/api/contingencies', (req, res) => {
  const db = readDb();
  res.json(db.contingencies);
});

app.post('/api/contingencies', (req, res) => {
  const db = readDb();
  db.contingencies = req.body;
  writeDb(db);
  res.json(db.contingencies);
});

// Work Orders
app.get('/api/work-orders', (req, res) => {
  const db = readDb();
  res.json(db.workOrders);
});

app.post('/api/work-orders', (req, res) => {
  const db = readDb();
  db.workOrders = req.body;
  writeDb(db);
  res.json(db.workOrders);
});

// Sectors
app.get('/api/sectors', (req, res) => {
  const db = readDb();
  res.json(db.sectors);
});

app.post('/api/sectors', (req, res) => {
  const db = readDb();
  db.sectors = req.body;
  writeDb(db);
  res.json(db.sectors);
});

// Machines
app.get('/api/machines', (req, res) => {
  const db = readDb();
  res.json(db.machines);
});

app.post('/api/machines', (req, res) => {
  const db = readDb();
  db.machines = req.body;
  writeDb(db);
  res.json(db.machines);
});

// Workers
app.get('/api/workers', (req, res) => {
  const db = readDb();
  res.json(db.workers);
});

app.post('/api/workers', (req, res) => {
  const db = readDb();
  db.workers = req.body;
  writeDb(db);
  res.json(db.workers);
});

// Reset Blank Slate
app.post('/api/reset-blank-slate', (req, res) => {
  const db = readDb();
  db.workOrders = [];
  db.sectors = [];
  db.machines = [];
  db.workers = [];
  writeDb(db);
  res.json({ message: 'Database reset to Blank Slate', db });
});

app.listen(PORT, () => {
  console.log(`🚀 Site Clean Local REST Database Server running on http://localhost:${PORT}`);
  console.log(`📁 Database file: ${DB_FILE}`);
});
