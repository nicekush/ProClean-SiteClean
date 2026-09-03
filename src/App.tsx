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
import { fetchFirebaseWorkOrders, isFirebaseConfigured, subscribeFirebaseWorkOrders, syncWorkOrderToFirebase, deleteFirebaseWorkOrder, fetchFirebaseUsers, subscribeFirebaseUsers, syncAllUsersToFirebase, syncSingleDocToFirebase, fetchSingleDocFromFirebase, syncArrayToFirebase, fetchFirebaseCollection, fetchFirebaseCollectionByField, subscribeFirebaseCollection, subscribeFirebaseCollectionByField, subscribeFirebaseCollectionByFields, subscribeFirebaseCargos, replaceFirebaseCollection } from './api/firebase';
import { 
  fetchFullDb, 
  saveWhiteLabel as apiSaveWhiteLabel, 
  saveContracts as apiSaveContracts, 
  saveShifts as apiSaveShifts, 
  saveContingencies as apiSaveContingencies, 
  savePlantAreas as apiSavePlantAreas,
  saveSectors as apiSaveSectors, 
  saveSubSectors as apiSaveSubSectors,
  saveMachines as apiSaveMachines, 
  saveWorkers as apiSaveWorkers, 
  createAuditLogEntry as apiCreateAuditLog,
  resetDatabaseBlankSlate
} from './api/client';
import initialDbData from '../data/db.json';
import { OFFICIAL_PROCLEAN_LOGO_URL } from './config/branding';
import { isFirebaseAuthRequired, logoutFromFirebase, subscribeFirebaseSession } from './api/auth';
import { ShieldCheck, Database, Wifi, WifiOff, LogOut, UserCheck, HardHat, Shield, Wrench, Menu, RefreshCw } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('work-orders');
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pendingWorkOrderIds, setPendingWorkOrderIds] = useState<Set<string>>(() => new Set());
  const [isReadingFromCache, setIsReadingFromCache] = useState<boolean>(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);

  // Mobile Drawer State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Authenticated User Session State
  const [authenticatedUser, setAuthenticatedUser] = useState<UserAccount | null>(() => {
    if (isFirebaseAuthRequired) return null;
    const saved = localStorage.getItem('siteclean_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  useEffect(() => {
    if (!isFirebaseAuthRequired) return;
    return subscribeFirebaseSession(user => setAuthenticatedUser(user));
  }, []);

  const activeTenantId = authenticatedUser?.tenantId || 'tenant_cmz';
  const dataAccessKey = authenticatedUser
    ? `${authenticatedUser.id}:${activeTenantId}:${authenticatedUser.role}`
    : '';

  // Users Accounts Database State
  const [users, setUsers] = useState<UserAccount[]>([]);

  // Derived role strictly from authenticatedUser
  const currentRole = authenticatedUser?.role || 'SUPERVISOR_TERRENO';

  // Keep supervisors inside the operational views exposed by the sidebar.
  useEffect(() => {
    const supervisorTabs = ['work-orders', 'personnel-coverage'];
    if (currentRole === 'SUPERVISOR_TERRENO' && !supervisorTabs.includes(activeTab)) {
      setActiveTab('work-orders');
    }
  }, [currentRole, activeTab]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  // WhiteLabel & System States
  const [whiteLabel, setWhiteLabel] = useState<WhiteLabelConfig>({
    companyName: 'ProCleanMG',
    companyLogoUrl: OFFICIAL_PROCLEAN_LOGO_URL,
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

  // Real-time Cloud Firebase Firestore Listener for Dotación & Cobertura (Sync PC & Mobile)
  useEffect(() => {
    if (!isFirebaseConfigured || !dataAccessKey) return;

    const tenantId = activeTenantId;
    const unsubAreas = isFirebaseAuthRequired
      ? subscribeFirebaseCollectionByField<CoverageArea>('proclean_coverageAreas', 'tenantId', tenantId, items => {
          setCoverageAreas(items || []);
        })
      : subscribeFirebaseCollection<CoverageArea>('proclean_coverageAreas', items => {
          setCoverageAreas(items || []);
        });

    const unsubCargos = isFirebaseAuthRequired
      ? subscribeFirebaseCollectionByField<CargoConfig>('proclean_cargos', 'tenantId', tenantId, items => {
          setCargos(items || []);
        })
      : subscribeFirebaseCargos(items => {
          setCargos(items || []);
        });

    const unsubPersonnel = isFirebaseAuthRequired
      ? subscribeFirebaseCollectionByField<PersonnelMember>('proclean_personnel', 'tenantId', tenantId, items => {
          setPersonnel(items || []);
        })
      : subscribeFirebaseCollection<PersonnelMember>('proclean_personnel', items => {
          setPersonnel(items || []);
        });

    const today = new Date().toISOString().split('T')[0];
    const unsubAsgs = isFirebaseAuthRequired
      ? subscribeFirebaseCollectionByFields<DailyPersonnelAssignment>(
          'proclean_dailyAssignments',
          [
            { fieldName: 'tenantId', fieldValue: activeTenantId },
            { fieldName: 'fecha', fieldValue: today }
          ],
          items => setDailyAssignments(items || [])
        )
      : subscribeFirebaseCollectionByField<DailyPersonnelAssignment>(
          'proclean_dailyAssignments',
          'fecha',
          today,
          items => setDailyAssignments(items || [])
        );

    return () => {
      unsubAreas?.();
      unsubCargos?.();
      unsubPersonnel?.();
      unsubAsgs?.();
    };
  }, [dataAccessKey, activeTenantId]);

  // Firestore owns the offline queue. Browser network events only inform the
  // user; pending writes are confirmed by snapshot metadata, never by a timer.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncToastMessage('📶 Conexión recuperada. Firebase está enviando las OT pendientes...');
      setTimeout(() => setSyncToastMessage(null), 4000);
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

  const [equipments, setEquipments] = useState<PlantEquipment[]>([]);

  // Load from Local REST DB on mount with Vercel production fallback & Real-time Firebase Sync
  useEffect(() => {
    if (!dataAccessKey) return;
    let firebaseUnsub: (() => void) | null = null;
    let firebaseUsersUnsub: (() => void) | null = null;

    const processDbData = async (db: any) => {
      // 1. Check Cloud DB (Firebase or Supabase) for Work Orders
      let cloudOrders: WorkOrder[] | null = null;
      if (isFirebaseConfigured) {
        const scopedTenantId = isFirebaseAuthRequired ? activeTenantId : undefined;
        cloudOrders = await fetchFirebaseWorkOrders(scopedTenantId);
        
        // Subscribe to real-time changes from Firestore on ALL devices
        firebaseUnsub = subscribeFirebaseWorkOrders((liveOrders, metadata) => {
          setWorkOrders(liveOrders);
          setPendingWorkOrderIds(new Set(metadata.pendingIds));
          setIsReadingFromCache(metadata.fromCache);
          if (metadata.pendingIds.length === 0 && !metadata.fromCache) setDbConnected(true);
        }, (error) => {
          console.error('Firestore work-order listener failed:', error);
          setSyncToastMessage('❌ No fue posible escuchar las OT en Firebase. Revisa permisos y conexión.');
        }, scopedTenantId);
      } else if (isSupabaseConfigured) {
        cloudOrders = await fetchSupabaseWorkOrders();
      }

      if (cloudOrders && Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setWorkOrders(cloudOrders);
      } else if (!isFirebaseConfigured && db.workOrders) {
        // Local seed data is a development-only fallback. Production Firebase
        // never resurrects work orders from localStorage or bundled JSON.
        setWorkOrders(db.workOrders);
      }

      // Firebase Auth mode loads only the signed-in profile for operational
      // users. Tenant administrators receive the tenant-scoped directory.
      if (isFirebaseAuthRequired && authenticatedUser) {
        const canListTenantUsers = ['ADMINISTRADOR_CONTRATO', 'SUPER_ADMIN'].includes(authenticatedUser.role);
        if (isFirebaseConfigured && canListTenantUsers) {
          const cloudUsers = await fetchFirebaseCollectionByField<UserAccount>('users', 'tenantId', activeTenantId);
          setUsers(cloudUsers || []);
          firebaseUsersUnsub = subscribeFirebaseCollectionByField<UserAccount>(
            'users',
            'tenantId',
            activeTenantId,
            liveUsers => setUsers(liveUsers || [])
          );
        } else {
          setUsers([authenticatedUser]);
        }
      }

      // Load legacy user accounts only while the staged Firebase Auth rollout
      // is disabled. Authenticated production never exposes the bundled list.
      if (!isFirebaseAuthRequired) {
      // Load Users: Cloud Firebase -> LocalStorage -> Seed JSON
      let cloudUsers: UserAccount[] | null = null;
      if (isFirebaseConfigured) {
        cloudUsers = await fetchFirebaseUsers();
        
        // Seed initial users to Firebase ONLY if cloud DB has no users (first time)
        const isUsersSeeded = localStorage.getItem('proclean_seeded_users_firebase');
        if ((!cloudUsers || cloudUsers.length === 0) && !isUsersSeeded && db.users && db.users.length > 0) {
          await syncAllUsersToFirebase(db.users, { preserveLegacyPassword: true });
          localStorage.setItem('proclean_seeded_users_firebase', 'true');
          cloudUsers = await fetchFirebaseUsers();
        }

        // Subscribe to real-time users sync on ALL devices
        firebaseUsersUnsub = subscribeFirebaseUsers((liveUsers) => {
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
      }

      // Master catalogues are cache-first and refreshed at most every six
      // hours per device. Operational data (OT and staffing) keeps dedicated
      // real-time listeners; avoiding permanent listeners over hundreds of
      // catalogue documents protects the Firestore free-tier read quota.
      const loadEntity = async <T,>(
        storageKey: string,
        colName: string,
        setter: React.Dispatch<React.SetStateAction<T>>,
        seedData: T,
        isSingleDoc: boolean = false
      ) => {
        let cloud: T | null = null;
        if (isFirebaseConfigured) {
          let hasCachedValue = false;
          const cached = localStorage.getItem(storageKey);
          if (cached) {
            try {
              setter(JSON.parse(cached));
              hasCachedValue = true;
            } catch {
              // Ignore corrupt browser cache and refresh it from Firestore.
            }
          }

          const refreshKey = `${storageKey}_cloud_refreshed_at`;
          const refreshedAt = Number(localStorage.getItem(refreshKey) || 0);
          const refreshIntervalMs = 6 * 60 * 60 * 1000;
          if (hasCachedValue && Date.now() - refreshedAt < refreshIntervalMs) return;

          if (isSingleDoc) {
            cloud = await fetchSingleDocFromFirebase<T>(colName, 'config');
          } else {
            const tenantId = activeTenantId;
            cloud = (isFirebaseAuthRequired
              ? await fetchFirebaseCollectionByField(colName, 'tenantId', tenantId)
              : await fetchFirebaseCollection(colName)) as unknown as T;
          }

          if (cloud !== null) {
            setter(cloud);
            localStorage.setItem(storageKey, JSON.stringify(cloud));
            localStorage.setItem(refreshKey, String(Date.now()));
          }
          return;
        }

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
        console.info('REST API opcional no configurada. Firebase permanece como fuente cloud y se cargan defaults sólo para entidades aún no migradas.', err);
        processDbData(initialDbData as any);
      });

    return () => {
      if (firebaseUnsub) firebaseUnsub();
      if (firebaseUsersUnsub) firebaseUsersUnsub();
    };
  }, [dataAccessKey, activeTenantId, authenticatedUser]);

  // Login & Logout Handlers
  const handleLoginSuccess = (user: UserAccount) => {
    setAuthenticatedUser(user);
    if (!isFirebaseAuthRequired) localStorage.setItem('siteclean_session', JSON.stringify(user));
    addAuditLog('CREACION', 'Sesión de Usuario', user.email, `Inicio de sesión exitoso como ${user.name}`, `Rol: ${user.role}`);
  };

  const handleLogout = () => {
    if (authenticatedUser) {
      addAuditLog('ELIMINACION', 'Sesión de Usuario', authenticatedUser.email, `Cierre de sesión de ${authenticatedUser.name}`);
    }
    setAuthenticatedUser(null);
    localStorage.removeItem('siteclean_session');
    if (isFirebaseAuthRequired) void logoutFromFirebase();
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
  const stampCurrentTenant = <T,>(value: T): T => {
    const tenantId = activeTenantId;
    if (Array.isArray(value)) {
      return value.map(item => (
        item && typeof item === 'object' ? { ...item, tenantId } : item
      )) as T;
    }
    if (value && typeof value === 'object') return { ...value, tenantId } as T;
    return value;
  };

  const updateWhiteLabel = (val: React.SetStateAction<WhiteLabelConfig>) => {
    setWhiteLabel(prev => {
      const requested = typeof val === 'function' ? val(prev) : val;
      const next = stampCurrentTenant({
        ...requested,
        companyLogoUrl: requested.companyLogoUrl || OFFICIAL_PROCLEAN_LOGO_URL
      });
      try { localStorage.setItem('proclean_whitelabel', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncSingleDocToFirebase('whitelabel', 'config', next);
      apiSaveWhiteLabel(next);
      addAuditLog('EDICION', 'Configuración de Marca', 'WhiteLabel', 'Actualización de parámetros visuales');
      return next;
    });
  };

  const updateUsers = (val: React.SetStateAction<UserAccount[]>) => {
    setUsers(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try {
        localStorage.setItem('proclean_users', JSON.stringify(next));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      if (isFirebaseConfigured) {
        syncAllUsersToFirebase(next, { preserveLegacyPassword: !isFirebaseAuthRequired });
      }
      addAuditLog('EDICION', 'Cuentas de Usuario', 'Users', 'Actualización de usuarios y roles fijos asignados');
      return next;
    });
  };

  const updateContracts = (val: React.SetStateAction<ClientContract[]>) => {
    setContracts(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_contracts', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('contracts', next);
      apiSaveContracts(next);
      addAuditLog('EDICION', 'Contratos', 'MultiContract', 'Actualización de clientes y contratos mineros');
      return next;
    });
  };

  const updateShifts = (val: React.SetStateAction<ShiftType[]>) => {
    setShifts(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_shifts', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('shifts', next);
      apiSaveShifts(next);
      addAuditLog('EDICION', 'Turnos', 'Shifts', 'Parametrización de turnos operacionales');
      return next;
    });
  };

  const updateContingencies = (val: React.SetStateAction<ContingencyReasonConfig[]>) => {
    setContingencies(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_contingencies', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('contingencies', next);
      apiSaveContingencies(next);
      addAuditLog('EDICION', 'Contingencias', 'Contingency', 'Actualización de motivos de detención');
      return next;
    });
  };

  const updatePlantAreas = (val: React.SetStateAction<PlantArea[]>) => {
    setPlantAreas(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_plant_areas', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('plant_areas', next);
      apiSavePlantAreas(next);
      return next;
    });
  };

  const updateSectors = (val: React.SetStateAction<Sector[]>) => {
    setSectors(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_sectors', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('sectors', next);
      apiSaveSectors(next);
      return next;
    });
  };

  const updateSubSectors = (val: React.SetStateAction<SubSector[]>) => {
    setSubSectors(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_sub_sectors', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('sub_sectors', next);
      apiSaveSubSectors(next);
      return next;
    });
  };

  const updateEquipments = (val: React.SetStateAction<PlantEquipment[]>) => {
    setEquipments(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_equipments', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('equipments', next);
      return next;
    });
  };

  const updateMachines = (val: React.SetStateAction<Machine[]>) => {
    setMachines(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_machines', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('machines', next);
      apiSaveMachines(next);
      return next;
    });
  };

  const updateWorkers = (val: React.SetStateAction<Worker[]>) => {
    setWorkers(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_workers', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) syncArrayToFirebase('workers', next);
      apiSaveWorkers(next);
      return next;
    });
  };

  const [targetEditOrder, setTargetEditOrder] = useState<WorkOrder | null>(null);

  const activeContract = contracts.find(c => c.id === activeContractId) || contracts[0];

  const monitorWorkOrderWrite = (operation: Promise<boolean>, action: string) => {
    void operation.then(ok => {
      if (!ok) {
        setSyncToastMessage(`❌ Firebase rechazó ${action}. El registro no quedó confirmado en la nube.`);
      }
    }).catch(error => {
      console.error(`Unexpected Firebase error while ${action}:`, error);
      setSyncToastMessage(`❌ Error inesperado al ${action}.`);
    });
  };

  const handleAddWorkOrder = (newOrder: Omit<WorkOrder, 'id'>) => {
    const order: WorkOrder = {
      ...newOrder,
      id: globalThis.crypto?.randomUUID?.() || Date.now().toString(),
      tenantId: authenticatedUser?.tenantId || 'tenant_cmz'
    };
    const updated = [order, ...workOrders];
    setWorkOrders(updated);
    if (isFirebaseConfigured) {
      monitorWorkOrderWrite(syncWorkOrderToFirebase(order), 'crear la orden de trabajo');
    }
    addAuditLog('CREACION', 'Orden de Trabajo', order.sapCode, `Creación de OT en ${order.equipoCorrea} (${order.areaName || 'General'}) por ${authenticatedUser?.name}`, `HH Est: ${order.estimatedHours}h | Real: ${order.realHours}h`);
  };

  const handleUpdateWorkOrder = (id: string, updatedFields: Partial<WorkOrder>) => {
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ Sin conexión sólo se permite crear nuevas OT. La edición requiere conexión.');
      return;
    }
    const target = workOrders.find(o => o.id === id);
    const updatedObj = target ? { ...target, ...updatedFields } : null;
    const updated = workOrders.map(o => o.id === id ? { ...o, ...updatedFields } : o);
    setWorkOrders(updated);
    if (isFirebaseConfigured && updatedObj) {
      monitorWorkOrderWrite(syncWorkOrderToFirebase(updatedObj), 'actualizar la orden de trabajo');
    }
    
    let diffStr = undefined;
    if (target && updatedFields.realHours && target.realHours !== updatedFields.realHours) {
      diffStr = `HH Reales: ${target.realHours}h ➔ ${updatedFields.realHours}h`;
    }
    
    addAuditLog('EDICION', 'Orden de Trabajo', target?.sapCode || id, `Modificación de OT por ${authenticatedUser?.name}`, diffStr);
  };

  const handleItoApproveWorkOrder = (id: string, approverName: string, comments?: string, signatureDataUrl?: string) => {
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ La aprobación ITO requiere conexión para evitar conflictos.');
      return;
    }
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
    if (isFirebaseConfigured && updatedObj) {
      monitorWorkOrderWrite(syncWorkOrderToFirebase(updatedObj), 'aprobar la orden de trabajo');
    }
    addAuditLog('APROBACION_ITO', 'Orden de Trabajo', target?.sapCode || id, `Conformidad ITO otorgada por ${approverName || authenticatedUser?.name}`, `Estado: PENDIENTE ➔ APROBADO_MANDANTE ${signatureDataUrl ? '(Firma Digital Estampada)' : ''}`);
  };

  const handleDeleteWorkOrder = (id: string) => {
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ La eliminación de una OT requiere conexión.');
      return;
    }
    const target = workOrders.find(o => o.id === id);
    const updated = workOrders.filter(o => o.id !== id);
    setWorkOrders(updated);
    if (isFirebaseConfigured) {
      monitorWorkOrderWrite(deleteFirebaseWorkOrder(id), 'eliminar la orden de trabajo');
    }
    addAuditLog('ELIMINACION', 'Orden de Trabajo', target?.sapCode || id, `Eliminación de la OT por ${authenticatedUser?.name}`);
  };

  const handleSaveDailyAssignments = async (newAssignments: DailyPersonnelAssignment[]) => {
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ La dotación requiere conexión. No se aplicaron cambios.');
      return;
    }

    const previousAssignments = dailyAssignments;
    const tenantAssignments = newAssignments.map(assignment => ({
      ...assignment,
      tenantId: authenticatedUser?.tenantId || 'tenant_cmz'
    }));
    setDailyAssignments(tenantAssignments);
    setSyncToastMessage('Guardando dotación en Firebase...');

    const saved = await replaceFirebaseCollection(
      'proclean_dailyAssignments',
      previousAssignments,
      tenantAssignments
    );

    if (saved) {
      setSyncToastMessage('✅ Dotación confirmada en Firebase.');
    } else {
      setDailyAssignments(previousAssignments);
      setSyncToastMessage('❌ No fue posible guardar la dotación. Se restauró el estado anterior.');
    }
    setTimeout(() => setSyncToastMessage(null), 4000);
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
            
            {/* Network and Firestore-confirmed pending write status */}
            <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 800, color: isOnline ? '#047857' : '#B91C1C', backgroundColor: isOnline ? '#ECFDF5' : '#FEF2F2', padding: '4px 10px', borderRadius: '16px' }}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? (isReadingFromCache ? 'Conectando a Firebase' : 'En línea') : 'Modo Terreno'}</span>
              {pendingWorkOrderIds.size > 0 && (
                <span
                  style={{ backgroundColor: '#F59E0B', color: '#FFF', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', marginLeft: '4px' }}
                  title="OT almacenadas por Firebase y pendientes de confirmación del servidor"
                >
                  {pendingWorkOrderIds.size} OT pend.
                </span>
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
              pendingWorkOrderIds={pendingWorkOrderIds}
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
              onSaveAssignments={handleSaveDailyAssignments}
              shifts={shifts}
              currentRole={currentRole}
              userEmail={authenticatedUser?.email}
              userName={authenticatedUser?.name}
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
              tenantId={authenticatedUser?.tenantId || 'tenant_cmz'}
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
