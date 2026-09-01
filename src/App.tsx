import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { WorkOrdersGrid } from './components/WorkOrdersGrid';
import { OperationalParameters } from './components/OperationalParameters';
import { SystemConfig } from './components/SystemConfig';
import { AdherenceDashboard } from './components/AdherenceDashboard';
import { PhotoEvidence } from './components/PhotoEvidence';
import { OperationalMap } from './components/OperationalMap';
import { AuditLogViewer } from './components/AuditLogViewer';
import { LoginView } from './components/LoginView';
import { PersonnelCoverageModule } from './components/PersonnelCoverageModule';
import type { 
  WorkOrder, 
  PlantArea,
  Sector, 
  SubSector,
  Machine, 
  Worker, 
  WhiteLabelConfig, 
  ShiftType, 
  ClientContract, 
  ContingencyReasonConfig,
  UserAccount,
  AuditLogEntry,
  PlantEquipment,
  PersonnelMember,
  CargoConfig,
  DailyPersonnelAssignment,
  CoverageArea
} from './types';
import { fetchSupabaseWorkOrders, isSupabaseConfigured } from './api/supabase';
import { fetchFirebaseWorkOrders, isFirebaseConfigured, subscribeFirebaseWorkOrders, syncAllWorkOrdersToFirebase, deleteFirebaseWorkOrder, fetchFirebaseUsers, subscribeFirebaseUsers, syncAllUsersToFirebase, deleteFirebaseUser, syncSingleDocToFirebase, fetchSingleDocFromFirebase, syncArrayToFirebase, fetchFirebaseCollection, subscribeFirebaseCollection } from './api/firebase';
import { 
  fetchFullDb, 
  saveWhiteLabel as apiSaveWhiteLabel, 
  saveContracts as apiSaveContracts, 
  saveShifts as apiSaveShifts, 
  saveContingencies as apiSaveContingencies, 
  saveWorkOrders as apiSaveWorkOrders, 
  savePlantAreas as apiSavePlantAreas,
  saveSectors as apiSaveSectors, 
  saveSubSectors as apiSaveSubSectors,
  saveMachines as apiSaveMachines, 
  saveWorkers as apiSaveWorkers, 
  createAuditLogEntry as apiCreateAuditLog,
  resetDatabaseBlankSlate,
  processOfflineQueue,
  getOfflineQueue
} from './api/client';
import initialDbData from '../data/db.json';
import { ShieldCheck, Database, Wifi, WifiOff, LogOut, UserCheck, HardHat, Shield, Wrench, Menu, RefreshCw } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('work-orders');
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlinePendingCount, setOfflinePendingCount] = useState<number>(() => getOfflineQueue().length);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Authenticated User Session State
  const [authenticatedUser, setAuthenticatedUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('siteclean_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  // Users Accounts Database State
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Derived role strictly from authenticatedUser
  const currentRole = authenticatedUser?.role || 'SUPERVISOR_TERRENO';

  // Lock SUPERVISOR_TERRENO strictly to work-orders tab
  useEffect(() => {
    if (currentRole === 'SUPERVISOR_TERRENO' && activeTab !== 'work-orders') {
      setActiveTab('work-orders');
    }
  }, [currentRole, activeTab]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // WhiteLabel & System States
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabelConfig>({
    companyName: 'ProCleanMG',
    brandBadgeText: 'PC',
    primaryColor: '#0F172A',
    actionColor: '#FF7A00',
    tableHeaderColor: '#0F172A',
    headerTitle: 'Plataforma de Gestión Operacional ProCleanMG',
    targetAdherence: 85,
    enablePhotoEvidence: true,
    manualLaborConfig: {
      wheelbarrowsPerDay: 60,
      effectiveHoursPerDay: 6,
      wheelbarrowCapacityM3: 0.08
    },
    columnLabels: {
      semana: 'Semana',
      dia: 'Día',
      sapCode: 'N° OT',
      equipoCorrea: 'Equipo / Correa',
      operationDetail: 'Operación / Detalle',
      vehiclePatent: 'Patente / Vehículo',
      headcount: 'N° Personas',
      estimatedHours: 'HH Estimadas',
      realHours: 'Trabajo Real (HH)',
      status: 'Estado'
    },
    customColumns: []
  });

  const [contracts, setContracts] = useState<ClientContract[]>([]);
  const [activeContractId, setActiveContractId] = useState<string>('c1');
  const [shifts, setShifts] = useState<ShiftType[]>([]);
  const [contingencies, setContingencies] = useState<ContingencyReasonConfig[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

  // 3-Level Plant Hierarchy Initial Defaults
  const [plantAreas, setPlantAreas] = useState<PlantArea[]>([
    { id: 'pa_2', name: 'Área Seca', code: 'AR-SECA' },
    { id: 'pa_1', name: 'Área Húmeda (LIX-SX-EW-RO)', code: 'AR-HUM' },
    { id: 'pa_3', name: 'Sectores Complementarios / Mina', code: 'AR-COMP' }
  ]);

  const [sectors, setSectors] = useState<Sector[]>([
    { id: 'sec_7', areaId: 'pa_2', areaName: 'Área Seca', name: 'Apilado', code: 'APILADO' },
    { id: 'sec_8', areaId: 'pa_2', areaName: 'Área Seca', name: 'Chancado Primario', code: 'CHANCADO' },
    { id: 'sec_9', areaId: 'pa_2', areaName: 'Área Seca', name: 'Chancador Terciario', code: 'CHANCADO' },
    { id: 'sec_10', areaId: 'pa_2', areaName: 'Área Seca', name: 'Planta Concentradora & Relaves', code: 'PLANTAC' },
    { id: 'sec_11', areaId: 'pa_2', areaName: 'Área Seca', name: 'Planta de Salmuera', code: 'PLANTAD' },
    { id: 'sec_12', areaId: 'pa_2', areaName: 'Área Seca', name: 'Remanejo', code: 'REMANEJO' },
    { id: 'sec_1', areaId: 'pa_1', areaName: 'Área Húmeda (LIX-SX-EW-RO)', name: 'Descarga de Ácido Sulfúrico', code: 'DESCARGA' },
    { id: 'sec_2', areaId: 'pa_1', areaName: 'Área Húmeda (LIX-SX-EW-RO)', name: 'Electrowinning (EW)', code: 'ELECTROW' },
    { id: 'sec_3', areaId: 'pa_1', areaName: 'Área Húmeda (LIX-SX-EW-RO)', name: 'Extracción por Solventes (SX)', code: 'EXTRACCI' },
    { id: 'sec_4', areaId: 'pa_1', areaName: 'Área Húmeda (LIX-SX-EW-RO)', name: 'Lixiviación (LIX)', code: 'LIXIVIAC' },
    { id: 'sec_5', areaId: 'pa_1', areaName: 'Área Húmeda (LIX-SX-EW-RO)', name: 'Patio de Embarque', code: 'PATIODE' },
    { id: 'sec_6', areaId: 'pa_1', areaName: 'Área Húmeda (LIX-SX-EW-RO)', name: 'Planta de Ósmosis (RO)', code: 'PLANTAD' },
    { id: 'sec_13', areaId: 'pa_3', areaName: 'Sectores Complementarios / Mina', name: 'Calzadas & Estacionamiento', code: 'CALZADAS' },
    { id: 'sec_14', areaId: 'pa_3', areaName: 'Sectores Complementarios / Mina', name: 'Talleres Faena', code: 'TALLERES' }
  ]);

  const [subSectors, setSubSectors] = useState<SubSector[]>([
    { id: 'sub1', sectorId: 'sec1', sectorName: 'Correa 133', name: 'Polea de Cola', code: 'COLA' },
    { id: 'sub2', sectorId: 'sec1', sectorName: 'Correa 133', name: 'Pasillo Lateral', code: 'PASILLO' },
    { id: 'sub3', sectorId: 'sec1', sectorName: 'Correa 133', name: 'Chute de Traspaso', code: 'CHUTE' },
    { id: 'sub4', sectorId: 'sec1', sectorName: 'Correa 133', name: 'Polines de Carga', code: 'POLINES' },
    { id: 'sub5', sectorId: 'sec1', sectorName: 'Correa 133', name: 'Mesa de Impacto', code: 'MESA' },
    { id: 'sub6', sectorId: 'sec2', sectorName: 'Planta HPGR', name: 'Chute de Alimentación', code: 'CHUTE-HPGR' },
    { id: 'sub7', sectorId: 'sec2', sectorName: 'Planta HPGR', name: 'Piso Chumacera', code: 'CHUMACERA' }
  ]);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);

  // Official Physical Personnel Coverage Areas (Independent from OTs)
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([
    { id: 'a_sup', name: 'Supervisión', code: 'SUP', turnoId: 't_ambos', orden: 1 },
    { id: 'a_ch_prim', name: 'Chancado Primario', code: 'CH-PRIM', turnoId: 't_ambos', orden: 2 },
    { id: 'a_ch_terc', name: 'Chancado Terciario', code: 'CH-TERC', turnoId: 't_ambos', orden: 3 },
    { id: 'a_remanejo', name: 'Apilado y Remanejo', code: 'REM', turnoId: 't_ambos', orden: 4 },
    { id: 'a_humeda', name: 'Área Húmeda', code: 'AR-HUM', turnoId: 't_ambos', orden: 5 },
    { id: 'a_apoyo', name: 'Staff / Apoyo Planta', code: 'STAFF', turnoId: 't_ambos', orden: 6 },
    { id: 'a_personal_4x3', name: 'Personal Staff 4x3', code: 'STAFF-4X3', turnoId: 't_4x3', orden: 7 }
  ]);

  // 86 Official Personnel Members Roster (Turno A & Turno B)
  const [personnel, setPersonnel] = useState<PersonnelMember[]>([
    // Turno A (42 Colaboradores)
    { id: 'p_a1', nombre: 'MANUEL ALEJANDRO ESPINOSA SOTO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a2', nombre: 'ANTONIETA PERLA CATALINA ARIAS DÍAZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a3', nombre: 'VICTOR MANUEL TORO TORO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a4', nombre: 'SERGIO EMILIO RIVERA PALMA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a5', nombre: 'ANIBAL ANDRES RIVERA IBARRA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a6', nombre: 'VICTOR ANTONIO VALDES ROJAS', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a7', nombre: 'MARTIN ORTIZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a8', nombre: 'SANTIAGO FELIPE HUARACHI', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a9', nombre: 'EFRAIN ANDRES MAUREIRA IBACETA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a10', nombre: 'ESTER ANGELA MARCA GARCIA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a11', nombre: 'GIOVANNA LUISA CARIS BRAVO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a12', nombre: 'GERALDINE CAROLINA CRUZ CRUZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a13', nombre: 'POUL EDUARDO VELASQUEZ TORRES', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a14', nombre: 'ALICIA ANDREA SIERRA GONZALEZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a15', nombre: 'EMILIO ANGEL ARAYA VELIZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a16', nombre: 'DEYBI ARMANDO CHIRILLA LOPEZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a17', nombre: 'KRISTOFFERSON ALEJANDRO NUÑEZ NUÑEZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a18', nombre: 'ORIEL ANTONIO LOPEZ ALFARO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a19', nombre: 'BRYAN ALEJANDRO QUINTEROS MORALES', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a20', nombre: 'JOSE DEMETRIO VARGAS MERCADO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a21', nombre: 'MARCIAL PEDRO CAHUANA VILLCA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a22', nombre: 'MARCELO JERONIMO FLORES VICENTE', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a23', nombre: 'MICHEL MANUEL JESUS ROJAS ROJO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a24', nombre: 'GABRIEL ALEXANDER DIAZ VEGA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a25', nombre: 'JUAN DANIEL EDUARDO VIERA ADAOS', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a26', nombre: 'CRISTIAN ALEJANDRO TRIGO ZAPATA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a27', nombre: 'JORGE NESTOR HUGO SANHUEZA GONZALEZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a28', nombre: 'RAFAEL ROSSEL ARTEAGA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a29', nombre: 'JUAQUIN ARCE', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a30', nombre: 'LUIS IGNACIO TORRES MONJE', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a31', nombre: 'JAIRO OBED ALFARO ZAMBRANA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a32', nombre: 'DAVID HERNAN NAVARRO SEGUEL', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a33', nombre: 'JUAN GABRIEL MAMANI MAMANI', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a34', nombre: 'LUIS ROBERTO BARRAZA CORTES', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a35', nombre: 'PATRICIO ANDRES MORALES GONZALE', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a36', nombre: 'JOAQUIN LUCIANO BRAVO VELASQUEZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a37', nombre: 'SEBASTIAN ENRIQUE GOMEZ MANTEROLA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a38', nombre: 'MANUEL ENRIQUE LOPEZ ALFARO', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a39', nombre: 'YIUSTIN JOSE ARAYA LEYTON', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a40', nombre: 'IGNACIO QUIROZ', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a41', nombre: 'ALEXIS FLOREZ CORDOBA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },
    { id: 'p_a42', nombre: 'LEANDRO MOLINA', tipo: 'PLANTA', grupo: 'A', estado: 'Activo' },

    // Turno B (44 Colaboradores)
    { id: 'p_b1', nombre: 'SERGIO SEPULVEDA BERTOGLIO', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b2', nombre: 'MARIA MURILLO SALAS', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b3', nombre: 'LOUIS CAQUEO SOTO', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b4', nombre: 'ELENA CORONADO VALENZUELA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b5', nombre: 'MANUEL HUERTA ESTELLE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b6', nombre: 'JHON VILLANUEVA GUIBERT', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b7', nombre: 'DANGELO ROMO AVELLO', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b8', nombre: 'CLAUDIO JOFRE ARAYA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b9', nombre: 'JEAN PIERRE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b10', nombre: 'DANAE GONZALEZ', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b11', nombre: 'LUIS GAMBOA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b12', nombre: 'MARCO ANDRADE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b13', nombre: 'SEBASTIÁN CORTÉS', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b14', nombre: 'FELIPE OLIVARES', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b15', nombre: 'ALEXANDRO ESPINOZA VALLE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b16', nombre: 'GUILLERMO SALAS LIEBCH', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b17', nombre: 'RONALDO CANAVIRI', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b18', nombre: 'JOSE ATEGA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b19', nombre: 'JAIME CERON', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b20', nombre: 'BENJAMIN RIVEROS ALBURQUENQUE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b21', nombre: 'SEBASTIAN MAMANI CORTES', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b22', nombre: 'NICOLAS QUINTEROS', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b23', nombre: 'RODRIGO MARTINEZ', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b24', nombre: 'MISAEL ARAYA SAAVEDRA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b25', nombre: 'JOSE HORTA VIDELA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b26', nombre: 'PEDRO BORQUEZ SOTO', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b27', nombre: 'SERGIO ARGANDOÑA CERDA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b28', nombre: 'JOSE ESPINOSA SALAZAR', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b29', nombre: 'RODRIGO ORELLANA BARRAZA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b30', nombre: 'LUIS GUERRA VEGA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b31', nombre: 'JEAN VERGARA RONDAN', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b32', nombre: 'PEDRO MONTALBAN', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b33', nombre: 'CRISTIAN SCIAFARRIA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b34', nombre: 'JAIME SANDOVAL', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b35', nombre: 'JOSE CHAMBILLA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b36', nombre: 'JUAN PASMIÑO CRUZ', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b37', nombre: 'PABLO VIDAL HIDALGO', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b38', nombre: 'KEVIN RIOS QUISPE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b39', nombre: 'ISAAC PANIRE PANIRE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b40', nombre: 'VICTOR ROJAS YAÑEZ', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b41', nombre: 'JOSE FARIAS ARAYA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b42', nombre: 'MADDOX RAMOS PEREZ', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b43', nombre: 'RICARDO PEÑA ANTEZANA', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' },
    { id: 'p_b44', nombre: 'JONATHAN GUERRA ESTELLE', tipo: 'PLANTA', grupo: 'B', estado: 'Activo' }
  ]);

  const [cargos, setCargos] = useState<CargoConfig[]>([
    { id: 'c_sup', nombre: 'Supervisor', code: 'SUP' },
    { id: 'c_cond', nombre: 'Conductor Sucker / Aljibe', code: 'COND' },
    { id: 'c_ayu', nombre: 'Ayudante Aseo Industrial', code: 'AYU' },
    { id: 'c_op_aseo', nombre: 'Operador de Aseo', code: 'OP-ASEO' },
    { id: 'c_op_bomba', nombre: 'Operador Bomba / Camión Hidro', code: 'OP-BOMBA' },
    { id: 'c_op_jet', nombre: 'Operador Hidrojet', code: 'OP-JET' },
    { id: 'c_op_eq', nombre: 'Operador de Equipo / Alza Hombre', code: 'OP-EQ' },
    { id: 'c_bod', nombre: 'Bodeguero', code: 'BOD' },
    { id: 'c_mec', nombre: 'Mecánico', code: 'MEC' },
    { id: 'c_prev', nombre: 'Asesor de Prevención (APR)', code: 'PREV' },
    { id: 'c_robot', nombre: 'Aseo Robotizado', code: 'ROBOT', restrictedAreaIds: ['a_personal_4x3'] },
    { id: 'c_acd', nombre: 'ACD', code: 'ACD', restrictedAreaIds: ['a_personal_4x3'] },
    { id: 'c_jefe_prev', nombre: 'Jefe de Prevención', code: 'JEF-PREV', restrictedAreaIds: ['a_personal_4x3'] },
    { id: 'c_planif', nombre: 'Planificador', code: 'PLANIF', restrictedAreaIds: ['a_personal_4x3'] },
    { id: 'c_rrhh', nombre: 'RRHH', code: 'RRHH', restrictedAreaIds: ['a_personal_4x3'] },
    { id: 'c_jefe_taller', nombre: 'Jefe de Taller', code: 'JEF-TALLER', restrictedAreaIds: ['a_personal_4x3'] }
  ]);
  const [dailyAssignments, setDailyAssignments] = useState<DailyPersonnelAssignment[]>([]);

  // Load Dotación & Cobertura saved state from localStorage if available (with master auto-merge)
  useEffect(() => {
    try {
      const defaultAreas: CoverageArea[] = [
        { id: 'a_sup', name: 'Supervisión', code: 'SUP', turnoId: 't_ambos', orden: 1 },
        { id: 'a_ch_prim', name: 'Chancado Primario', code: 'CH-PRIM', turnoId: 't_ambos', orden: 2 },
        { id: 'a_ch_terc', name: 'Chancado Terciario', code: 'CH-TERC', turnoId: 't_ambos', orden: 3 },
        { id: 'a_remanejo', name: 'Apilado y Remanejo', code: 'REM', turnoId: 't_ambos', orden: 4 },
        { id: 'a_humeda', name: 'Área Húmeda', code: 'AR-HUM', turnoId: 't_ambos', orden: 5 },
        { id: 'a_apoyo', name: 'Staff / Apoyo Planta', code: 'STAFF', turnoId: 't_ambos', orden: 6 },
        { id: 'a_personal_4x3', name: 'Personal Staff 4x3', code: 'STAFF-4X3', turnoId: 't_4x3', orden: 7 }
      ];

      const savedCovAreas = localStorage.getItem('proclean_coverageAreas');
      if (savedCovAreas) {
        const parsed = JSON.parse(savedCovAreas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const parsedIds = new Set(parsed.map((a: any) => a.id));
          const missing = defaultAreas.filter(d => !parsedIds.has(d.id));
          if (parsed.some((a: any) => a.id === 'a_sup_dia')) {
            localStorage.removeItem('proclean_coverageAreas');
          } else {
            setCoverageAreas([...parsed, ...missing]);
          }
        }
      }

      const savedCargos = localStorage.getItem('proclean_cargos');
      if (savedCargos) {
        const parsedCargos = JSON.parse(savedCargos);
        if (Array.isArray(parsedCargos) && parsedCargos.length > 0) {
          const defaultRestrictedIds = ['c_robot', 'c_acd', 'c_jefe_prev', 'c_planif', 'c_rrhh', 'c_jefe_taller'];
          const merged = parsedCargos.map((c: any) => {
            if (defaultRestrictedIds.includes(c.id) && (!c.restrictedAreaIds || c.restrictedAreaIds.length === 0)) {
              return { ...c, restrictedAreaIds: ['a_personal_4x3'] };
            }
            return c;
          });
          setCargos(merged);
        }
      }

      const savedPersonnel = localStorage.getItem('proclean_personnel');
      if (savedPersonnel) {
        const parsedPersonnel = JSON.parse(savedPersonnel);
        if (Array.isArray(parsedPersonnel) && parsedPersonnel.length >= 30) {
          setPersonnel(parsedPersonnel);
        }
      }

      const savedAsgs = localStorage.getItem('proclean_dailyAssignments');
      if (savedAsgs) setDailyAssignments(JSON.parse(savedAsgs));
    } catch (e) {
      console.warn('Error restoring dotacion local storage:', e);
    }
  }, []);

  // Real-time Cloud Firebase Firestore Listener for Dotación & Cobertura (Sync PC & Mobile)
  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const defaultAreas: CoverageArea[] = [
      { id: 'a_sup', name: 'Supervisión', code: 'SUP', turnoId: 't_ambos', orden: 1 },
      { id: 'a_ch_prim', name: 'Chancado Primario', code: 'CH-PRIM', turnoId: 't_ambos', orden: 2 },
      { id: 'a_ch_terc', name: 'Chancado Terciario', code: 'CH-TERC', turnoId: 't_ambos', orden: 3 },
      { id: 'a_remanejo', name: 'Apilado y Remanejo', code: 'REM', turnoId: 't_ambos', orden: 4 },
      { id: 'a_humeda', name: 'Área Húmeda', code: 'AR-HUM', turnoId: 't_ambos', orden: 5 },
      { id: 'a_apoyo', name: 'Staff / Apoyo Planta', code: 'STAFF', turnoId: 't_ambos', orden: 6 },
      { id: 'a_personal_4x3', name: 'Personal Staff 4x3', code: 'STAFF-4X3', turnoId: 't_4x3', orden: 7 }
    ];

    const unsubAreas = subscribeFirebaseCollection<CoverageArea>('proclean_coverageAreas', (items) => {
      if (items && items.length > 0) {
        setCoverageAreas(prevAreas => {
          const map = new Map<string, CoverageArea>();
          defaultAreas.forEach(a => map.set(a.id, a));
          prevAreas.forEach(a => map.set(a.id, a));
          items.forEach(a => map.set(a.id, a));
          return Array.from(map.values());
        });
      }
    });

    const unsubCargos = subscribeFirebaseCollection<CargoConfig>('proclean_cargos', (items) => {
      if (items && items.length > 0) {
        const defaultRestrictedIds = ['c_robot', 'c_acd', 'c_jefe_prev', 'c_planif', 'c_rrhh', 'c_jefe_taller'];
        setCargos(prevCargos => {
          const map = new Map<string, CargoConfig>();
          prevCargos.forEach(c => map.set(c.id, c));
          items.forEach((c: any) => {
            const item = defaultRestrictedIds.includes(c.id) && (!c.restrictedAreaIds || c.restrictedAreaIds.length === 0)
              ? { ...c, restrictedAreaIds: ['a_personal_4x3'] }
              : c;
            map.set(c.id, item);
          });
          return Array.from(map.values());
        });
      }
    });

    const unsubPersonnel = subscribeFirebaseCollection<PersonnelMember>('proclean_personnel', (items) => {
      if (items && items.length > 0) {
        setPersonnel(prevPersonnel => {
          const map = new Map<string, PersonnelMember>();
          prevPersonnel.forEach(p => map.set(p.id, p));
          items.forEach(p => map.set(p.id, p));
          return Array.from(map.values());
        });
      }
    });

    const unsubAsgs = subscribeFirebaseCollection<DailyPersonnelAssignment>('proclean_dailyAssignments', (items) => {
      if (items) setDailyAssignments(items);
    });

    return () => {
      unsubAreas?.();
      unsubCargos?.();
      unsubPersonnel?.();
      unsubAsgs?.();
    };
  }, []);

  // Save changes to localStorage & Cloud Firebase Firestore
  useEffect(() => {
    try {
      localStorage.setItem('proclean_coverageAreas', JSON.stringify(coverageAreas));
      if (isFirebaseConfigured) syncArrayToFirebase('proclean_coverageAreas', coverageAreas);
    } catch(e) {}
  }, [coverageAreas]);

  useEffect(() => {
    try {
      localStorage.setItem('proclean_cargos', JSON.stringify(cargos));
      if (isFirebaseConfigured) syncArrayToFirebase('proclean_cargos', cargos);
    } catch(e) {}
  }, [cargos]);

  useEffect(() => {
    try {
      localStorage.setItem('proclean_personnel', JSON.stringify(personnel));
      if (isFirebaseConfigured) syncArrayToFirebase('proclean_personnel', personnel);
    } catch(e) {}
  }, [personnel]);

  useEffect(() => {
    try {
      localStorage.setItem('proclean_dailyAssignments', JSON.stringify(dailyAssignments));
      if (isFirebaseConfigured) syncArrayToFirebase('proclean_dailyAssignments', dailyAssignments);
    } catch(e) {}
  }, [dailyAssignments]);

  // Monitor Network Online/Offline and auto-process offline queue
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      const pendingCount = getOfflineQueue().length;
      if (pendingCount > 0) {
        setSyncToastMessage(`📶 Re-conectado. Sincronizando ${pendingCount} registro(s) pendiente(s) de terreno...`);
        const synced = await processOfflineQueue();
        setOfflinePendingCount(getOfflineQueue().length);
        setSyncToastMessage(`✅ Sincronización exitosa: ${synced} registro(s) enviados a la base de datos.`);
        setTimeout(() => setSyncToastMessage(null), 4000);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncToastMessage('⚠️ Modo Terreno Offline activado. Los registros se encolarán localmente.');
      setTimeout(() => setSyncToastMessage(null), 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Queue interval check
  useEffect(() => {
    const interval = setInterval(() => {
      setOfflinePendingCount(getOfflineQueue().length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const [equipments, setEquipments] = useState<PlantEquipment[]>([]);

  // Load from Local REST DB on mount with Vercel production fallback & Real-time Firebase Sync
  useEffect(() => {
    let firebaseUnsub: (() => void) | null = null;

    const processDbData = async (db: any) => {
      // 1. Check Cloud DB (Firebase or Supabase) for Work Orders
      let cloudOrders: WorkOrder[] | null = null;
      if (isFirebaseConfigured) {
        cloudOrders = await fetchFirebaseWorkOrders();
        
        // Seed initial work orders to Firebase ONLY if cloud DB is completely empty (first time)
        const isSeeded = localStorage.getItem('proclean_seeded_firebase');
        if ((!cloudOrders || cloudOrders.length === 0) && !isSeeded && db.workOrders && db.workOrders.length > 0) {
          await syncAllWorkOrdersToFirebase(db.workOrders);
          localStorage.setItem('proclean_seeded_firebase', 'true');
          cloudOrders = await fetchFirebaseWorkOrders();
        }

        // Subscribe to real-time changes from Firestore on ALL devices
        firebaseUnsub = subscribeFirebaseWorkOrders((liveOrders) => {
          setWorkOrders(liveOrders);
          try {
            localStorage.setItem('proclean_work_orders', JSON.stringify(liveOrders));
          } catch (e) {
            console.warn('LocalStorage error:', e);
          }
        });
      } else if (isSupabaseConfigured) {
        cloudOrders = await fetchSupabaseWorkOrders();
      }

      if (cloudOrders && Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setWorkOrders(cloudOrders);
        localStorage.setItem('proclean_work_orders', JSON.stringify(cloudOrders));
      } else {
        // Fallback to localStorage
        const localOrders = localStorage.getItem('proclean_work_orders');
        if (localOrders) {
          try {
            const parsed = JSON.parse(localOrders);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setWorkOrders(parsed);
            } else if (db.workOrders) {
              setWorkOrders(db.workOrders);
            }
          } catch {
            if (db.workOrders) setWorkOrders(db.workOrders);
          }
        } else if (db.workOrders) {
          setWorkOrders(db.workOrders);
        }
      }

      // Load Users: Cloud Firebase -> LocalStorage -> Seed JSON
      let cloudUsers: UserAccount[] | null = null;
      if (isFirebaseConfigured) {
        cloudUsers = await fetchFirebaseUsers();
        
        // Seed initial users to Firebase ONLY if cloud DB has no users (first time)
        const isUsersSeeded = localStorage.getItem('proclean_seeded_users_firebase');
        if ((!cloudUsers || cloudUsers.length === 0) && !isUsersSeeded && db.users && db.users.length > 0) {
          await syncAllUsersToFirebase(db.users);
          localStorage.setItem('proclean_seeded_users_firebase', 'true');
          cloudUsers = await fetchFirebaseUsers();
        }

        // Subscribe to real-time users sync on ALL devices
        subscribeFirebaseUsers((liveUsers) => {
          if (liveUsers && liveUsers.length > 0) {
            setUsers(liveUsers);
            try {
              localStorage.setItem('proclean_users', JSON.stringify(liveUsers));
            } catch (e) {
              console.warn('LocalStorage error:', e);
            }
          }
        });
      }

      if (cloudUsers && Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        setUsers(cloudUsers);
        localStorage.setItem('proclean_users', JSON.stringify(cloudUsers));
      } else {
        const localUsers = localStorage.getItem('proclean_users');
        if (localUsers) {
          try {
            const parsed = JSON.parse(localUsers);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setUsers(parsed);
            } else if (db.users) {
              setUsers(db.users);
            }
          } catch {
            if (db.users) setUsers(db.users);
          }
        } else if (db.users) {
          setUsers(db.users);
        }
      }

      // Generic loader function for ALL remaining ERP Entities (Cloud Firebase -> LocalStorage -> Seed JSON)
      const loadEntity = async <T,>(
        storageKey: string,
        colName: string,
        setter: React.Dispatch<React.SetStateAction<T>>,
        seedData: T,
        isSingleDoc: boolean = false
      ) => {
        let cloud: T | null = null;
        if (isFirebaseConfigured) {
          if (isSingleDoc) {
            cloud = await fetchSingleDocFromFirebase<T>(colName, 'config');
          } else {
            cloud = await fetchFirebaseCollection(colName) as unknown as T;
            const isSeededKey = `proclean_seeded_${colName}`;
            if ((!cloud || (Array.isArray(cloud) && cloud.length === 0)) && !localStorage.getItem(isSeededKey) && Array.isArray(seedData) && seedData.length > 0) {
              await syncArrayToFirebase(colName, seedData as any[]);
              localStorage.setItem(isSeededKey, 'true');
              cloud = await fetchFirebaseCollection(colName) as unknown as T;
            }

            subscribeFirebaseCollection(colName, (liveItems) => {
              if (liveItems && liveItems.length > 0) {
                setter(liveItems as unknown as T);
                try { localStorage.setItem(storageKey, JSON.stringify(liveItems)); } catch (e) {}
              }
            });
          }
        }

        if (cloud && ((Array.isArray(cloud) && cloud.length > 0) || (!Array.isArray(cloud) && cloud))) {
          setter(cloud);
          localStorage.setItem(storageKey, JSON.stringify(cloud));
        } else {
          const local = localStorage.getItem(storageKey);
          if (local) {
            try {
              const parsed = JSON.parse(local);
              if (parsed && ((Array.isArray(parsed) && parsed.length > 0) || !Array.isArray(parsed))) {
                setter(parsed);
              } else if (seedData) {
                setter(seedData);
              }
            } catch {
              if (seedData) setter(seedData);
            }
          } else if (seedData) {
            setter(seedData);
          }
        }
      };

      if (db.whiteLabel) await loadEntity('proclean_whitelabel', 'whitelabel', setWhiteLabel, db.whiteLabel, true);
      if (db.contracts) await loadEntity('proclean_contracts', 'contracts', setContracts, db.contracts);
      if (db.shifts) await loadEntity('proclean_shifts', 'shifts', setShifts, db.shifts);
      if (db.contingencies) await loadEntity('proclean_contingencies', 'contingencies', setContingencies, db.contingencies);
      if (db.plantAreas) await loadEntity('proclean_plant_areas', 'plant_areas', setPlantAreas, db.plantAreas);
      if (db.sectors) await loadEntity('proclean_sectors', 'sectors', setSectors, db.sectors);
      if (db.equipments) await loadEntity('proclean_equipments', 'equipments', setEquipments, db.equipments);
      if (db.subSectors) await loadEntity('proclean_sub_sectors', 'sub_sectors', setSubSectors, db.subSectors);
      if (db.machines) await loadEntity('proclean_machines', 'machines', setMachines, db.machines);
      if (db.workers) await loadEntity('proclean_workers', 'workers', setWorkers, db.workers);
      if (db.auditLogs) await loadEntity('proclean_audit_logs', 'audit_logs', setAuditLogs, db.auditLogs);

      setDbConnected(true);
    };

    fetchFullDb()
      .then(db => {
        processDbData(db);
      })
      .catch(err => {
        console.warn('Servidor de Base de Datos local no detectado en 3001. Cargando datos de respaldo para producción Vercel.', err);
        processDbData(initialDbData as any);
      });

    return () => {
      if (firebaseUnsub) firebaseUnsub();
    };
  }, []);

  // Login & Logout Handlers
  const handleLoginSuccess = (user: UserAccount) => {
    setAuthenticatedUser(user);
    localStorage.setItem('siteclean_session', JSON.stringify(user));
    addAuditLog('CREACION', 'Sesión de Usuario', user.email, `Inicio de sesión exitoso como ${user.name}`, `Rol: ${user.role}`);
  };

  const handleLogout = () => {
    if (authenticatedUser) {
      addAuditLog('ELIMINACION', 'Sesión de Usuario', authenticatedUser.email, `Cierre de sesión de ${authenticatedUser.name}`);
    }
    setAuthenticatedUser(null);
    localStorage.removeItem('siteclean_session');
  };

  // Helper for logging audit events with Diff Engine
  const addAuditLog = (action: AuditLogEntry['action'], entityName: string, entityId: string, details: string, diffSummary?: string) => {
    if (!authenticatedUser) return;
    const entry = {
      tenantId: 'tenant_cmz',
      timestamp: new Date().toLocaleString('es-CL'),
      userName: `${authenticatedUser.name} (${authenticatedUser.role})`,
      userRole: currentRole,
      action,
      entityName,
      entityId,
      details,
      diffSummary
    };

    setAuditLogs(prev => {
      const next = [ { ...entry, id: `log-${Date.now()}` }, ...prev ];
      try { localStorage.setItem('proclean_audit_logs', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('audit_logs', next);
      return next;
    });
    apiCreateAuditLog(entry);
  };

  // Update Wrappers (All ERP Entities -> Cloud Firebase + LocalStorage Persistence)
  const updateWhiteLabel = (val: React.SetStateAction<WhiteLabelConfig>) => {
    setWhiteLabel(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_whitelabel', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncSingleDocToFirebase('whitelabel', 'config', next);
      apiSaveWhiteLabel(next);
      addAuditLog('EDICION', 'Configuración de Marca', 'WhiteLabel', 'Actualización de parámetros visuales');
      return next;
    });
  };

  const updateUsers = (val: React.SetStateAction<UserAccount[]>) => {
    setUsers(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try {
        localStorage.setItem('proclean_users', JSON.stringify(next));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      if (isFirebaseConfigured) {
        syncAllUsersToFirebase(next);
      }
      addAuditLog('EDICION', 'Cuentas de Usuario', 'Users', 'Actualización de usuarios y roles fijos asignados');
      return next;
    });
  };

  const updateContracts = (val: React.SetStateAction<ClientContract[]>) => {
    setContracts(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_contracts', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('contracts', next);
      apiSaveContracts(next);
      addAuditLog('EDICION', 'Contratos', 'MultiContract', 'Actualización de clientes y contratos mineros');
      return next;
    });
  };

  const updateShifts = (val: React.SetStateAction<ShiftType[]>) => {
    setShifts(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_shifts', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('shifts', next);
      apiSaveShifts(next);
      addAuditLog('EDICION', 'Turnos', 'Shifts', 'Parametrización de turnos operacionales');
      return next;
    });
  };

  const updateContingencies = (val: React.SetStateAction<ContingencyReasonConfig[]>) => {
    setContingencies(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_contingencies', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('contingencies', next);
      apiSaveContingencies(next);
      addAuditLog('EDICION', 'Contingencias', 'Contingency', 'Actualización de motivos de detención');
      return next;
    });
  };

  const updatePlantAreas = (val: React.SetStateAction<PlantArea[]>) => {
    setPlantAreas(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_plant_areas', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('plant_areas', next);
      apiSavePlantAreas(next);
      return next;
    });
  };

  const updateSectors = (val: React.SetStateAction<Sector[]>) => {
    setSectors(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_sectors', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('sectors', next);
      apiSaveSectors(next);
      return next;
    });
  };

  const updateSubSectors = (val: React.SetStateAction<SubSector[]>) => {
    setSubSectors(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_sub_sectors', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('sub_sectors', next);
      apiSaveSubSectors(next);
      return next;
    });
  };

  const updateEquipments = (val: React.SetStateAction<PlantEquipment[]>) => {
    setEquipments(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_equipments', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('equipments', next);
      return next;
    });
  };

  const updateMachines = (val: React.SetStateAction<Machine[]>) => {
    setMachines(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_machines', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('machines', next);
      apiSaveMachines(next);
      return next;
    });
  };

  const updateWorkers = (val: React.SetStateAction<Worker[]>) => {
    setWorkers(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('proclean_workers', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('workers', next);
      apiSaveWorkers(next);
      return next;
    });
  };

  const [targetEditOrder, setTargetEditOrder] = useState<WorkOrder | null>(null);

  const activeContract = contracts.find(c => c.id === activeContractId) || contracts[0];

  const handleAddWorkOrder = (newOrder: Omit<WorkOrder, 'id'>) => {
    const order: WorkOrder = {
      ...newOrder,
      id: Date.now().toString(),
      tenantId: 'tenant_cmz'
    };
    const updated = [order, ...workOrders];
    setWorkOrders(updated);
    apiSaveWorkOrders(updated);
    addAuditLog('CREACION', 'Orden de Trabajo', order.sapCode, `Creación de OT en ${order.equipoCorrea} (${order.areaName || 'General'}) por ${authenticatedUser?.name}`, `HH Est: ${order.estimatedHours}h | Real: ${order.realHours}h`);
  };

  const handleUpdateWorkOrder = (id: string, updatedFields: Partial<WorkOrder>) => {
    const target = workOrders.find(o => o.id === id);
    const updated = workOrders.map(o => o.id === id ? { ...o, ...updatedFields } : o);
    setWorkOrders(updated);
    apiSaveWorkOrders(updated);
    
    let diffStr = undefined;
    if (target && updatedFields.realHours && target.realHours !== updatedFields.realHours) {
      diffStr = `HH Reales: ${target.realHours}h ➔ ${updatedFields.realHours}h`;
    }
    
    addAuditLog('EDICION', 'Orden de Trabajo', target?.sapCode || id, `Modificación de OT por ${authenticatedUser?.name}`, diffStr);
  };

  const handleItoApproveWorkOrder = (id: string, approverName: string, comments?: string, signatureDataUrl?: string) => {
    const target = workOrders.find(o => o.id === id);
    const approvalDate = new Date().toLocaleString('es-CL');
    const updated = workOrders.map(o => o.id === id ? { 
      ...o, 
      status: 'APROBADO_MANDANTE' as const,
      itoApprovalDate: approvalDate,
      itoApproverName: approverName || authenticatedUser?.name,
      itoComments: comments,
      itoSignatureDataUrl: signatureDataUrl
    } : o);

    setWorkOrders(updated);
    apiSaveWorkOrders(updated);
    addAuditLog('APROBACION_ITO', 'Orden de Trabajo', target?.sapCode || id, `Conformidad ITO otorgada por ${approverName || authenticatedUser?.name}`, `Estado: PENDIENTE ➔ APROBADO_MANDANTE ${signatureDataUrl ? '(Firma Digital Estampada)' : ''}`);
  };

  const handleDeleteWorkOrder = (id: string) => {
    const target = workOrders.find(o => o.id === id);
    const updated = workOrders.filter(o => o.id !== id);
    setWorkOrders(updated);
    if (isFirebaseConfigured) {
      deleteFirebaseWorkOrder(id);
    }
    apiSaveWorkOrders(updated);
    addAuditLog('ELIMINACION', 'Orden de Trabajo', target?.sapCode || id, `Eliminación de la OT por ${authenticatedUser?.name}`);
  };

  const handleResetBlankSlate = () => {
    resetDatabaseBlankSlate().then(() => {
      setWorkOrders([]);
      setSectors([]);
      setMachines([]);
      setWorkers([]);
      setAuditLogs([]);
      alert('¡Base de Datos Local vaciada a Lienzo en Blanco!');
    });
  };

  const handleManualSyncQueue = async () => {
    setSyncToastMessage('📶 Sincronizando cola offline de terreno...');
    const synced = await processOfflineQueue();
    setOfflinePendingCount(getOfflineQueue().length);
    setSyncToastMessage(`✅ Sincronización exitosa: ${synced} registro(s) procesados.`);
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const getRoleIcon = (role: UserAccount['role']) => {
    switch (role) {
      case 'SUPERVISOR_TERRENO':
        return <HardHat size={14} style={{ color: '#05A6A6' }} />;
      case 'ITO_MANDANTE':
        return <UserCheck size={14} style={{ color: '#025951' }} />;
      case 'ADMINISTRADOR_CONTRATO':
        return <Shield size={14} style={{ color: '#3F3D73' }} />;
      case 'SUPER_ADMIN':
        return <Wrench size={14} style={{ color: '#B91C1C' }} />;
    }
  };

  // Render Login View if not authenticated
  if (!authenticatedUser) {
    return <LoginView whiteLabel={whiteLabel} onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* Toast Notification Banner for Sync */}
      {syncToastMessage && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: 'var(--color-primary-dark)', color: '#FFF', padding: '12px 20px', borderRadius: '12px', boxShadow: 'var(--shadow-lg)', zIndex: 2000, fontWeight: 700, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <RefreshCw size={16} className="spin-animation" />
          {syncToastMessage}
        </div>
      )}

      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        whiteLabel={whiteLabel}
        activeContract={activeContract}
        dbConnected={dbConnected}
        isOnline={isOnline}
        currentRole={currentRole}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        
        {/* Top Header */}
        <header className="top-header">
          <div className="header-title-group">
            {/* Hamburger Button for Mobile/Tablet */}
            <button 
              className="hamburger-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              title="Abrir menú de navegación"
            >
              <Menu size={22} />
            </button>

            <h1>{whiteLabel.headerTitle}</h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            
            {/* Network Online / Offline Status Badge with Pending Queue count */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: isOnline ? '#047857' : '#B91C1C', backgroundColor: isOnline ? '#ECFDF5' : '#FEF2F2', padding: '4px 10px', borderRadius: '16px' }}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? 'En Línea' : 'Modo Terreno'}</span>
              {offlinePendingCount > 0 && (
                <button 
                  onClick={handleManualSyncQueue}
                  style={{ backgroundColor: '#F59E0B', color: '#FFF', border: 'none', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', cursor: 'pointer', marginLeft: '4px' }}
                  title="Sincronizar cambios offline pendientes"
                >
                  {offlinePendingCount} pend.
                </button>
              )}
            </div>

            {/* DB Status Badge */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: isFirebaseConfigured ? '#0369A1' : isSupabaseConfigured ? '#047857' : dbConnected ? '#025951' : '#92400E', backgroundColor: isFirebaseConfigured ? '#F0F9FF' : isSupabaseConfigured ? '#ECFDF5' : dbConnected ? '#E6F4F1' : '#FEF3C7', padding: '4px 10px', borderRadius: '16px' }}>
              <Database size={14} />
              {isFirebaseConfigured ? 'BD FIREBASE CLOUD' : isSupabaseConfigured ? 'BD SUPABASE CLOUD' : dbConnected ? 'BD LOCAL (3001)' : 'BD Local...'}
            </div>

            {/* Active Contract Badge */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-forest-teal)', backgroundColor: 'var(--status-complete-bg)', padding: '6px 12px', borderRadius: '20px' }}>
              <ShieldCheck size={16} />
              {activeContract ? activeContract.clientName : 'Contrato Activo'}
            </div>

            {/* Authenticated User Session Badge with Logout */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--color-bg-offwhite)', padding: '4px 10px', borderRadius: '30px', border: '1px solid var(--color-border-light)' }}>
              <div className="user-avatar" style={{ backgroundColor: authenticatedUser.avatarColor || 'var(--color-primary-dark)' }}>
                {authenticatedUser.name.substring(0, 2).toUpperCase()}
              </div>
              
              <div className="hide-on-mobile">
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-main)' }}>{authenticatedUser.name}</div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {getRoleIcon(authenticatedUser.role)}
                  {authenticatedUser.role}
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '11px', color: '#991B1B', border: '1px solid #FCA5A5' }}
                title="Cerrar Sesión Activa"
              >
                <LogOut size={12} /> <span className="hide-on-mobile">Salir</span>
              </button>
            </div>

          </div>
        </header>

        {/* Content Body */}
        <main className="content-body">
          {activeTab === 'work-orders' && (
            <WorkOrdersGrid 
              workOrders={workOrders}
              onAddWorkOrder={handleAddWorkOrder}
              onUpdateWorkOrder={handleUpdateWorkOrder}
              onDeleteWorkOrder={handleDeleteWorkOrder}
              onItoApproveWorkOrder={handleItoApproveWorkOrder}
              whiteLabel={whiteLabel}
              shifts={shifts}
              machines={machines}
              plantAreas={plantAreas}
              sectors={sectors}
              equipments={equipments}
              subSectors={subSectors}
              contingencies={contingencies}
              currentRole={currentRole}
              targetEditOrder={targetEditOrder}
              onClearTargetEditOrder={() => setTargetEditOrder(null)}
            />
          )}

          {activeTab === 'personnel-coverage' && (
            <PersonnelCoverageModule
              personnel={personnel}
              cargos={cargos}
              coverageAreas={coverageAreas}
              assignments={dailyAssignments}
              onSaveAssignments={(newAsgs) => setDailyAssignments(newAsgs)}
              shifts={shifts}
              currentRole={currentRole}
              userEmail={authenticatedUser?.email}
            />
          )}

          {activeTab === 'map-operational' && (
            <OperationalMap 
              workOrders={workOrders}
              plantAreas={plantAreas}
              sectors={sectors}
              equipments={equipments}
              subSectors={subSectors}
              whiteLabel={whiteLabel}
              machines={machines}
              onEditWorkOrder={(order) => {
                setTargetEditOrder(order);
                setActiveTab('work-orders');
              }}
            />
          )}

          {activeTab === 'parameters' && (
            <OperationalParameters 
              plantAreas={plantAreas}
              setPlantAreas={updatePlantAreas}
              sectors={sectors}
              setSectors={updateSectors}
              subSectors={subSectors}
              setSubSectors={updateSubSectors}
              machines={machines}
              setMachines={updateMachines}
              workers={workers}
              setWorkers={updateWorkers}
              shifts={shifts}
              whiteLabel={whiteLabel}
              setWhiteLabel={updateWhiteLabel}
              coverageAreas={coverageAreas}
              setCoverageAreas={setCoverageAreas}
              personnel={personnel}
              setPersonnel={setPersonnel}
              cargos={cargos}
              setCargos={setCargos}
            />
          )}

          {activeTab === 'system-config' && (
            <SystemConfig 
              whiteLabel={whiteLabel}
              setWhiteLabel={updateWhiteLabel}
              contracts={contracts}
              setContracts={updateContracts}
              activeContractId={activeContractId}
              setActiveContractId={setActiveContractId}
              shifts={shifts}
              setShifts={updateShifts}
              contingencies={contingencies}
              setContingencies={updateContingencies}
              users={users}
              setUsers={updateUsers}
              onResetBlankSlate={handleResetBlankSlate}
            />
          )}

          {activeTab === 'dashboard' && (
            <AdherenceDashboard 
              workOrders={workOrders} 
              whiteLabel={whiteLabel}
              onUpdateWhiteLabel={updateWhiteLabel}
            />
          )}

          {activeTab === 'audit-logs' && (
            <AuditLogViewer auditLogs={auditLogs} />
          )}

          {activeTab === 'evidences' && (
            <PhotoEvidence 
              workOrders={workOrders} 
              onUpdateWorkOrder={handleUpdateWorkOrder}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
