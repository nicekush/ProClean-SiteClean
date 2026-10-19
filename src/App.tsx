import { PermissionContext } from './security/PermissionContext';
import { ROLE_LABELS, can as hasPermission, canOpenTab, TAB_PERMISSIONS, inScope } from './security/permissions';
import { subscribeScopedData } from './api/scopedData';
import { subscribeOwnProfile } from './api/access';
import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { WorkOrdersGrid } from './components/WorkOrdersGrid';
import { OperationalParameters } from './components/OperationalParameters';
import { SystemConfig } from './components/SystemConfig';
import { AdherenceDashboard } from './components/AdherenceDashboard';
import { ReportingControl } from './components/ReportingControl';
import { createTrace, editTrace, recoverAuthors } from './utils/reportability';
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
import { isSupabaseConfigured } from './api/supabase';
import { isFirebaseConfigured, syncWorkOrderToFirebase, patchWorkOrderResponsibility, deleteFirebaseWorkOrder, syncSingleDocToFirebase, replaceFirebaseCollection } from './api/firebase';
import { 
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
    localStorage.removeItem('siteclean_session');
    localStorage.removeItem('proclean_users');
    return subscribeFirebaseSession(user => setAuthenticatedUser(user));
  }, []);

  const activeTenantId = authenticatedUser?.tenantId || 'tenant_cmz';
  const dataAccessKey = authenticatedUser
    ? JSON.stringify([authenticatedUser.id, activeTenantId, authenticatedUser.role, authenticatedUser.active, authenticatedUser.permissions, authenticatedUser.accessScope, authenticatedUser.contractId, authenticatedUser.allowedAreaIds])
    : '';

  // Users Accounts Database State
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loadedAccessKey, setLoadedAccessKey] = useState('');

  // Derived role strictly from authenticatedUser
  const currentRole = authenticatedUser?.role || 'SUPERVISOR_TERRENO';

  const can = useCallback((permission: string) => hasPermission(authenticatedUser, permission), [authenticatedUser]);
  useEffect(() => {
    if (authenticatedUser && !canOpenTab(authenticatedUser, activeTab)) {
      setActiveTab(Object.keys(TAB_PERMISSIONS).find(tab => canOpenTab(authenticatedUser, tab)) || 'no-access');
    }
  }, [authenticatedUser, activeTab]);
  const sessionUserId = authenticatedUser?.id;
  useEffect(() => {
    if (isFirebaseAuthRequired || !sessionUserId) return;
    return subscribeOwnProfile(sessionUserId, profile => {
      setAuthenticatedUser(previous => JSON.stringify(previous) === JSON.stringify(profile) ? previous : profile);
      if (profile) localStorage.setItem('siteclean_session', JSON.stringify(profile));
      else localStorage.removeItem('siteclean_session');
    });
  }, [sessionUserId]);

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

  // A new access key tears down every listener and clears data from the previous scope.
  useEffect(() => {
    setWorkOrders([]); setUsers([]); setAuditLogs([]); setPersonnel([]); setDailyAssignments([]);
    setContracts([]); setMachines([]); setWorkers([]); setCoverageAreas([]); setCargos([]);
    setPlantAreas([]); setSectors([]); setEquipments([]); setSubSectors([]); setShifts([]); setContingencies([]);
    setPendingWorkOrderIds(new Set()); setDbConnected(false);
    setLoadedAccessKey(dataAccessKey);
    if (!authenticatedUser || !dataAccessKey) return;
    const profile = authenticatedUser;
    let disposed = false;
    const unsubs: Array<() => void> = [];
    const error = (err: unknown) => {
      console.error('Scoped data subscription failed:', err);
      if (!disposed) setSyncToastMessage('No fue posible consultar algunos datos. Revisa los permisos y la conexión.');
    };
    const listen = <T,>(collection: string, setter: (items: T[]) => void, options = {}) => {
      unsubs.push(subscribeScopedData<T>(collection, profile, (items, fromCache, pendingIds) => {
        if (disposed) return;
        setter(items);
        if (['work_orders', 'work_order_details', 'work_order_metrics'].includes(collection)) {
          setIsReadingFromCache(fromCache); setPendingWorkOrderIds(new Set(pendingIds));
        }
        if (!fromCache) setDbConnected(true);
      }, error, options));
    };
    if (can('orders.view') || can('map.view') || can('kpi.view')) {
      const source = can('evidence.view') ? 'work_orders' : can('orders.view') ? 'work_order_details' : 'work_order_metrics';
      listen<WorkOrder>(source, setWorkOrders, { contract: true, areas: true });
    }
    if (can('users.view')) listen<UserAccount>('users', setUsers, { contract: true });
    else setUsers([profile]);
    if (can('audit.view')) listen<AuditLogEntry>('audit_logs', setAuditLogs, { contract: true });
    // Plant names are reference data, required to label maps and operational forms.
    if (can('structure.view') || can('orders.view') || can('map.view') || can('kpi.view')) {
      listen<PlantArea>('plant_areas', setPlantAreas); listen<Sector>('sectors', setSectors);
      listen<PlantEquipment>('equipments', setEquipments); listen<SubSector>('sub_sectors', setSubSectors);
    }
    if (can('orders.view') || can('map.view') || can('machines.view')) listen<Machine>('machines', setMachines);
    if (can('workers.view')) listen<Worker>('workers', setWorkers);
    if (can('personnel.view')) listen<PersonnelMember>('proclean_personnel', setPersonnel);
    if (can('coverage.view') || can('coverageConfig.view')) {
      listen<CoverageArea>('proclean_coverageAreas', setCoverageAreas);
      listen<CargoConfig>('proclean_cargos', setCargos);
    }
    if (can('coverage.view')) listen<DailyPersonnelAssignment>(can('coverage.names') ? 'proclean_dailyAssignments' : 'coverage_public', setDailyAssignments, { contract: true, today: true });
    listen<ClientContract>('contracts', setContracts, { contract: true });
    listen<ShiftType>('shifts', setShifts);
    if (can('orders.create') || can('orders.edit') || can('contingencies.manage')) listen<ContingencyReasonConfig>('contingencies', setContingencies);
    listen<WhiteLabelConfig>('whitelabel', items => { if (items[0]) setWhiteLabel(items[0]); });
    return () => { disposed = true; unsubs.forEach(unsub => unsub()); };
  }, [dataAccessKey, authenticatedUser, can]);

  const handleAccessUserSaved = (saved: UserAccount | null, removedId?: string) => {
    setUsers(prev => saved ? [...prev.filter(u => u.id !== saved.id), saved] : prev.filter(u => u.id !== removedId));
    if (!isFirebaseAuthRequired) {
      const next = saved ? [...users.filter(u => u.id !== saved.id), saved] : users.filter(u => u.id !== removedId);
      localStorage.setItem('proclean_users', JSON.stringify(next));
    }
  };

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
      tenantId: activeTenantId,
      userId: authenticatedUser.id,
      recordedAt: new Date().toISOString(),
      timestamp: new Date().toLocaleString('es-CL'),
      userName: `${authenticatedUser.name} (${authenticatedUser.role})`,
      userRole: currentRole,
      action,
      entityName,
      entityId,
      details,
      diffSummary
    };

    const log = JSON.parse(JSON.stringify({ ...entry, id: crypto.randomUUID(), contractId: authenticatedUser.contractId || activeContractId }));
    setAuditLogs(prev => [log, ...prev]);
    if (isFirebaseConfigured) void syncSingleDocToFirebase('audit_logs', log.id, log);
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
    if (!can('branding.manage') && !can('manualMatrix.manage')) return;
    setWhiteLabel(prev => {
      let requested = typeof val === 'function' ? val(prev) : val;
      if (!can('branding.manage')) requested = { ...prev, manualLaborConfig: requested.manualLaborConfig };
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

  const updateContracts = (val: React.SetStateAction<ClientContract[]>) => {
    if (!can('contracts.manage') && !can('branding.manage')) return;
    setContracts(prev => {
      const requested = typeof val === 'function' ? val(prev) : val;
      const next = stampCurrentTenant(can('contracts.manage') ? requested : prev.map(contract => ({ ...contract, clientLogoUrl: requested.find(item => item.id === contract.id)?.clientLogoUrl || contract.clientLogoUrl || '' })));
      try { localStorage.setItem('proclean_contracts', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) monitorWorkOrderWrite(replaceFirebaseCollection('contracts', prev, next), 'guardar los contratos');
      apiSaveContracts(next);
      addAuditLog('EDICION', 'Contratos', 'MultiContract', 'Actualización de clientes y contratos mineros');
      return next;
    });
  };

  const updateShifts = (val: React.SetStateAction<ShiftType[]>) => {
    if (!can('shifts.manage')) return;
    setShifts(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_shifts', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) monitorWorkOrderWrite(replaceFirebaseCollection('shifts', prev, next), 'guardar los turnos');
      apiSaveShifts(next);
      addAuditLog('EDICION', 'Turnos', 'Shifts', 'Parametrización de turnos operacionales');
      return next;
    });
  };

  const updateContingencies = (val: React.SetStateAction<ContingencyReasonConfig[]>) => {
    if (!can('contingencies.manage')) return;
    setContingencies(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_contingencies', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) monitorWorkOrderWrite(replaceFirebaseCollection('contingencies', prev, next), 'guardar los motivos de contingencia');
      apiSaveContingencies(next);
      addAuditLog('EDICION', 'Contingencias', 'Contingency', 'Actualización de motivos de detención');
      return next;
    });
  };

  const updatePlantAreas = (val: React.SetStateAction<PlantArea[]>) => {
    if (!can('structure.manage')) return;
    setPlantAreas(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_plant_areas', JSON.stringify(next)); } catch (e) {}
      apiSavePlantAreas(next);
      return next;
    });
  };

  const updateSectors = (val: React.SetStateAction<Sector[]>) => {
    if (!can('structure.manage')) return;
    setSectors(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_sectors', JSON.stringify(next)); } catch (e) {}
      apiSaveSectors(next);
      return next;
    });
  };

  const updateSubSectors = (val: React.SetStateAction<SubSector[]>) => {
    if (!can('structure.manage')) return;
    setSubSectors(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_sub_sectors', JSON.stringify(next)); } catch (e) {}
      apiSaveSubSectors(next);
      return next;
    });
  };

  const updateEquipments = (val: React.SetStateAction<PlantEquipment[]>) => {
    if (!can('structure.manage')) return;
    setEquipments(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_equipments', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const updateMachines = (val: React.SetStateAction<Machine[]>) => {
    if (!can('machines.manage')) return;
    setMachines(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_machines', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) monitorWorkOrderWrite(replaceFirebaseCollection('machines', prev, next), 'guardar la maquinaria');
      apiSaveMachines(next);
      return next;
    });
  };

  const updateWorkers = (val: React.SetStateAction<Worker[]>) => {
    if (!can('workers.manage')) return;
    setWorkers(prev => {
      const next = stampCurrentTenant(typeof val === 'function' ? val(prev) : val);
      try { localStorage.setItem('proclean_workers', JSON.stringify(next)); } catch (e) {}
      if (isFirebaseConfigured) monitorWorkOrderWrite(replaceFirebaseCollection('workers', prev, next), 'guardar la nómina de trabajadores');
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
    if (!authenticatedUser || !can('orders.create')) return;
    const order: WorkOrder = {
      ...newOrder,
      ...createTrace(authenticatedUser),
      contractId: authenticatedUser.accessScope === 'CONTRACT' ? authenticatedUser.contractId : activeContractId,
      id: globalThis.crypto?.randomUUID?.() || Date.now().toString(),
      tenantId: authenticatedUser?.tenantId || 'tenant_cmz'
    };
    if (!inScope(authenticatedUser, order)) return;
    if (!can('evidence.upload')) for (const key of ['imageBeforeUrl','imageAfterUrl','beforePhotoUrl','afterPhotoUrl','itoSignatureDataUrl'] as const) delete order[key];
    const updated = [order, ...workOrders];
    setWorkOrders(updated);
    if (isFirebaseConfigured) {
      monitorWorkOrderWrite(syncWorkOrderToFirebase(order), 'crear la orden de trabajo');
    }
    addAuditLog('CREACION', 'Orden de Trabajo', order.id, `Creación de OT en ${order.equipoCorrea} (${order.areaName || 'General'}) por ${authenticatedUser?.name}`, `HH Est: ${order.estimatedHours}h | Real: ${order.realHours}h`);
  };

  const handleUpdateWorkOrder = (id: string, updatedFields: Partial<WorkOrder>) => {
    if (!authenticatedUser) return;
    const keys = Object.keys(updatedFields);
    const photos = ['imageBeforeUrl','imageAfterUrl','beforePhotoUrl','afterPhotoUrl'];
    const assign = ['responsibleSupervisorId','responsibleSupervisorName'];
    const permitted = keys.length > 0 && (keys.every(k => photos.includes(k)) ? can('evidence.upload') : keys.every(k => assign.includes(k)) ? can('reporting.assign') : can('orders.edit'));
    if (!permitted) return;
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ Sin conexión sólo se permite crear nuevas OT. La edición requiere conexión.');
      return;
    }
    const target = workOrders.find(o => o.id === id);
    if (!target || !inScope(authenticatedUser, target)) return;
    const updatedObj = editTrace(target, updatedFields, authenticatedUser);
    const updated = workOrders.map(o => o.id === id ? updatedObj : o);
    setWorkOrders(updated);
    if (isFirebaseConfigured && updatedObj) {
      monitorWorkOrderWrite(keys.every(k => ['responsibleSupervisorId','responsibleSupervisorName'].includes(k)) ? patchWorkOrderResponsibility(updatedObj) : syncWorkOrderToFirebase(updatedObj), 'actualizar la orden de trabajo');
    }
    
    let diffStr = undefined;
    if (target && updatedFields.realHours && target.realHours !== updatedFields.realHours) {
      diffStr = `HH Reales: ${target.realHours}h ➔ ${updatedFields.realHours}h`;
    }
    
    addAuditLog('EDICION', 'Orden de Trabajo', id, `Modificación de OT por ${authenticatedUser?.name}`, diffStr);
  };

  const handleItoApproveWorkOrder = (id: string, approverName: string, comments?: string, signatureDataUrl?: string) => {
    if (!authenticatedUser || !can('orders.approve')) return;
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ La aprobación ITO requiere conexión para evitar conflictos.');
      return;
    }
    const target = workOrders.find(o => o.id === id);
    if (!target || !inScope(authenticatedUser, target)) return;
    const approvalDate = new Date().toLocaleString('es-CL');
    const updatedObj = target ? { 
      ...target, 
      updatedById: authenticatedUser.id,
      updatedByName: authenticatedUser.name,
      updatedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedById: authenticatedUser.id,
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
    addAuditLog('APROBACION_ITO', 'Orden de Trabajo', id, `Conformidad ITO otorgada por ${approverName || authenticatedUser?.name}`, `Estado: PENDIENTE ➔ APROBADO_MANDANTE ${signatureDataUrl ? '(Firma Digital Estampada)' : ''}`);
  };

  const handleDeleteWorkOrder = (id: string) => {
    const target = workOrders.find(o => o.id === id);
    if (!authenticatedUser || !can('orders.delete') || !target || !inScope(authenticatedUser, target)) return;
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ La eliminación de una OT requiere conexión.');
      return;
    }
    const updated = workOrders.filter(o => o.id !== id);
    setWorkOrders(updated);
    if (isFirebaseConfigured) {
      monitorWorkOrderWrite(deleteFirebaseWorkOrder(id), 'eliminar la orden de trabajo');
    }
    addAuditLog('ELIMINACION', 'Orden de Trabajo', id, `Eliminación de la OT por ${authenticatedUser?.name}`);
  };

  const handleSaveDailyAssignments = async (newAssignments: DailyPersonnelAssignment[]) => {
    if (!can('coverage.edit')) return;
    if (!navigator.onLine) {
      setSyncToastMessage('⚠️ La dotación requiere conexión. No se aplicaron cambios.');
      return;
    }

    const previousAssignments = dailyAssignments;
    const tenantAssignments = newAssignments.map(assignment => ({
      ...assignment,
      contractId: authenticatedUser?.accessScope === 'CONTRACT' ? authenticatedUser.contractId : activeContractId,
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
      setSyncToastMessage('❌ No se completó el guardado de dotación. Revisa los registros confirmados antes de reintentar.');
    }
    setTimeout(() => setSyncToastMessage(null), 4000);
  };

  const handleResetBlankSlate = () => {
    if (!can('maintenance.reset')) return;
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
      case 'CLIENTE_VISUALIZADOR':
        return <ShieldCheck size={14} style={{ color: '#475569' }} />;
      case 'SUPER_ADMIN':
        return <Wrench size={14} style={{ color: '#B91C1C' }} />;
    }
  };

  // Render Login View if not authenticated
  if (!authenticatedUser) {
    return <LoginView whiteLabel={whiteLabel} onLoginSuccess={handleLoginSuccess} />;
  }

  if (loadedAccessKey !== dataAccessKey) return <div className="card" role="status">Actualizando accesos…</div>;

  return (
    <PermissionContext.Provider value={authenticatedUser}>
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
                  {ROLE_LABELS[authenticatedUser.role]}
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
          {activeTab === 'no-access' && <div className="card"><h2>Sin módulos habilitados</h2><p>Tu cuenta está activa, pero no tiene permisos de consulta. Contacta al administrador.</p></div>}
          {activeTab === 'work-orders' && canOpenTab(authenticatedUser, 'work-orders') && (
            <WorkOrdersGrid 
              workOrders={recoverAuthors(workOrders, auditLogs, users)}
              users={users}
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

          {activeTab === 'personnel-coverage' && canOpenTab(authenticatedUser, 'personnel-coverage') && (
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

          {activeTab === 'map-operational' && canOpenTab(authenticatedUser, 'map-operational') && (
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

          {activeTab === 'parameters' && canOpenTab(authenticatedUser, 'parameters') && (
            <OperationalParameters 
              tenantId={authenticatedUser?.tenantId || 'tenant_cmz'}
              plantAreas={plantAreas}
              setPlantAreas={updatePlantAreas}
              sectors={sectors}
              setSectors={updateSectors}
              equipments={equipments}
              setEquipments={updateEquipments}
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

          {activeTab === 'system-config' && canOpenTab(authenticatedUser, 'system-config') && (
            <SystemConfig plantAreas={plantAreas} onAccessUserSaved={handleAccessUserSaved}
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
              onResetBlankSlate={handleResetBlankSlate}
            />
          )}

          {activeTab === 'dashboard' && canOpenTab(authenticatedUser, 'dashboard') && (
            <AdherenceDashboard 
              workOrders={workOrders}
              sectors={sectors}
              equipments={equipments}
              whiteLabel={whiteLabel}
              generatedBy={authenticatedUser?.name || authenticatedUser?.email}
              contractLabel={activeContract ? `${activeContract.clientName} · Contrato ${activeContract.contractNumber} · ${activeContract.siteLocation}` : undefined}
            />
          )}

          {activeTab === 'audit-logs' && canOpenTab(authenticatedUser, 'audit-logs') && (
            <AuditLogViewer auditLogs={auditLogs} />
          )}
          {activeTab === 'reporting-control' && can('reporting.view') && (
            <ReportingControl orders={recoverAuthors(workOrders.filter(o => o.tenantId === activeTenantId), auditLogs, users)} users={users.filter(u => u.tenantId === activeTenantId)} fromCache={isReadingFromCache} pendingIds={pendingWorkOrderIds} onUpdate={handleUpdateWorkOrder} onOpen={o => { setTargetEditOrder(workOrders.find(original => original.id === o.id) || null); setActiveTab('work-orders'); }} />
          )}

          {activeTab === 'evidences' && canOpenTab(authenticatedUser, 'evidences') && (
            <PhotoEvidence 
              workOrders={workOrders} 
              onUpdateWorkOrder={can('evidence.upload') ? handleUpdateWorkOrder : undefined}
            />
          )}
        </main>
      </div>
    </div>
    </PermissionContext.Provider>
  );
}

export default App;

