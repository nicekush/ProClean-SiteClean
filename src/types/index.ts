export type UserRole = 
  | 'SUPERVISOR_TERRENO' 
  | 'ADMINISTRADOR_CONTRATO' 
  | 'ITO_MANDANTE' 
  | 'SUPER_ADMIN';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  contractId?: string;
  active: boolean;
  avatarColor?: string;
  lastLogin?: string;
}

export interface ShiftType {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  colorHex: string;
  breakHours?: number;
  latenessToleranceMinutes?: number;
}

export type WorkOrderStatus = 
  | 'PROGRAMADO' 
  | 'EN_EJECUCION' 
  | 'EN_PROCESO'
  | 'PENDIENTE_APROBACION_ITO' 
  | 'APROBADO_MANDANTE' 
  | 'RECHAZADO_CONTINGENCIA' 
  | 'CONTINGENCIA'
  | 'COMPLETADO';

export interface CustomColumn {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

export type TaskType = 'PLANIFICADO' | 'MANTENIMIENTO_PROGRAMADO' | 'EMERGENTE';

export interface WorkOrder {
  id: string;
  tenantId?: string;
  semana: number;
  dia: string;
  sapCode: string; // N° OT / SAP
  equipoCorrea: string; // Equipo / Sector
  operationDetail: string; // Operación / Detalle
  headcount: number;
  estimatedHours: number;
  realHours: number;
  shiftId: string; // Dynamic shift reference
  shiftName: string;
  vehiclePatent?: string; // Patente / Vehículo
  status: WorkOrderStatus;
  contingencyReason?: string;
  imageBeforeUrl?: string;
  imageAfterUrl?: string;
  customValues?: Record<string, string>;
  
  // ITO Mandante Sign-off & Digital Signature fields
  itoApprovalDate?: string;
  itoApproverName?: string;
  itoComments?: string;
  itoSignatureDataUrl?: string; // Digital signature image data URL
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  areaId?: string;
  areaName?: string;
  sectorId?: string;
  sectorName?: string;
  equipmentId?: string;
  equipmentName?: string;
  subSectorId?: string;
  subSectorName?: string;
  selectedSubSectorNames?: string[];
  hasManualLabor?: boolean;
  hasEquipment?: boolean;
  taskType?: 'PLANIFICADO' | 'MANTENIMIENTO_PROGRAMADO' | 'EMERGENTE';
  cubicMetersRemoved?: number;
  fleetTripsCount?: number;
  bucketCapacityM3?: number;
  machineHours?: number; // Horas Máquina (HM) (por equipo)
  executionDate?: string; // Fecha de Ejecución (YYYY-MM-DD)
}

export interface AuditLogEntry {
  id: string;
  tenantId?: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: 'CREACION' | 'EDICION' | 'CAMBIO_ESTADO' | 'APROBACION_ITO' | 'RECHAZO_ITO' | 'ELIMINACION' | 'RESET';
  entityName: string;
  entityId: string;
  details: string;
  diffSummary?: string;
}

export interface PlantArea {
  id: string;
  name: string;
  code: string;
}

export interface Sector {
  id: string;
  areaId?: string;
  areaName?: string;
  name: string;
  code: string;
  description?: string;
}

export interface PlantEquipment {
  id: string;
  sectorId?: string;
  sectorName?: string;
  name: string;
  code: string;
}

export interface SubSector {
  id: string;
  sectorId?: string;
  sectorName?: string;
  equipmentId?: string;
  equipmentName?: string;
  name: string;
  code: string;
}

export interface Machine {
  id: string;
  name: string;
  patent: string;
  type?: string;
  capacity?: string;
  capacityM3?: number;
  status: 'DISPONIBLE' | 'MANTENCION' | 'FUERA_SERVICIO';
}

export interface Worker {
  id: string;
  name: string;
  role: string;
  shiftId?: string;
  shiftName?: string;
  rut?: string;
  rutDni?: string;
  drivingLicenseType?: string;
  examExpiryDate?: string;
  active?: boolean;
}

export interface ContingencyReasonConfig {
  id: string;
  code: string;
  name: string;
  category: string;
  absorbedBy?: 'MANDANTE' | 'CONTRATISTA';
}

export interface ClientContract {
  id: string;
  clientName: string; // Ej: Minera Escondida, Codelco, CMZ
  contractNumber: string;
  siteLocation: string;
  contractAdminName?: string;
  contractAdminEmail?: string;
  startDate?: string;
  endDate?: string;
  costCenter?: string;
  clientLogoUrl?: string;
  active: boolean;
}

export interface ManualLaborConfig {
  wheelbarrowsPerDay: number;
  effectiveHoursPerDay: number;
  wheelbarrowCapacityM3: number;
}

export interface WhiteLabelConfig {
  companyName: string;
  companyLogoUrl?: string;
  brandBadgeText: string;
  primaryColor: string;
  actionColor: string;
  tableHeaderColor: string;
  headerTitle: string;
  targetAdherence: number;
  enablePhotoEvidence: boolean;
  manualLaborConfig?: ManualLaborConfig;
  columnLabels: {
    semana: string;
    dia: string;
    sapCode: string;
    equipoCorrea: string;
    operationDetail: string;
    vehiclePatent: string;
    headcount: string;
    estimatedHours: string;
    realHours: string;
    status: string;
  };
  customColumns: CustomColumn[];
}

export interface PersonnelMember {
  id: string;
  nombre: string;
  rut?: string;
  grupo: 'A' | 'B' | 'AMBOS';
  tipo: 'PLANTA' | 'SPOT';
  estado: 'Activo' | 'Inactivo';
  cargoBaseId?: string;
  cargoBaseName?: string;
}

export interface CargoConfig {
  id: string;
  nombre: string;
  code?: string;
  restrictedAreaIds?: string[];
}

export interface AreaCargoTarget {
  id: string;
  areaId: string;
  cargoId: string;
  cantidad: number;
  equipoId?: string;
}

export interface CoverageArea {
  id: string;
  name: string;
  code: string;
  turnoId: 't_dia' | 't_noche' | 't_4x3';
  orden: number;
}

export interface DailyPersonnelAssignment {
  id: string;
  areaId: string;
  cargoReqId?: string;
  cargoId: string;
  cargoName: string;
  slotIndex: number;
  fecha: string;
  grupo: 'A' | 'B';
  shiftId: string;
  personId: string;
  personName: string;
  userEmail?: string;
  createdAt?: string;
}

