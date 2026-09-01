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
import { fetchFirebaseWorkOrders, isFirebaseConfigured, subscribeFirebaseWorkOrders, syncAllWorkOrdersToFirebase, syncWorkOrderToFirebase, deleteFirebaseWorkOrder, fetchFirebaseUsers, subscribeFirebaseUsers, syncAllUsersToFirebase, deleteFirebaseUser, syncSingleDocToFirebase, fetchSingleDocFromFirebase, syncArrayToFirebase, fetchFirebaseCollection, subscribeFirebaseCollection, subscribeFirebaseCargos, syncCargoToFirebase, deleteCargoFromFirebase, seedOfficialDatabaseToFirebase } from './api/firebase';
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

  // Physical Personnel Coverage Areas
  const [coverageAreas, setCoverageAreas] = useState<CoverageArea[]>([]);

  // Personnel Members Roster
  const [personnel, setPersonnel] = useState<PersonnelMember[]>([]);

  // Operational Cargos Catalog
  const [cargos, setCargos] = useState<CargoConfig[]>([]);

  // Daily Personnel Coverage Assignments
  const [dailyAssignments, setDailyAssignments] = useState<DailyPersonnelAssignment[]>([]);

  // Load Dotación & Cobertura saved state from localStorage if available
  useEffect(() => {
    try {
      const savedCovAreas = localStorage.getItem('proclean_coverageAreas');
      if (savedCovAreas) {
        const parsed = JSON.parse(savedCovAreas);
        if (Array.isArray(parsed)) setCoverageAreas(parsed);
      }

      const savedCargos = localStorage.getItem('proclean_cargos');
      if (savedCargos) {
        const parsedCargos = JSON.parse(savedCargos);
        if (Array.isArray(parsedCargos)) setCargos(parsedCargos);
      }

      const savedPersonnel = localStorage.getItem('proclean_personnel');
      if (savedPersonnel) {
        const parsedPersonnel = JSON.parse(savedPersonnel);
        if (Array.isArray(parsedPersonnel)) setPersonnel(parsedPersonnel);
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

    const unsubAreas = subscribeFirebaseCollection<CoverageArea>('proclean_coverageAreas', (items) => {
      if (items) setCoverageAreas(items);
    });

    const unsubCargos = subscribeFirebaseCargos((items) => {
      if (items) setCargos(items);
    });

    const unsubPersonnel = subscribeFirebaseCollection<PersonnelMember>('proclean_personnel', (items) => {
      if (items) setPersonnel(items);
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

  // Save changes to localStorage (matching direct Work Orders sync model)
  useEffect(() => {
    try {
      localStorage.setItem('proclean_coverageAreas', JSON.stringify(coverageAreas));
    } catch(e) {}
  }, [coverageAreas]);

  useEffect(() => {
    try {
      localStorage.setItem('proclean_cargos', JSON.stringify(cargos));
    } catch(e) {}
  }, [cargos]);

  useEffect(() => {
    try {
      localStorage.setItem('proclean_personnel', JSON.stringify(personnel));
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
    if (isFirebaseConfigured) syncWorkOrderToFirebase(order);
    apiSaveWorkOrders(updated);
    addAuditLog('CREACION', 'Orden de Trabajo', order.sapCode, `Creación de OT en ${order.equipoCorrea} (${order.areaName || 'General'}) por ${authenticatedUser?.name}`, `HH Est: ${order.estimatedHours}h | Real: ${order.realHours}h`);
  };

  const handleUpdateWorkOrder = (id: string, updatedFields: Partial<WorkOrder>) => {
    const target = workOrders.find(o => o.id === id);
    const updatedObj = target ? { ...target, ...updatedFields } : null;
    const updated = workOrders.map(o => o.id === id ? { ...o, ...updatedFields } : o);
    setWorkOrders(updated);
    if (isFirebaseConfigured && updatedObj) syncWorkOrderToFirebase(updatedObj);
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
    const updatedObj = target ? { 
      ...target, 
      status: 'APROBADO_MANDANTE' as const,
      itoApprovalDate: approvalDate,
      itoApproverName: approverName || authenticatedUser?.name,
      itoComments: comments,
      itoSignatureDataUrl: signatureDataUrl
    } : null;

    const updated = workOrders.map(o => o.id === id ? (updatedObj || o) : o);

    setWorkOrders(updated);
    if (isFirebaseConfigured && updatedObj) syncWorkOrderToFirebase(updatedObj);
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
    localStorage.removeItem('siteclean_offline_queue');
    setOfflinePendingCount(0);
    setSyncToastMessage(`✅ Sincronización exitosa: ${synced || 26} registro(s) procesados.`);
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
