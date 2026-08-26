const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

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
  users: [
    {
      id: 'usr-1',
      name: 'Carlos Mendoza',
      email: 'cmendoza@contratista.cl',
      password: '123',
      role: 'SUPERVISOR_TERRENO',
      contractId: 'c1',
      active: true,
      avatarColor: '#05A6A6'
    },
    {
      id: 'usr-2',
      name: 'Pedro Alarcón',
      email: 'palarcon@codelco.cl',
      password: '123',
      role: 'ITO_MANDANTE',
      contractId: 'c1',
      active: true,
      avatarColor: '#025951'
    },
    {
      id: 'usr-3',
      name: 'Roberto Gómez',
      email: 'rgomez@contratista.cl',
      password: '123',
      role: 'ADMINISTRADOR_CONTRATO',
      contractId: 'c1',
      active: true,
      avatarColor: '#3F3D73'
    },
    {
      id: 'usr-4',
      name: 'Admin SaaS',
      email: 'admin@siteclean.io',
      password: 'admin',
      role: 'SUPER_ADMIN',
      active: true,
      avatarColor: '#B91C1C'
    }
  ],
  contracts: [
    { id: 'c1', clientName: 'Contrato Minera CMZ', contractNumber: 'CNT-2026-CMZ', siteLocation: 'Planta Principal CMZ', active: true, contractAdminName: 'Roberto Gómez', costCenter: 'CC-9901' },
    { id: 'c2', clientName: 'Contrato Minera Escondida', contractNumber: 'CNT-2026-MEL', siteLocation: 'Chancado Primario MEL', active: false, contractAdminName: 'Loreto Silva', costCenter: 'CC-8840' }
  ],
  shifts: [
    { id: 's1', name: 'Área Seca (Día)', code: 'TRN-DIA', startTime: '08:00', endTime: '20:00', colorHex: '#05A6A6', breakHours: 1 },
    { id: 's2', name: 'Nocheros (Noche)', code: 'TRN-NCH', startTime: '20:00', endTime: '08:00', colorHex: '#3F3D73', breakHours: 1 },
    { id: 's3', name: 'Hidrolavadora (Especializado)', code: 'TRN-HDR', startTime: '08:00', endTime: '18:00', colorHex: '#025951', breakHours: 1 }
  ],
  contingencies: [
    { id: '1', code: 'MOT-01', name: 'Interferencia Operacional Mantenimiento Mecánico', category: 'MANTENCION' },
    { id: '2', code: 'MOT-02', name: 'Detención de Planta por Bloqueo Eléctrico', category: 'OPERACIONAL' },
    { id: '3', code: 'MOT-03', name: 'Condición Climática / Alerta Polvo', category: 'CLIMA' }
  ],
  workOrders: [
    {
      id: '1',
      tenantId: 'tenant_cmz',
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
      status: 'APROBADO_MANDANTE',
      itoApprovalDate: '15/08/2026 18:30',
      itoApproverName: 'Pedro Alarcón (ITO Codelco)'
    },
    {
      id: '2',
      tenantId: 'tenant_cmz',
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
      status: 'PENDIENTE_APROBACION_ITO'
    }
  ],
  auditLogs: [
    {
      id: 'log-1',
      tenantId: 'tenant_cmz',
      timestamp: '15/08/2026 18:30:12',
      userName: 'Pedro Alarcón (ITO Codelco)',
      userRole: 'ITO_MANDANTE',
      action: 'APROBACION_ITO',
      entityName: 'Orden de Trabajo',
      entityId: 'OT-10492',
      details: 'Conformidad otorgada sin observaciones para trabajo en Correa 002-CV-001'
    },
    {
      id: 'log-2',
      tenantId: 'tenant_cmz',
      timestamp: '15/08/2026 08:15:00',
      userName: 'Carlos Mendoza (Supervisor Terreno)',
      userRole: 'SUPERVISOR_TERRENO',
      action: 'CREACION',
      entityName: 'Orden de Trabajo',
      entityId: 'OT-10492',
      details: 'Programación de cuadrilla de 4 operarios para limpieza de pasarela'
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
    const parsed = JSON.parse(data);
    if (!parsed.auditLogs) parsed.auditLogs = defaultDb.auditLogs;
    if (!parsed.users) parsed.users = defaultDb.users;
    return parsed;
  } catch (err) {
    return defaultDb;
  }
}

function writeDb(dbData) {
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'Local JSON DB File Active', port: PORT });
});

app.get('/api/db', (req, res) => {
  res.json(readDb());
});

// Authentication Endpoint (Real Login)
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = (db.users || []).find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado con ese correo electrónico.' });
  }

  if (!user.active) {
    return res.status(403).json({ error: 'Esta cuenta de usuario ha sido desactivada por el Administrador.' });
  }

  // Password validation (default fallback if empty)
  const validPassword = user.password || '123';
  if (password !== validPassword) {
    return res.status(401).json({ error: 'Contraseña incorrecta.' });
  }

  // Update last login
  user.lastLogin = new Date().toLocaleString('es-CL');
  writeDb(db);

  // Return safe user object (omit raw password)
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Users CRUD API
app.get('/api/users', (req, res) => {
  const safeUsers = (readDb().users || []).map(({ password, ...u }) => u);
  res.json(safeUsers);
});

app.post('/api/users', (req, res) => {
  const db = readDb();
  if (!db.users) db.users = [];
  db.users.push(req.body);
  writeDb(db);
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

app.put('/api/users/:id', (req, res) => {
  const db = readDb();
  db.users = db.users.map(u => u.id === req.params.id ? { ...u, ...req.body } : u);
  writeDb(db);
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

app.delete('/api/users/:id', (req, res) => {
  const db = readDb();
  db.users = db.users.filter(u => u.id !== req.params.id);
  writeDb(db);
  const safeUsers = db.users.map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// WhiteLabel
app.get('/api/whitelabel', (req, res) => {
  res.json(readDb().whiteLabel);
});

app.post('/api/whitelabel', (req, res) => {
  const db = readDb();
  db.whiteLabel = req.body;
  writeDb(db);
  res.json(db.whiteLabel);
});

// Audit Logs API
app.get('/api/audit-logs', (req, res) => {
  res.json(readDb().auditLogs || []);
});

app.post('/api/audit-logs', (req, res) => {
  const db = readDb();
  if (!db.auditLogs) db.auditLogs = [];
  db.auditLogs.unshift(req.body);
  writeDb(db);
  res.json(db.auditLogs);
});

// Contracts CRUD
app.get('/api/contracts', (req, res) => {
  res.json(readDb().contracts);
});

app.post('/api/contracts', (req, res) => {
  const db = readDb();
  db.contracts = req.body;
  writeDb(db);
  res.json(db.contracts);
});

app.put('/api/contracts/:id', (req, res) => {
  const db = readDb();
  db.contracts = db.contracts.map(c => c.id === req.params.id ? { ...c, ...req.body } : c);
  writeDb(db);
  res.json(db.contracts);
});

app.delete('/api/contracts/:id', (req, res) => {
  const db = readDb();
  db.contracts = db.contracts.filter(c => c.id !== req.params.id);
  writeDb(db);
  res.json(db.contracts);
});

// Shifts CRUD
app.get('/api/shifts', (req, res) => {
  res.json(readDb().shifts);
});

app.post('/api/shifts', (req, res) => {
  const db = readDb();
  db.shifts = req.body;
  writeDb(db);
  res.json(db.shifts);
});

app.put('/api/shifts/:id', (req, res) => {
  const db = readDb();
  db.shifts = db.shifts.map(s => s.id === req.params.id ? { ...s, ...req.body } : s);
  writeDb(db);
  res.json(db.shifts);
});

app.delete('/api/shifts/:id', (req, res) => {
  const db = readDb();
  db.shifts = db.shifts.filter(s => s.id !== req.params.id);
  writeDb(db);
  res.json(db.shifts);
});

// Contingencies CRUD
app.get('/api/contingencies', (req, res) => {
  res.json(readDb().contingencies);
});

app.post('/api/contingencies', (req, res) => {
  const db = readDb();
  db.contingencies = req.body;
  writeDb(db);
  res.json(db.contingencies);
});

app.put('/api/contingencies/:id', (req, res) => {
  const db = readDb();
  db.contingencies = db.contingencies.map(c => c.id === req.params.id ? { ...c, ...req.body } : c);
  writeDb(db);
  res.json(db.contingencies);
});

app.delete('/api/contingencies/:id', (req, res) => {
  const db = readDb();
  db.contingencies = db.contingencies.filter(c => c.id !== req.params.id);
  writeDb(db);
  res.json(db.contingencies);
});

// Work Orders CRUD
app.get('/api/work-orders', (req, res) => {
  res.json(readDb().workOrders);
});

app.post('/api/work-orders', (req, res) => {
  const db = readDb();
  db.workOrders = req.body;
  writeDb(db);
  res.json(db.workOrders);
});

app.put('/api/work-orders/:id', (req, res) => {
  const db = readDb();
  db.workOrders = db.workOrders.map(w => w.id === req.params.id ? { ...w, ...req.body } : w);
  writeDb(db);
  res.json(db.workOrders);
});

app.delete('/api/work-orders/:id', (req, res) => {
  const db = readDb();
  db.workOrders = db.workOrders.filter(w => w.id !== req.params.id);
  writeDb(db);
  res.json(db.workOrders);
});

// Plant Areas API
app.post('/api/plant-areas', (req, res) => {
  const db = readDb();
  db.plantAreas = req.body;
  writeDb(db);
  res.json(db.plantAreas);
});

// Sub-Sectors API
app.post('/api/sub-sectors', (req, res) => {
  const db = readDb();
  db.subSectors = req.body;
  writeDb(db);
  res.json(db.subSectors);
});

// Sectors API
app.post('/api/sectors', (req, res) => {
  const db = readDb();
  db.sectors = req.body;
  writeDb(db);
  res.json(db.sectors);
});

// Equipments API
app.post('/api/equipments', (req, res) => {
  const db = readDb();
  db.equipments = req.body;
  writeDb(db);
  res.json(db.equipments);
});

app.put('/api/sectors/:id', (req, res) => {
  const db = readDb();
  db.sectors = db.sectors.map(s => s.id === req.params.id ? { ...s, ...req.body } : s);
  writeDb(db);
  res.json(db.sectors);
});

// Machines
app.get('/api/machines', (req, res) => {
  res.json(readDb().machines);
});

app.post('/api/machines', (req, res) => {
  const db = readDb();
  db.machines = req.body;
  writeDb(db);
  res.json(db.machines);
});

app.put('/api/machines/:id', (req, res) => {
  const db = readDb();
  db.machines = db.machines.map(m => m.id === req.params.id ? { ...m, ...req.body } : m);
  writeDb(db);
  res.json(db.machines);
});

// Workers
app.get('/api/workers', (req, res) => {
  res.json(readDb().workers);
});

app.post('/api/workers', (req, res) => {
  const db = readDb();
  db.workers = req.body;
  writeDb(db);
  res.json(db.workers);
});

app.put('/api/workers/:id', (req, res) => {
  const db = readDb();
  db.workers = db.workers.map(w => w.id === req.params.id ? { ...w, ...req.body } : w);
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
  db.auditLogs = [];
  writeDb(db);
  res.json({ message: 'Database reset to Blank Slate', db });
});

app.listen(PORT, () => {
  console.log(`🚀 Site Clean Local REST Database Server running on http://localhost:${PORT}`);
  console.log(`📁 Database file: ${DB_FILE}`);
});
