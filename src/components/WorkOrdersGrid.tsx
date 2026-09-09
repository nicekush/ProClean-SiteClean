import React, { useState, useRef, useEffect } from 'react';
import type { WorkOrder, WorkOrderStatus, WhiteLabelConfig, ShiftType, UserRole, Machine, ContingencyReasonConfig, PlantArea, Sector, SubSector, TaskType, StaffingType, PlantEquipment } from '../types';
import { Plus, Filter, Search, CheckCircle2, Clock, AlertTriangle, FileSpreadsheet, Edit, Trash2, X, Save, UserCheck, Eraser, PenTool, AlertOctagon, Camera, Upload, Layers, MapPin, Grid, Wrench, Users, Tag, Cpu, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

interface WorkOrdersGridProps {
  workOrders: WorkOrder[];
  pendingWorkOrderIds?: ReadonlySet<string>;
  onAddWorkOrder: (order: Omit<WorkOrder, 'id'>) => void;
  onUpdateWorkOrder: (id: string, updated: Partial<WorkOrder>) => void;
  onDeleteWorkOrder: (id: string) => void;
  onItoApproveWorkOrder: (id: string, approverName: string, comments?: string, signatureDataUrl?: string) => void;
  whiteLabel: WhiteLabelConfig;
  shifts: ShiftType[];
  machines: Machine[];
  plantAreas: PlantArea[];
  sectors: Sector[];
  equipments?: PlantEquipment[];
  subSectors: SubSector[];
  contingencies?: ContingencyReasonConfig[];
  currentRole: UserRole;
  targetEditOrder?: WorkOrder | null;
  onClearTargetEditOrder?: () => void;
}

const getOrderDateMetadata = (localDate: string) => {
  if (!localDate) return { executionDate: '', semana: 0, dia: '' };
  const now = new Date(`${localDate}T12:00:00`);
  const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const dia = now.toLocaleDateString('es-CL', { weekday: 'long', day: '2-digit', month: '2-digit' });
  return { executionDate: localDate, semana, dia: dia.charAt(0).toUpperCase() + dia.slice(1) };
};

const getTodayOrderDefaults = () => {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return getOrderDateMetadata(localDate);
};

const getWorkOrderResourceFlags = (order: WorkOrder) => {
  const hasExplicitFlags = typeof order.hasManualLabor === 'boolean' || typeof order.hasEquipment === 'boolean';
  if (hasExplicitFlags) return { manual: order.hasManualLabor === true, equipment: order.hasEquipment === true };
  return {
    manual: (order.headcount || 0) > 0 && (order.realHours || 0) > 0,
    equipment: Boolean(order.vehiclePatent?.trim()) || (order.fleetTripsCount || 0) > 0 || (order.machineHours || 0) > 0
  };
};

type WorkOrderSortKey = 'executionDate' | 'sapCode' | 'taskType' | 'areaName' | 'sectorName' | 'equipmentName' | 'resourceMode' | 'headcount' | 'hh' | 'hm' | 'evidence' | 'volume' | 'status';
type SortDirection = 'asc' | 'desc';
type WorkOrderSort = { key: WorkOrderSortKey; direction: SortDirection };

const WORK_ORDER_SORT_STORAGE_KEY = 'proclean-work-orders-sort-v1';
const DEFAULT_WORK_ORDER_SORT: WorkOrderSort[] = [
  { key: 'executionDate', direction: 'desc' },
  { key: 'sapCode', direction: 'desc' },
];
const SORTABLE_KEYS = new Set<WorkOrderSortKey>(['executionDate', 'sapCode', 'taskType', 'areaName', 'sectorName', 'equipmentName', 'resourceMode', 'headcount', 'hh', 'hm', 'evidence', 'volume', 'status']);
const SORT_LABELS: Record<WorkOrderSortKey, string> = {
  executionDate: 'Fecha', sapCode: 'OT', taskType: 'Tipo', areaName: 'Área', sectorName: 'Sector',
  equipmentName: 'Equipo', resourceMode: 'Modalidad', headcount: 'Dotación', hh: 'HH', hm: 'HM',
  evidence: 'Evidencia', volume: 'Volumen', status: 'Estado',
};
const statusSortOrder: Record<WorkOrderStatus, number> = {
  PROGRAMADO: 1, EN_EJECUCION: 2, EN_PROCESO: 3, PENDIENTE_APROBACION_ITO: 4,
  CONTINGENCIA: 5, RECHAZADO_CONTINGENCIA: 6, APROBADO_MANDANTE: 7, COMPLETADO: 8,
};
const textCollator = new Intl.Collator('es-CL', { numeric: true, sensitivity: 'base' });

const getStoredWorkOrderSort = (): WorkOrderSort[] => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(WORK_ORDER_SORT_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is WorkOrderSort =>
      Boolean(item) && SORTABLE_KEYS.has(item.key) && (item.direction === 'asc' || item.direction === 'desc')
    ).slice(0, 4);
  } catch {
    return [];
  }
};

const getWorkOrderSortValue = (order: WorkOrder, key: WorkOrderSortKey): string | number => {
  const flags = getWorkOrderResourceFlags(order);
  switch (key) {
    case 'executionDate': return order.executionDate || '';
    case 'sapCode': return order.sapCode || '';
    case 'taskType': return order.taskType || 'PLANIFICADO';
    case 'areaName': return order.areaName || '';
    case 'sectorName': return order.sectorName || '';
    case 'equipmentName': return order.equipmentName || order.equipoCorrea || '';
    case 'resourceMode': return flags.manual && flags.equipment ? 'Mixto' : flags.equipment ? 'Maquinaria' : 'Manual';
    case 'headcount': return Number(order.headcount) || 0;
    case 'hh': return Math.max(0, Number(order.headcount) || 0) * Math.max(0, Number(order.realHours) || 0);
    case 'hm': return Math.max(0, Number(order.machineHours) || 0);
    case 'evidence': return Number(Boolean(order.imageBeforeUrl || order.beforePhotoUrl)) + Number(Boolean(order.imageAfterUrl || order.afterPhotoUrl));
    case 'volume': return Math.max(0, Number(order.cubicMetersRemoved) || 0);
    case 'status': return statusSortOrder[order.status] || 0;
  }
};

export const WorkOrdersGrid: React.FC<WorkOrdersGridProps> = ({
  workOrders,
  pendingWorkOrderIds = new Set<string>(),
  onAddWorkOrder,
  onUpdateWorkOrder,
  onDeleteWorkOrder,
  onItoApproveWorkOrder,
  whiteLabel,
  shifts,
  machines,
  plantAreas = [],
  sectors = [],
  equipments = [],
  subSectors = [],
  contingencies = [],
  currentRole,
  targetEditOrder,
  onClearTargetEditOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilterStatus, setQuickFilterStatus] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL');
  const [quickFilterTime, setQuickFilterTime] = useState<'ALL' | 'SHIFT_7X7' | 'TODAY'>('ALL');
  const [filterShiftId, setFilterShiftId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAreaId, setFilterAreaId] = useState<string>('ALL');
  const [filterStaffingType, setFilterStaffingType] = useState('ALL');
  const [filterTaskType, setFilterTaskType] = useState<string>('ALL');
  const [filterDatePreset, setFilterDatePreset] = useState<string>('ALL');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentAddStep, setCurrentAddStep] = useState<number>(0);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [currentEditStep, setCurrentEditStep] = useState<number>(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [reportingContingencyOrder, setReportingContingencyOrder] = useState<WorkOrder | null>(null);
  const [selectedContingencyReason, setSelectedContingencyReason] = useState<string>('');
  const [contingencyComments, setContingencyComments] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [sortSpecs, setSortSpecs] = useState<WorkOrderSort[]>(getStoredWorkOrderSort);

  useEffect(() => {
    try {
      window.localStorage.setItem(WORK_ORDER_SORT_STORAGE_KEY, JSON.stringify(sortSpecs));
    } catch {
      // El orden sigue funcionando durante la sesión aunque el navegador bloquee el almacenamiento local.
    }
  }, [sortSpecs]);

  // ITO Sign-off modal & Canvas Signature state
  const [itoApprovingOrder, setItoApprovingOrder] = useState<WorkOrder | null>(null);
  const [itoApproverName, setItoApproverName] = useState('Pedro Alarcón (ITO Mandante)');
  const [itoComments, setItoComments] = useState('Conformidad otorgada en terreno sin observaciones.');
  
  // Canvas Signature Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const defaultShift = shifts[0] || { id: 's1', name: 'Turno Día', code: 'TRN-DIA' };

  // Cascading 4-Level Selection State for New OT
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [selectedSubSectorNames, setSelectedSubSectorNames] = useState<string[]>([]);

  // Cascading 4-Level Selection State for Edit OT
  const [editSelectedAreaId, setEditSelectedAreaId] = useState<string>('');
  const [editSelectedSectorId, setEditSelectedSectorId] = useState<string>('');
  const [editSelectedEquipmentId, setEditSelectedEquipmentId] = useState<string>('');
  const [editSelectedSubSectorNames, setEditSelectedSubSectorNames] = useState<string[]>([]);

  const [newOrder, setNewOrder] = useState({
    ...getTodayOrderDefaults(),
    sapCode: '',
    equipoCorrea: '',
    operationDetail: '',
    headcount: 4,
    estimatedHours: 8,
    realHours: 8,
    shiftId: defaultShift.id,
    shiftName: defaultShift.name,
    vehiclePatent: '',
    status: 'PENDIENTE_APROBACION_ITO' as WorkOrderStatus,
    contingencyReason: '',
    beforePhotoUrl: '',
    afterPhotoUrl: '',
    areaId: '',
    areaName: '',
    sectorId: '',
    sectorName: '',
    equipmentId: '',
    equipmentName: '',
    subSectorId: '',
    subSectorName: '',
    hasManualLabor: false,
    hasEquipment: false,
    staffingType: undefined as StaffingType | undefined,
    taskType: 'PLANIFICADO' as TaskType,
    cubicMetersRemoved: 0,
    fleetTripsCount: 0,
    bucketCapacityM3: 0,
    machineHours: 0
  });

  const labels = whiteLabel.columnLabels;

  // Auto-generate Next Correlative OT Number (e.g. OT-1001, OT-1002...)
  const getNextOtCode = () => {
    const numbers = workOrders
      .map(w => {
        const match = (w.sapCode || '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      })
      .filter(n => !isNaN(n));
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 1000;
    const nextNum = maxNum + 1;
    return `OT-${String(nextNum).padStart(4, '0')}`;
  };

  useEffect(() => {
    if (showAddModal) {
      setNewOrder(prev => ({
        ...prev,
        sapCode: prev.sapCode || getNextOtCode()
      }));
    }
  }, [showAddModal]);

  useEffect(() => {
    if (targetEditOrder) {
      handleOpenEditModal(targetEditOrder);
      if (onClearTargetEditOrder) onClearTargetEditOrder();
    }
  }, [targetEditOrder]);

  // Filtered Options for 4-Level Cascading Dropdowns strictly sourced from Database
  const getSectorsForArea = (areaId: string) => {
    if (!areaId) return sectors || [];
    const areaObj = (plantAreas || []).find(a => a.id === areaId);
    const matched = (sectors || []).filter(s => {
      if (s.areaId === areaId) return true;
      if (areaObj && (s.areaName === areaObj.name || s.areaId === areaObj.id.replace('_', ''))) return true;
      return false;
    });
    return matched.length > 0 ? matched : (sectors || []);
  };

  const getEquipmentsForSector = (sectorId: string) => {
    if (!sectorId) return equipments || [];
    const sectorObj = (sectors || []).find(s => s.id === sectorId);
    const matched = (equipments || []).filter(e => {
      if (e.sectorId === sectorId) return true;
      if (sectorObj && (e.sectorName === sectorObj.name || e.sectorId === sectorObj.id.replace('_', ''))) return true;
      return false;
    });
    return matched.length > 0 ? matched : (equipments || []);
  };

  const availableSectors = getSectorsForArea(selectedAreaId);
  const availableEquipments = getEquipmentsForSector(selectedSectorId);

  const editAvailableSectors = getSectorsForArea(editSelectedAreaId);
  const editAvailableEquipments = getEquipmentsForSector(editSelectedSectorId);

  // Helper to query Component Badges directly from DB (with strict name deduplication)
  const getSubSectorsFromDb = (equipId: string, sectorId: string) => {
    const equipObj = (equipments || []).find(e => e.id === equipId);
    const sectorObj = (sectors || []).find(s => s.id === sectorId);

    // Equipment-specific components and sector-wide components must coexist.
    // A component created only under a sector is intentionally available to
    // every equipment in that sector, while components from sibling equipment
    // remain excluded.
    const matched = (subSectors || []).filter(sub => {
      const equipmentMatch = Boolean(equipId) && (
        sub.equipmentId === equipId
        || Boolean(equipObj && sub.equipmentName === equipObj.name)
      );
      const hasEquipmentScope = Boolean(sub.equipmentId || sub.equipmentName);
      const sectorMatch = Boolean(sectorId) && (
        sub.sectorId === sectorId
        || Boolean(sectorObj && sub.sectorName === sectorObj.name)
      );
      const isUnscopedLegacyComponent = !sub.sectorId && !sub.sectorName && !hasEquipmentScope;
      return equipmentMatch || (sectorMatch && !hasEquipmentScope) || isUnscopedLegacyComponent;
    });

    // Strict deduplication by component name to eliminate repeated badges
    const uniqueMap = new Map<string, SubSector>();
    matched.forEach(item => {
      if (item && item.name && !uniqueMap.has(item.name.trim())) {
        uniqueMap.set(item.name.trim(), item);
      }
    });

    return Array.from(uniqueMap.values());
  };

  const availableSubSectors = getSubSectorsFromDb(selectedEquipmentId, selectedSectorId);
  const editAvailableSubSectors = getSubSectorsFromDb(editSelectedEquipmentId, editSelectedSectorId);

  const handleOpenAddModal = () => {
    setCurrentAddStep(0);
    setSelectedAreaId('');
    setSelectedSectorId('');
    setSelectedEquipmentId('');
    setSelectedSubSectorNames([]);
    setNewOrder({
      ...getTodayOrderDefaults(),
      sapCode: '',
      equipoCorrea: '',
      operationDetail: '',
      headcount: 4,
      estimatedHours: 8,
      realHours: 8,
      shiftId: defaultShift.id,
      shiftName: defaultShift.name,
      vehiclePatent: '',
      status: 'PENDIENTE_APROBACION_ITO',
      contingencyReason: '',
      beforePhotoUrl: '',
      afterPhotoUrl: '',
      areaId: '',
      areaName: '',
      sectorId: '',
      sectorName: '',
      equipmentId: '',
      equipmentName: '',
      subSectorId: '',
      subSectorName: '',
      hasManualLabor: false,
      hasEquipment: false,
      staffingType: undefined as StaffingType | undefined,
      taskType: 'PLANIFICADO',
      cubicMetersRemoved: 0,
      fleetTripsCount: 0,
      bucketCapacityM3: 0,
      machineHours: 0
    });
    setShowAddModal(true);
  };

  const handleCancelAddModal = () => {
    setShowAddModal(false);
    setCurrentAddStep(0);
    setSelectedAreaId('');
    setSelectedSectorId('');
    setSelectedEquipmentId('');
    setSelectedSubSectorNames([]);
  };

  const handleOpenEditModal = (order: WorkOrder) => {
    const resourceFlags = getWorkOrderResourceFlags(order);
    const areaMatch = (plantAreas || []).find(area => area.id === order.areaId)
      || (plantAreas || []).find(area => area.name.trim().toLocaleLowerCase() === order.areaName?.trim().toLocaleLowerCase());
    const resolvedAreaId = areaMatch?.id || order.areaId || '';
    const sectorMatch = getSectorsForArea(resolvedAreaId).find(sector => sector.id === order.sectorId)
      || getSectorsForArea(resolvedAreaId).find(sector => sector.name.trim().toLocaleLowerCase() === order.sectorName?.trim().toLocaleLowerCase());
    const resolvedSectorId = sectorMatch?.id || order.sectorId || '';
    const equipmentMatch = getEquipmentsForSector(resolvedSectorId).find(equipment => equipment.id === order.equipmentId)
      || getEquipmentsForSector(resolvedSectorId).find(equipment => equipment.name.trim().toLocaleLowerCase() === order.equipmentName?.trim().toLocaleLowerCase())
      || getEquipmentsForSector(resolvedSectorId).find(equipment => order.equipoCorrea?.trim().toLocaleLowerCase().startsWith(equipment.name.trim().toLocaleLowerCase()));
    const resolvedEquipmentId = equipmentMatch?.id || order.equipmentId || '';
    const shiftMatch = shifts.find(shift => shift.id === order.shiftId)
      || shifts.find(shift => shift.name.trim().toLocaleLowerCase() === order.shiftName?.trim().toLocaleLowerCase());
    const selectedNames = order.selectedSubSectorNames?.length
      ? order.selectedSubSectorNames
      : order.subSectorName ? [order.subSectorName] : [];

    setCurrentEditStep(1);
    setEditingOrder({
      ...order,
      areaId: resolvedAreaId,
      areaName: areaMatch?.name || order.areaName,
      sectorId: resolvedSectorId,
      sectorName: sectorMatch?.name || order.sectorName,
      equipmentId: resolvedEquipmentId,
      equipmentName: equipmentMatch?.name || order.equipmentName,
      shiftId: shiftMatch?.id || order.shiftId,
      shiftName: shiftMatch?.name || order.shiftName,
      hasManualLabor: resourceFlags.manual,
      hasEquipment: resourceFlags.equipment
    });
    setEditSelectedAreaId(resolvedAreaId);
    setEditSelectedSectorId(resolvedSectorId);
    setEditSelectedEquipmentId(resolvedEquipmentId);
    setEditSelectedSubSectorNames(selectedNames);
  };

  // Initialize Canvas Signature Context when modal opens
  useEffect(() => {
    if (itoApprovingOrder && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#025951';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      setHasSignature(false);
    }
  }, [itoApprovingOrder]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const handleBeforeFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (isEdit && editingOrder) {
        setEditingOrder({ ...editingOrder, beforePhotoUrl: base64 });
      } else {
        setNewOrder({ ...newOrder, beforePhotoUrl: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAfterFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (isEdit && editingOrder) {
        setEditingOrder({ ...editingOrder, afterPhotoUrl: base64 });
      } else {
        setNewOrder({ ...newOrder, afterPhotoUrl: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  // 4-Level Cascading Selection Handlers
  const handleAreaChange = (areaId: string) => {
    setSelectedAreaId(areaId);
    setSelectedSectorId('');
    setSelectedEquipmentId('');
    setSelectedSubSectorNames([]);
    const area = plantAreas.find(a => a.id === areaId);
    setNewOrder(prev => ({
      ...prev,
      areaId,
      areaName: area ? area.name : ''
    }));
  };

  const handleSectorChange = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    setSelectedEquipmentId('');
    setSelectedSubSectorNames([]);
    const sector = sectors.find(s => s.id === sectorId);
    setNewOrder(prev => ({
      ...prev,
      sectorId,
      sectorName: sector ? sector.name : ''
    }));
  };

  const handleEquipmentChange = (equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    const equip = (equipments || []).find(e => e.id === equipmentId);
    const subs = getSubSectorsFromDb(equipmentId, selectedSectorId);
    const defaultSubName = subs && subs.length > 0 ? [subs[0].name] : ['General / Equipo'];
    setSelectedSubSectorNames(defaultSubName);
    setNewOrder(prev => ({
      ...prev,
      equipmentId,
      equipmentName: equip ? equip.name : '',
      equipoCorrea: equip ? equip.name : prev.equipoCorrea
    }));
  };

  // Helper to compute combined cubic meters (Manual + Equipment)
  const computeCombinedM3 = (
    hasManual: boolean,
    headcount: number,
    realHours: number,
    hasEquipment: boolean,
    patent: string | undefined,
    trips: number,
    existingCap: number = 0
  ) => {
    let manualM3 = 0;
    let machineryM3 = 0;

    if (hasManual) {
      const wPerDay = whiteLabel.manualLaborConfig?.wheelbarrowsPerDay ?? 60;
      const hEff = whiteLabel.manualLaborConfig?.effectiveHoursPerDay ?? 6;
      const capM3 = whiteLabel.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08;
      const m3PerHour = (hEff > 0 ? wPerDay / hEff : 10) * capM3;
      manualM3 = (headcount || 0) * (realHours || 0) * m3PerHour;
    }

    if (hasEquipment) {
      const selectedMachine = machines.find(m => m.patent === patent);
      const cap = selectedMachine?.capacityM3 ?? existingCap ?? 0;
      machineryM3 = (trips || 0) * cap;
    }

    return Number((manualM3 + machineryM3).toFixed(1));
  };

  const toggleSubSectorSelection = (name: string) => {
    if (selectedSubSectorNames.includes(name)) {
      setSelectedSubSectorNames(selectedSubSectorNames.filter(n => n !== name));
    } else {
      setSelectedSubSectorNames([...selectedSubSectorNames, name]);
    }
  };

  // Helper to calculate active Wednesday-to-Tuesday 7x7 shift date range
  const getActive7x7ShiftRange = (dateStr?: string) => {
    const today = dateStr ? new Date(dateStr) : new Date();
    const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
    
    // Calculate days back to most recent Wednesday (3)
    let daysToWed = (dayOfWeek - 3 + 7) % 7;
    const startWed = new Date(today);
    startWed.setDate(today.getDate() - daysToWed);
    startWed.setHours(0, 0, 0, 0);

    const endTue = new Date(startWed);
    endTue.setDate(startWed.getDate() + 6);
    endTue.setHours(23, 59, 59, 999);

    const startStr = startWed.toISOString().split('T')[0];
    const endStr = endTue.toISOString().split('T')[0];

    const formatShort = (d: Date) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}`;
    };

    return {
      startStr,
      endStr,
      label: `Mié ${formatShort(startWed)} - Mar ${formatShort(endTue)}`
    };
  };

  const active7x7Range = getActive7x7ShiftRange();
  const todayStr = new Date().toISOString().split('T')[0];

  const totalCount = workOrders.length;
  const pendingCount = workOrders.filter(o => o.status === 'PENDIENTE_APROBACION_ITO').length;
  const approvedCount = workOrders.filter(o => o.status === 'APROBADO_MANDANTE' || o.status === 'COMPLETADO').length;

  const matchingOrders = workOrders.filter(order => {
    // Quick Filter Status (A prueba de niños)
    if (quickFilterStatus === 'PENDING' && order.status !== 'PENDIENTE_APROBACION_ITO') return false;
    if (quickFilterStatus === 'APPROVED' && order.status !== 'APROBADO_MANDANTE' && order.status !== 'COMPLETADO') return false;

    // Quick Filter Time & Shift 7x7 (A prueba de niños)
    if (quickFilterTime === 'TODAY' && order.executionDate !== todayStr) return false;
    if (quickFilterTime === 'SHIFT_7X7') {
      const orderDateStr = order.executionDate || '';
      if (orderDateStr < active7x7Range.startStr || orderDateStr > active7x7Range.endStr) return false;
    }

    const matchesSearch = 
      order.sapCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.equipoCorrea.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.operationDetail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.areaName && order.areaName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesShift = filterShiftId === 'ALL' || order.shiftId === filterShiftId;
    const matchesArea = filterAreaId === 'ALL' || order.areaId === filterAreaId;
    const matchesTaskType = filterTaskType === 'ALL' || order.taskType === filterTaskType || (!order.taskType && filterTaskType === 'PLANIFICADO');

    const matchesStatus = filterStatus === 'ALL' || 
      (filterStatus === 'PENDIENTE' && order.status === 'PENDIENTE_APROBACION_ITO') ||
      (filterStatus === 'APROBADO' && order.status === 'APROBADO_MANDANTE') ||
      (filterStatus === 'CONTINGENCIA' && (order.status === 'RECHAZADO_CONTINGENCIA' || order.status === 'CONTINGENCIA'));

    let matchesDate = true;
    if (filterDatePreset !== 'ALL') {
      const orderDateStr = order.executionDate || '';

      if (filterDatePreset === 'TODAY') {
        matchesDate = orderDateStr === todayStr;
      } else if (filterDatePreset === 'THIS_WEEK') {
        const now = new Date();
        const dayOfWeek = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + 1);
        const mondayStr = monday.toISOString().split('T')[0];
        matchesDate = orderDateStr >= mondayStr && orderDateStr <= todayStr;
      } else if (filterDatePreset === 'THIS_MONTH') {
        const monthPrefix = new Date().toISOString().slice(0, 7);
        matchesDate = orderDateStr.startsWith(monthPrefix);
      } else if (filterDatePreset === 'CUSTOM') {
        if (filterStartDate && orderDateStr < filterStartDate) matchesDate = false;
        if (filterEndDate && orderDateStr > filterEndDate) matchesDate = false;
      }
    }

    return (filterStaffingType === 'ALL' || (order.staffingType || 'UNCLASSIFIED') === filterStaffingType) && matchesSearch && matchesShift && matchesStatus && matchesArea && matchesTaskType && matchesDate;
  });

  const effectiveSortSpecs = sortSpecs.length > 0 ? sortSpecs : DEFAULT_WORK_ORDER_SORT;
  const filteredOrders = [...matchingOrders].sort((left, right) => {
    for (const spec of effectiveSortSpecs) {
      const leftValue = getWorkOrderSortValue(left, spec.key);
      const rightValue = getWorkOrderSortValue(right, spec.key);
      const emptyLeft = leftValue === '';
      const emptyRight = rightValue === '';
      if (emptyLeft !== emptyRight) return emptyLeft ? 1 : -1;
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : textCollator.compare(String(leftValue), String(rightValue));
      if (comparison !== 0) return spec.direction === 'asc' ? comparison : -comparison;
    }
    return textCollator.compare(left.sapCode || left.id, right.sapCode || right.id);
  });

  const handleSort = (key: WorkOrderSortKey, additive = false) => {
    setSortSpecs((current): WorkOrderSort[] => {
      const existingIndex = current.findIndex(spec => spec.key === key);
      if (!additive) {
        if (existingIndex === -1 || current.length > 1) return [{ key, direction: 'asc' }];
        if (current[0].direction === 'asc') return [{ key, direction: 'desc' }];
        return [];
      }
      if (existingIndex === -1) return [...current, { key, direction: 'asc' } as WorkOrderSort].slice(0, 4);
      if (current[existingIndex].direction === 'asc') {
        return current.map((spec, index): WorkOrderSort => index === existingIndex ? { ...spec, direction: 'desc' } : spec);
      }
      return current.filter((_, index) => index !== existingIndex);
    });
  };

  const SortableHeader = ({ sortKey, children }: { sortKey: WorkOrderSortKey; children: React.ReactNode }) => {
    const explicitIndex = sortSpecs.findIndex(spec => spec.key === sortKey);
    const defaultIndex = sortSpecs.length === 0 ? DEFAULT_WORK_ORDER_SORT.findIndex(spec => spec.key === sortKey) : -1;
    const index = explicitIndex >= 0 ? explicitIndex : defaultIndex;
    const direction = explicitIndex >= 0 ? sortSpecs[explicitIndex].direction : defaultIndex >= 0 ? DEFAULT_WORK_ORDER_SORT[defaultIndex].direction : undefined;
    return <th aria-sort={index === 0 ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className={`ot-sort-button ${index >= 0 ? 'is-active' : ''}`} onClick={(event) => handleSort(sortKey, event.shiftKey)} title="Clic para ordenar. Shift + clic para combinar criterios.">
        <span>{children}</span><span className="ot-sort-indicator" aria-hidden="true">{direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}</span>{index >= 0 && effectiveSortSpecs.length > 1 && <small>{index + 1}</small>}
      </button>
    </th>;
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.staffingType) { alert('Selecciona el tipo de dotación.'); setCurrentAddStep(0); return; }
    if (currentAddStep !== 10) return;
    const finalSapCode = newOrder.sapCode || getNextOtCode();

    if (!newOrder.hasManualLabor && !newOrder.hasEquipment) {
      alert('Debes seleccionar al menos una modalidad de recurso (Trabajo Manual o Maquinaria / Equipos).');
      return;
    }

    const selectedShift = shifts.find(s => s.id === newOrder.shiftId) || defaultShift;
    const equipObj = (equipments || []).find(e => e.id === selectedEquipmentId);
    const equipName = equipObj ? equipObj.name : (newOrder.equipoCorrea || 'Equipo General');
    const subSectorsStr = selectedSubSectorNames.length > 0 ? ` (${selectedSubSectorNames.join(', ')})` : '';
    const finalEquipo = `${equipName}${subSectorsStr}`;

    onAddWorkOrder({
      ...newOrder,
      sapCode: finalSapCode,
      headcount: newOrder.hasManualLabor ? newOrder.headcount : 0,
      vehiclePatent: newOrder.hasEquipment ? newOrder.vehiclePatent : '',
      fleetTripsCount: newOrder.hasEquipment ? newOrder.fleetTripsCount : 0,
      bucketCapacityM3: newOrder.hasEquipment ? newOrder.bucketCapacityM3 : 0,
      machineHours: newOrder.hasEquipment ? newOrder.machineHours : 0,
      equipoCorrea: finalEquipo,
      equipmentName: equipName,
      selectedSubSectorIds: selectedSubSectorNames
        .map(name => (subSectors || []).find(sub => sub.name === name && (!selectedEquipmentId || sub.equipmentId === selectedEquipmentId))?.id)
        .filter((id): id is string => Boolean(id)),
      selectedSubSectorNames,
      shiftName: selectedShift.name
    });

    setShowAddModal(false);
    setCurrentAddStep(0);
    setSelectedAreaId('');
    setSelectedSectorId('');
    setSelectedEquipmentId('');
    setSelectedSubSectorNames([]);
    setNewOrder({
      ...getTodayOrderDefaults(),
      sapCode: '',
      equipoCorrea: '',
      operationDetail: '',
      headcount: 4,
      estimatedHours: 8,
      realHours: 8,
      shiftId: defaultShift.id,
      shiftName: defaultShift.name,
      vehiclePatent: '',
      status: 'PENDIENTE_APROBACION_ITO',
      contingencyReason: '',
      beforePhotoUrl: '',
      afterPhotoUrl: '',
      areaId: '',
      areaName: '',
      sectorId: '',
      sectorName: '',
      equipmentId: '',
      equipmentName: '',
      subSectorId: '',
      subSectorName: '',
      hasManualLabor: false,
      hasEquipment: false,
      staffingType: undefined as StaffingType | undefined,
      taskType: 'PLANIFICADO',
      cubicMetersRemoved: 0,
      fleetTripsCount: 0,
      bucketCapacityM3: 0,
      machineHours: 0
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    const selectedShift = shifts.find(s => s.id === editingOrder.shiftId) || defaultShift;
    const areaObj = (plantAreas || []).find(a => a.id === editSelectedAreaId);
    const sectorObj = (sectors || []).filter(s => s.id === editSelectedSectorId)[0];
    const equipObj = (equipments || []).find(e => e.id === editSelectedEquipmentId);

    const areaName = areaObj ? areaObj.name : (editingOrder.areaName || '');
    const sectorName = sectorObj ? sectorObj.name : (editingOrder.sectorName || '');
    const equipName = equipObj ? equipObj.name : (editingOrder.equipmentName || 'Equipo General');
    const subSectorsStr = editSelectedSubSectorNames.length > 0 ? ` (${editSelectedSubSectorNames.join(', ')})` : '';
    const finalEquipo = `${equipName}${subSectorsStr}`;

    onUpdateWorkOrder(editingOrder.id, {
      ...editingOrder,
      areaId: editSelectedAreaId || editingOrder.areaId,
      areaName: areaName || editingOrder.areaName,
      sectorId: editSelectedSectorId || editingOrder.sectorId,
      sectorName: sectorName || editingOrder.sectorName,
      equipmentId: editSelectedEquipmentId || editingOrder.equipmentId,
      equipmentName: equipName,
      equipoCorrea: finalEquipo,
      selectedSubSectorIds: editSelectedSubSectorNames
        .map(name => (subSectors || []).find(sub => sub.name === name && (!editSelectedEquipmentId || sub.equipmentId === editSelectedEquipmentId))?.id)
        .filter((id): id is string => Boolean(id)),
      selectedSubSectorNames: editSelectedSubSectorNames,
      shiftName: selectedShift.name,
      headcount: editingOrder.hasManualLabor ? editingOrder.headcount : 0,
      vehiclePatent: editingOrder.hasEquipment ? editingOrder.vehiclePatent : '',
      fleetTripsCount: editingOrder.hasEquipment ? editingOrder.fleetTripsCount : 0,
      bucketCapacityM3: editingOrder.hasEquipment ? editingOrder.bucketCapacityM3 : 0,
      machineHours: editingOrder.hasEquipment ? editingOrder.machineHours : 0
    });
    setEditingOrder(null);
  };

  const handleItoApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itoApprovingOrder) return;
    
    let signatureUrl: string | undefined = undefined;
    if (canvasRef.current && hasSignature) {
      signatureUrl = canvasRef.current.toDataURL('image/png');
    }

    onItoApproveWorkOrder(itoApprovingOrder.id, itoApproverName, itoComments, signatureUrl);
    setItoApprovingOrder(null);
  };

  const handleContingencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingContingencyOrder) return;

    onUpdateWorkOrder(reportingContingencyOrder.id, {
      status: 'RECHAZADO_CONTINGENCIA',
      contingencyReason: selectedContingencyReason || 'Detención Operacional en Terreno',
      operationDetail: `${reportingContingencyOrder.operationDetail} [DETENCIÓN: ${contingencyComments}]`
    });

    setReportingContingencyOrder(null);
    setSelectedContingencyReason('');
    setContingencyComments('');
  };

  const handleDeleteClick = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta orden de trabajo?')) {
      onDeleteWorkOrder(id);
    }
  };

  const getEvidenceProgressBadge = (order: WorkOrder) => {
    const hasBefore = !!order.beforePhotoUrl;
    const hasAfter = !!order.afterPhotoUrl;

    if (hasBefore && hasAfter) {
      return (
        <span className="pill pill-complete" style={{ fontSize: '10px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #6EE7B7' }}>
          🟢 Slider Listo (2/2)
        </span>
      );
    } else if (hasBefore || hasAfter) {
      return (
        <span className="pill pill-pending" style={{ fontSize: '10px', backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' }}>
          🟡 Falta Foto Final (1/2)
        </span>
      );
    } else {
      return (
        <span className="pill pill-contingency" style={{ fontSize: '10px', backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5' }}>
          🔴 Sin Fotos (0/2)
        </span>
      );
    }
  };

  const getTaskTypeBadge = (type?: TaskType) => {
    switch (type) {
      case 'MANTENIMIENTO_PROGRAMADO':
        return (
          <span className="pill" style={{ fontSize: '10px', backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC', fontWeight: 900 }}>
            🔧 Mantenimiento Programado
          </span>
        );
      case 'EMERGENTE':
        return (
          <span className="pill" style={{ fontSize: '10px', backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', fontWeight: 900 }}>
            🚨 Emergente
          </span>
        );
      case 'PLANIFICADO':
      default:
        return (
          <span className="pill" style={{ fontSize: '10px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #6EE7B7', fontWeight: 900 }}>
            📌 Planificado
          </span>
        );
    }
  };

  const exportToExcel = () => {
    const dataToExport = filteredOrders.map(o => ({
      'Semana': o.semana,
      'Día': o.dia,
      'Tipo de dotación': o.staffingType || 'Sin clasificar',
      'Tipo de Tarea': o.taskType || 'Planificado',
      'Área de Planta (Nivel 1)': o.areaName || 'General',
      'Sector / Proceso (Nivel 2)': o.sectorName || '-',
      'Equipo / Sistema (Nivel 3)': o.equipmentName || o.equipoCorrea,
      'Sub-Sectores & Componentes (Nivel 4)': o.selectedSubSectorNames ? o.selectedSubSectorNames.join(', ') : '-',
      'Modalidad Recursos': o.hasManualLabor && o.hasEquipment ? 'Manual + Equipos' : o.hasEquipment ? 'Solo Equipos' : 'Solo Manual',
      'Turno': o.shiftName,
      'N° OT / SAP': o.sapCode,
      'Fecha de Ejecución': o.executionDate || '',
      'Operación / Detalle': o.operationDetail,
      'Patente / Vehículo': o.vehiclePatent || '-',
      'N° Personas': o.headcount,
      'HH Estimadas': o.estimatedHours,
      'Duración Real (h)': o.realHours,
      'HH Ejecutadas': (Number(o.headcount) || 0) * (Number(o.realHours) || 0),
      'HM Ejecutadas': Number(o.machineHours) || 0,
      'Volumen Removido (m³)': Number(o.cubicMetersRemoved) || 0,
      'Brecha HH': o.realHours - o.estimatedHours,
      'Fotos Registradas': o.beforePhotoUrl && o.afterPhotoUrl ? 'Completo (2/2)' : o.beforePhotoUrl ? 'Pendiente Foto Final (1/2)' : 'Sin Fotos (0/2)',
      'Estado Conformidad': o.status,
      'Firma / ITO Mandante': o.itoApproverName || '-',
      'Fecha Aprobación ITO': o.itoApprovalDate || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte_Zaldivar_4Niveles');
    XLSX.writeFile(wb, `Reporte_Zaldivar_4Niveles_${Date.now()}.xlsx`);
  };

  const getStatusBadge = (status: WorkOrderStatus) => {
    switch (status) {
      case 'APROBADO_MANDANTE':
      case 'COMPLETADO':
        return <span className="pill pill-complete"><CheckCircle2 size={12} style={{ marginRight: '4px' }} /> APROBADO ITO MANDANTE</span>;
      case 'PENDIENTE_APROBACION_ITO':
        return <span className="pill pill-pending"><Clock size={12} style={{ marginRight: '4px' }} /> PENDIENTE FIRMA ITO</span>;
      case 'EN_EJECUCION':
        return <span className="pill pill-pending" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}><Clock size={12} style={{ marginRight: '4px' }} /> EN EJECUCIÓN</span>;
      case 'RECHAZADO_CONTINGENCIA':
      case 'CONTINGENCIA':
        return <span className="pill pill-contingency"><AlertTriangle size={12} style={{ marginRight: '4px' }} /> CONTINGENCIA / RECHAZADO</span>;
      default:
        return <span className="pill pill-pending">{status}</span>;
    }
  };

  const renderStepper = (currentStep: number, totalSteps: number = 10) => {
    const stepTitles = totalSteps === 11 ? ['Tipo de dotación', 'Clasificación Tarea', 'Área de Planta', 'Sector / Proceso', 'Equipo Principal', 'Componentes Intervenidos', 'Selección de Recursos', 'Cuadrilla Manual', 'Maquinaria de Flota', 'Fecha & Turno', 'Detalle & Fotos'] : [
      '1. Clasificación Tarea',
      '2. Área de Planta',
      '3. Sector / Proceso',
      '4. Equipo Principal',
      '5. Componentes Intervenidos',
      '6. Selección de Recursos',
      '7. Cuadrilla Manual',
      '8. Maquinaria de Flota',
      '9. Fecha & Turno',
      '10. Detalle & Fotos'
    ];
    const percent = Math.round((currentStep / totalSteps) * 100);

    return (
      <div className="stepper-header-box" style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '18px', border: '1px solid var(--slate-200)', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
          <span className="stepper-header-title" style={{ fontSize: '13px', fontWeight: 900, color: 'var(--orange)' }}>
            Paso {currentStep} de {totalSteps}: <span style={{ color: 'var(--slate-900)' }}>{stepTitles[currentStep - 1]}</span>
          </span>
          <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-600)', backgroundColor: '#E2E8F0', padding: '3px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}>
            {percent}% completado
          </span>
        </div>

        {/* Progress Bar Track */}
        <div style={{ width: '100%', height: '8px', backgroundColor: '#E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', backgroundColor: 'var(--orange)', borderRadius: '10px', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)' }}>
            📋 Órdenes de Trabajo (OT)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginTop: '2px' }}>
            Registro diario de operaciones y firmas de terreno — Planta Zaldívar
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={exportToExcel} className="btn btn-secondary">
            <FileSpreadsheet size={16} /> Exportar Excel 4N
          </button>

          {(currentRole === 'SUPERVISOR_TERRENO' || currentRole === 'ADMINISTRADOR_CONTRATO' || currentRole === 'SUPER_ADMIN') && (
            <button onClick={handleOpenAddModal} className="btn btn-primary">
              <Plus size={16} /> + Nueva Orden de Trabajo
            </button>
          )}
        </div>
      </div>

      {/* Quick Contingency Report Modal */}
      {reportingContingencyOrder && (
        <div className="modal-backdrop-overlay" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <div className="modal-content-card" style={{ maxWidth: '500px', border: '2px solid #FCA5A5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertOctagon size={22} /> Reportar Detención / Contingencia
              </h3>
              <button onClick={() => setReportingContingencyOrder(null)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginBottom: '16px' }}>
              Registra una contingencia operacional para la OT <strong style={{ color: 'var(--slate-900)' }}>{reportingContingencyOrder.sapCode}</strong> ({reportingContingencyOrder.equipoCorrea}).
            </p>

            <form onSubmit={handleContingencySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Motivo de Contingencia Parametrizado</label>
                <select
                  value={selectedContingencyReason}
                  onChange={e => setSelectedContingencyReason(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-200)' }}
                  required
                >
                  <option value="">Selecciona la causa de detención...</option>
                  {contingencies.map(c => (
                    <option key={c.id} value={c.name}>{c.name} ({c.category})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Detalles / Observaciones de Terreno</label>
                <textarea
                  value={contingencyComments}
                  onChange={e => setContingencyComments(e.target.value)}
                  rows={3}
                  placeholder="Describe la causa y el impacto en la operación..."
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-200)' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setReportingContingencyOrder(null)}>Cancelar</button>
                <button type="submit" className="btn" style={{ backgroundColor: '#991B1B', color: '#FFF' }}>
                  <AlertTriangle size={16} /> Registrar Detención
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ITO Sign-off & Digital Signature Canvas Modal */}
      {itoApprovingOrder && (
        <div className="modal-backdrop-overlay" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}>
          <div className="modal-content-card" style={{ maxWidth: '560px', border: '2px solid var(--orange)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={22} style={{ color: 'var(--orange)' }} /> Certificación & Firma Digital ITO Mandante
              </h3>
              <button onClick={() => setItoApprovingOrder(null)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginBottom: '16px' }}>
              Como Inspector Técnico de la Empresa Minera, otorga conformidad a los trabajos realizados en la OT <strong style={{ color: 'var(--slate-900)' }}>{itoApprovingOrder.sapCode}</strong> ({itoApprovingOrder.equipoCorrea}).
            </p>

            <form onSubmit={handleItoApproveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Nombre y Cargo del Inspector / ITO Mandante</label>
                <input
                  type="text"
                  value={itoApproverName}
                  onChange={e => setItoApproverName(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-200)' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 800, display: 'block', marginBottom: '4px' }}>Observaciones de Conformidad</label>
                <textarea
                  value={itoComments}
                  onChange={e => setItoComments(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-200)' }}
                />
              </div>

              {/* Digital Canvas Signature Pad */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PenTool size={14} /> Dibuja tu Firma Digital de Certificación
                  </label>
                  <button type="button" onClick={clearCanvas} className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>
                    <Eraser size={12} /> Limpiar Firma
                  </button>
                </div>
                
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={130}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{ border: '2px dashed var(--orange)', borderRadius: '12px', backgroundColor: '#F8FAFC', cursor: 'crosshair', width: '100%', touchAction: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setItoApprovingOrder(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  <UserCheck size={16} /> Estampar Firma & Aprobación Mandante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL-FEATURED WORK ORDER EDITOR MODAL WIZARD */}
      {editingOrder && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--slate-200)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ✏️ Edición Guiada de Orden de Trabajo
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: 900, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {editingOrder.sapCode} — <span style={{ color: 'var(--orange)' }}>{editingOrder.equipoCorrea}</span>
                </h3>
              </div>
              <button onClick={() => setEditingOrder(null)} className="btn btn-secondary" style={{ padding: '6px 10px' }}><X size={16} /></button>
            </div>

            <label style={{ display: 'grid', gap: '6px', marginBottom: '16px' }}>Tipo de dotación
              <select value={editingOrder.staffingType || ''} onChange={e => setEditingOrder({ ...editingOrder, staffingType: e.target.value as StaffingType })}>
                <option value="" disabled>Sin clasificar</option>
                {['Spot13P', 'Spot72P', 'Base'].map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            {renderStepper(currentEditStep, 9)}

          <form className="responsive-form-grid" onSubmit={handleUpdateSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '16px' }}>
            
            {/* PASO 1: CLASIFICACIÓN DE TAREA */}
            {currentEditStep === 1 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  📋 Paso 1: ¿Qué tipo de tarea es?
                </h4>
                <div className="responsive-option-grid">
                  <button
                    type="button"
                    onClick={() => setEditingOrder({ ...editingOrder, taskType: 'PLANIFICADO' })}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer',
                      border: editingOrder.taskType === 'PLANIFICADO' ? '3px solid #047857' : '2px solid var(--slate-200)',
                      backgroundColor: editingOrder.taskType === 'PLANIFICADO' ? '#ECFDF5' : '#FFFFFF',
                      color: editingOrder.taskType === 'PLANIFICADO' ? '#047857' : 'var(--slate-600)',
                      boxShadow: editingOrder.taskType === 'PLANIFICADO' ? '0 4px 12px rgba(4,120,87,0.15)' : 'none'
                    }}
                  >
                    📌 Planificado
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingOrder({ ...editingOrder, taskType: 'MANTENIMIENTO_PROGRAMADO' })}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer',
                      border: editingOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '3px solid #0369A1' : '2px solid var(--slate-200)',
                      backgroundColor: editingOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '#E0F2FE' : '#FFFFFF',
                      color: editingOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '#0369A1' : 'var(--slate-600)',
                      boxShadow: editingOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '0 4px 12px rgba(3,105,161,0.15)' : 'none'
                    }}
                  >
                    🔧 Mantenimiento Programado
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingOrder({ ...editingOrder, taskType: 'EMERGENTE' })}
                    style={{
                      padding: '16px',
                      borderRadius: '16px',
                      fontWeight: 900,
                      fontSize: '13px',
                      cursor: 'pointer',
                      border: editingOrder.taskType === 'EMERGENTE' ? '3px solid #DC2626' : '2px solid var(--slate-200)',
                      backgroundColor: editingOrder.taskType === 'EMERGENTE' ? '#FEF2F2' : '#FFFFFF',
                      color: editingOrder.taskType === 'EMERGENTE' ? '#991B1B' : 'var(--slate-600)',
                      boxShadow: editingOrder.taskType === 'EMERGENTE' ? '0 4px 12px rgba(220,38,38,0.15)' : 'none'
                    }}
                  >
                    🚨 Emergente
                  </button>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentEditStep(2)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                    Siguiente: Área de Planta ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2: ÁREA DE PLANTA (NIVEL 1) */}
            {currentEditStep === 2 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  🌐 Paso 2: Selecciona el Área de Planta (Nivel 1)
                </h4>
                <div style={{ backgroundColor: '#F0F9FF', padding: '20px', borderRadius: '18px', border: '2px solid #BAE6FD' }}>
                  <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Área Principal de Minera
                  </label>
                  <select
                    value={editSelectedAreaId}
                    onChange={e => {
                      setEditSelectedAreaId(e.target.value);
                      setEditSelectedSectorId('');
                      setEditSelectedEquipmentId('');
                      setEditSelectedSubSectorNames([]);
                    }}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #7DD3FC', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                    required
                  >
                    <option value="">Selecciona Área de Planta (Ej: Área Seca)...</option>
                    {plantAreas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(1)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (!editSelectedAreaId) { alert('Selecciona el Área antes de continuar.'); return; }
                      setCurrentEditStep(3);
                    }} 
                    style={{ padding: '12px 24px', fontSize: '13px' }}
                  >
                    Siguiente: Sector / Proceso ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 3: SECTOR / PROCESO (NIVEL 2) */}
            {currentEditStep === 3 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  📍 Paso 3: Selecciona el Sector o Proceso (Nivel 2)
                </h4>
                <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '18px', border: '2px solid var(--slate-200)' }}>
                  <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Sector / Proceso Operativo
                  </label>
                  <select
                    value={editSelectedSectorId}
                    onChange={e => {
                      setEditSelectedSectorId(e.target.value);
                      setEditSelectedEquipmentId('');
                      setEditSelectedSubSectorNames([]);
                    }}
                    style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid var(--slate-300)', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                    required
                  >
                    <option value="">Selecciona Sector (Ej: Chancador Terciario)...</option>
                    {editAvailableSectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(2)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (!editSelectedSectorId) { alert('Selecciona el Sector antes de continuar.'); return; }
                      setCurrentEditStep(4);
                    }} 
                    style={{ padding: '12px 24px', fontSize: '13px' }}
                  >
                    Siguiente: Equipo & Componentes ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 4: SECTOR (NIVEL 2), EQUIPO (NIVEL 3) & COMPONENTES (NIVEL 4) */}
            {currentEditStep === 4 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  ⚙️ Paso 4: Selecciona Sector (Nivel 2), Equipo Principal (Nivel 3) & Componentes (Nivel 4)
                </h4>

                {/* Selector de Sector Nivel 2 */}
                <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--slate-200)' }}>
                  <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-700)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                    📍 Sector / Proceso Operativo (Nivel 2)
                  </label>
                  <select
                    value={editSelectedSectorId}
                    onChange={e => {
                      const secId = e.target.value;
                      setEditSelectedSectorId(secId);
                      setEditSelectedEquipmentId('');
                      setEditSelectedSubSectorNames([]);
                      const secObj = sectors.find(s => s.id === secId);
                      if (editingOrder) {
                        setEditingOrder({ ...editingOrder, sectorId: secId, sectorName: secObj ? secObj.name : '' });
                      }
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--slate-300)', fontWeight: 800, fontSize: '13px', backgroundColor: '#FFF' }}
                  >
                    <option value="">Todos los Sectores...</option>
                    {editAvailableSectors.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ backgroundColor: '#FFF7ED', padding: '16px', borderRadius: '16px', border: '2px solid #FFEDD5' }}>
                  <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--orange)', display: 'block', marginBottom: '6px' }}>
                    Equipo / Correa Principal (Nivel 3)
                  </label>
                  <select
                    value={editSelectedEquipmentId}
                    onChange={e => {
                      setEditSelectedEquipmentId(e.target.value);
                      setEditSelectedSubSectorNames([]);
                    }}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #FDBA74', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                    required
                  >
                    <option value="">Selecciona Equipo (Ej: CT-106)...</option>
                    {editAvailableEquipments.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.name}</option>
                    ))}
                  </select>
                </div>

                {editAvailableSubSectors.length > 0 && (
                  <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: editSelectedSubSectorNames.length === 0 ? '2px solid #EF4444' : '1px solid var(--slate-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block' }}>
                        Componentes Intervenidos (Nivel 4 Badges Multiseleccionables) <span style={{ color: '#EF4444' }}>* (Obligatorio)</span>
                      </label>
                      {editSelectedSubSectorNames.length === 0 && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#EF4444', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '8px' }}>
                          ⚠️ Selecciona al menos 1
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {editAvailableSubSectors.map(sub => {
                        const isSelected = editSelectedSubSectorNames.includes(sub.name);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            className="badge-select-btn"
                            onClick={() => {
                              if (isSelected) {
                                setEditSelectedSubSectorNames(editSelectedSubSectorNames.filter(n => n !== sub.name));
                              } else {
                                setEditSelectedSubSectorNames([...editSelectedSubSectorNames, sub.name]);
                              }
                            }}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 800,
                              border: isSelected ? '2px solid var(--orange)' : '1px solid var(--slate-300)',
                              backgroundColor: isSelected ? 'var(--orange)' : '#FFFFFF',
                              color: isSelected ? '#FFFFFF' : 'var(--slate-700)',
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? '✓ ' : '+ '} {sub.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>N° OT (Correlativo)</label>
                  <input type="text" value={editingOrder.sapCode} readOnly disabled style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-300)', backgroundColor: '#E2E8F0', fontWeight: 900, color: '#475569' }} />
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(3)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (!editSelectedEquipmentId) { alert('Selecciona el Equipo antes de continuar.'); return; }
                      if (editSelectedSubSectorNames.length === 0) {
                        const fallbackName = editAvailableSubSectors && editAvailableSubSectors.length > 0 ? editAvailableSubSectors[0].name : 'General / Equipo';
                        setEditSelectedSubSectorNames([fallbackName]);
                      }
                      setCurrentEditStep(5);
                    }} 
                    style={{ padding: '12px 24px', fontSize: '13px' }}
                  >
                    Siguiente: Fecha & Turno ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 5: FECHA & TURNO */}
            {currentEditStep === 5 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  ⏱️ Paso 5: ¿Cuándo y en qué Turno se ejecutó?
                </h4>
                
                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>📅 Fecha de Ejecución</label>
                    <input
                      type="date"
                      value={editingOrder.executionDate || new Date().toISOString().split('T')[0]}
                      onChange={e => setEditingOrder({ ...editingOrder, ...getOrderDateMetadata(e.target.value) })}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--slate-300)', fontWeight: 800, fontSize: '14px' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>Turno Asignado</label>
                    <select
                      value={editingOrder.shiftId}
                      onChange={e => setEditingOrder({ ...editingOrder, shiftId: e.target.value })}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--slate-300)', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                    >
                      {shifts.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(4)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentEditStep(6)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                    Siguiente: Recursos & m³ ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 6: SELECCIÓN DE RECURSOS */}
            {currentEditStep === 6 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  🚜👷 Paso 6: Selecciona los Recursos Utilizados
                </h4>

                <div className="responsive-option-grid" style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid var(--slate-200)' }}>
                  <label 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '12px', 
                      padding: '24px 16px',
                      borderRadius: '16px',
                      border: (editingOrder.hasManualLabor !== false) ? '2px solid var(--orange)' : '1px solid var(--slate-300)',
                      backgroundColor: (editingOrder.hasManualLabor !== false) ? '#FFF7ED' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editingOrder.hasManualLabor !== false}
                      onChange={e => {
                        const hasManual = e.target.checked;
                        const calcM3 = computeCombinedM3(hasManual, editingOrder.headcount || 0, editingOrder.realHours || 0, editingOrder.hasEquipment !== false, editingOrder.vehiclePatent, editingOrder.fleetTripsCount || 0, editingOrder.bucketCapacityM3);
                        setEditingOrder({ ...editingOrder, hasManualLabor: hasManual, cubicMetersRemoved: calcM3 });
                      }}
                      style={{ width: '22px', height: '22px', accentColor: 'var(--orange)' }}
                    />
                    <span style={{ fontSize: '15px', fontWeight: 900, color: (editingOrder.hasManualLabor !== false) ? 'var(--orange)' : 'var(--slate-800)', textAlign: 'center' }}>
                      👷 Trabajo Manual
                    </span>
                  </label>

                  <label 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center',
                      gap: '12px', 
                      padding: '24px 16px',
                      borderRadius: '16px',
                      border: (editingOrder.hasEquipment !== false) ? '2px solid #0369A1' : '1px solid var(--slate-300)',
                      backgroundColor: (editingOrder.hasEquipment !== false) ? '#F0F9FF' : '#FFFFFF',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={editingOrder.hasEquipment !== false}
                      onChange={e => {
                        const hasEquip = e.target.checked;
                        const calcM3 = computeCombinedM3(editingOrder.hasManualLabor !== false, editingOrder.headcount || 0, editingOrder.realHours || 0, hasEquip, editingOrder.vehiclePatent, editingOrder.fleetTripsCount || 0, editingOrder.bucketCapacityM3);
                        setEditingOrder({ ...editingOrder, hasEquipment: hasEquip, cubicMetersRemoved: calcM3 });
                      }}
                      style={{ width: '22px', height: '22px', accentColor: '#0369A1' }}
                    />
                    <span style={{ fontSize: '15px', fontWeight: 900, color: (editingOrder.hasEquipment !== false) ? '#0369A1' : 'var(--slate-800)', textAlign: 'center' }}>
                      🚜 Maquinaria (Equipos)
                    </span>
                  </label>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(5)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (editingOrder.hasManualLabor !== false) {
                        setCurrentEditStep(7);
                      } else if (editingOrder.hasEquipment !== false) {
                        setCurrentEditStep(8);
                      } else {
                        setCurrentEditStep(9);
                      }
                    }} 
                    style={{ padding: '12px 24px', fontSize: '13px' }}
                  >
                    Siguiente ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 7: CUADRILLA MANUAL */}
            {currentEditStep === 7 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#047857', margin: 0 }}>
                  👷 Paso 7: Información de Cuadrilla Manual
                </h4>

                <div style={{ padding: '20px', backgroundColor: '#ECFDF5', borderRadius: '16px', border: '1px solid #6EE7B7', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: '#047857', display: 'block', marginBottom: '6px' }}>N° Personas (Cuadrilla)</label>
                    <input 
                      type="number" 
                      min="1" 
                      value={editingOrder.headcount || ''} 
                      onChange={e => { const val = e.target.value; const c = val === '' ? 0 : Number(val); setEditingOrder({ ...editingOrder, headcount: c, cubicMetersRemoved: computeCombinedM3(true, c, editingOrder.realHours || 0, editingOrder.hasEquipment !== false, editingOrder.vehiclePatent, editingOrder.fleetTripsCount || 0, editingOrder.bucketCapacityM3) }); }} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #6EE7B7', fontWeight: 900, fontSize: '15px' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: '#047857', display: 'block', marginBottom: '6px' }}>
                      Horas (HH) (por persona)
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      value={editingOrder.realHours || ''} 
                      onChange={e => { const val = e.target.value; const h = val === '' ? 0 : Number(val); setEditingOrder({ ...editingOrder, realHours: h, estimatedHours: h, cubicMetersRemoved: computeCombinedM3(true, editingOrder.headcount || 0, h, editingOrder.hasEquipment !== false, editingOrder.vehiclePatent, editingOrder.fleetTripsCount || 0, editingOrder.bucketCapacityM3) }); }} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #6EE7B7', fontWeight: 900, fontSize: '15px' }} 
                    />
                  </div>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(6)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (editingOrder.hasEquipment !== false) {
                        setCurrentEditStep(8);
                      } else {
                        setCurrentEditStep(9);
                      }
                    }} 
                    style={{ padding: '12px 24px', fontSize: '13px' }}
                  >
                    Siguiente ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 8: MAQUINARIA DE FLOTA */}
            {currentEditStep === 8 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#0369A1', margin: 0 }}>
                  🚜 Paso 8: Información de Maquinaria (Equipos)
                </h4>

                <div style={{ padding: '20px', backgroundColor: '#F0F9FF', borderRadius: '16px', border: '1px solid #7DD3FC', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '6px' }}>Vehículo de Flota</label>
                    <select 
                      value={editingOrder.vehiclePatent || ''} 
                      onChange={e => { const pat = e.target.value; const m = machines.find(mac => mac.patent === pat); const cap = m?.capacityM3 || 0; setEditingOrder({ ...editingOrder, vehiclePatent: pat, bucketCapacityM3: cap, cubicMetersRemoved: computeCombinedM3(editingOrder.hasManualLabor !== false, editingOrder.headcount || 0, editingOrder.realHours || 0, true, pat, editingOrder.fleetTripsCount || 0, cap) }); }} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #7DD3FC', fontWeight: 900, fontSize: '14px', backgroundColor: '#FFF' }}
                    >
                      <option value="">Selecciona Vehículo...</option>
                      {machines.map(m => (<option key={m.id} value={m.patent}>{m.name} ({m.patent}) - {m.capacityM3 || 0} m³</option>))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '6px' }}>N° Vueltas</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={editingOrder.fleetTripsCount || ''} 
                      onChange={e => { const val = e.target.value; const t = val === '' ? 0 : Number(val); setEditingOrder({ ...editingOrder, fleetTripsCount: t, cubicMetersRemoved: computeCombinedM3(editingOrder.hasManualLabor !== false, editingOrder.headcount || 0, editingOrder.realHours || 0, true, editingOrder.vehiclePatent, t, editingOrder.bucketCapacityM3) }); }} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #7DD3FC', fontWeight: 900, fontSize: '15px' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '6px' }}>
                      Horas Máquina (HM) (por equipo)
                    </label>
                    <input 
                      type="number" 
                      min="0" 
                      step="0.5"
                      value={editingOrder.machineHours || ''} 
                      onChange={e => { const val = e.target.value; const hm = val === '' ? 0 : Number(val); setEditingOrder({ ...editingOrder, machineHours: hm }); }} 
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #7DD3FC', fontWeight: 900, fontSize: '15px' }} 
                    />
                  </div>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        if (editingOrder.hasManualLabor !== false) {
                          setCurrentEditStep(7);
                        } else {
                          setCurrentEditStep(6);
                        }
                      }}
                    >
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentEditStep(9)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                    Siguiente: Detalle & Fotos ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 9: DETALLE / OBSERVACIONES (OPCIONAL) */}
            {currentEditStep === 9 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  📝 Paso 9: Descripción u Observaciones de la Operación (Opcional)
                </h4>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>
                    Detalle u Observaciones (Opcional)
                  </label>
                  <textarea
                    placeholder="Opcional: Escribe aquí cualquier detalle u observación adicional..."
                    value={editingOrder.operationDetail}
                    onChange={e => setEditingOrder({ ...editingOrder, operationDetail: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--slate-300)' }}
                  />
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => {
                        if (editingOrder.hasEquipment !== false) {
                          setCurrentEditStep(8);
                        } else if (editingOrder.hasManualLabor !== false) {
                          setCurrentEditStep(7);
                        } else {
                          setCurrentEditStep(6);
                        }
                      }}
                    >
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                      ✖ Cancelar
                    </button>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '13px', backgroundColor: '#047857', borderColor: '#047857' }}>
                    <Save size={16} /> Guardar Todos los Cambios en la OT
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    )}

      {/* 1-TOUCH SEGMENTED CONTROL BAR ("A PRUEBA DE NIÑOS" - OPTION 1) */}
      <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '20px', border: '1px solid var(--slate-200)', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Control Segmentado 1: Estado */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📌 Filtro por Estado:
            </span>
          </div>
          <div style={{ display: 'flex', backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '14px', gap: '4px', width: '100%' }}>
            <button
              type="button"
              onClick={() => setQuickFilterStatus('ALL')}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: quickFilterStatus === 'ALL' ? 'var(--slate-900)' : 'transparent',
                color: quickFilterStatus === 'ALL' ? '#FFFFFF' : 'var(--slate-700)',
                boxShadow: quickFilterStatus === 'ALL' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              📋 Todas ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setQuickFilterStatus('PENDING')}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: quickFilterStatus === 'PENDING' ? 'var(--orange)' : 'transparent',
                color: quickFilterStatus === 'PENDING' ? '#FFFFFF' : '#C2410C',
                boxShadow: quickFilterStatus === 'PENDING' ? '0 2px 6px rgba(247,122,6,0.3)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              ⏳ Pendientes ({pendingCount})
            </button>

            <button
              type="button"
              onClick={() => setQuickFilterStatus('APPROVED')}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: quickFilterStatus === 'APPROVED' ? '#047857' : 'transparent',
                color: quickFilterStatus === 'APPROVED' ? '#FFFFFF' : '#047857',
                boxShadow: quickFilterStatus === 'APPROVED' ? '0 2px 6px rgba(4,120,87,0.3)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              ✅ Aprobadas ({approvedCount})
            </button>
          </div>
        </div>

        {/* Control Segmentado 2: Turno & Período */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⏱️ Período & Turno:
            </span>
            {quickFilterTime === 'SHIFT_7X7' && (
              <span style={{ fontSize: '10px', fontWeight: 900, color: '#7C3AED', backgroundColor: '#F5F3FF', padding: '2px 8px', borderRadius: '8px' }}>
                🗓️ Turno Activo: {active7x7Range.label}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '14px', gap: '4px', width: '100%' }}>
            <button
              type="button"
              onClick={() => setQuickFilterTime('ALL')}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: quickFilterTime === 'ALL' ? '#0284C7' : 'transparent',
                color: quickFilterTime === 'ALL' ? '#FFFFFF' : 'var(--slate-700)',
                boxShadow: quickFilterTime === 'ALL' ? '0 2px 6px rgba(2,132,199,0.3)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              🌐 Todo
            </button>

            <button
              type="button"
              onClick={() => setQuickFilterTime('SHIFT_7X7')}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: quickFilterTime === 'SHIFT_7X7' ? '#7C3AED' : 'transparent',
                color: quickFilterTime === 'SHIFT_7X7' ? '#FFFFFF' : '#6D28D9',
                boxShadow: quickFilterTime === 'SHIFT_7X7' ? '0 2px 6px rgba(124,58,237,0.3)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              🗓️ Turno 7x7
            </button>

            <button
              type="button"
              onClick={() => setQuickFilterTime('TODAY')}
              style={{
                flex: 1,
                padding: '10px 4px',
                borderRadius: '10px',
                fontWeight: 900,
                fontSize: '12px',
                cursor: 'pointer',
                border: 'none',
                backgroundColor: quickFilterTime === 'TODAY' ? '#2563EB' : 'transparent',
                color: quickFilterTime === 'TODAY' ? '#FFFFFF' : '#1D4ED8',
                boxShadow: quickFilterTime === 'TODAY' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              ☀️ Hoy
            </button>
          </div>
        </div>
      </div>

      {/* Search and Collapsible Filter Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div className="responsive-toolbar" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Search Input */}
          <div className="responsive-search" style={{ flex: 1, position: 'relative', minWidth: 'min(220px, 100%)' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Buscar por N° OT / SAP, Área, Equipo / Correa, Detalle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '12px', border: '1px solid var(--slate-200)', fontSize: '13px' }}
            />
          </div>

          <span style={{ fontSize: '12px', color: 'var(--slate-600)' }}>
            {filteredOrders.length} OT · {['Spot13P', 'Spot72P', 'Base'].map(type => `${type}: ${filteredOrders.filter(o => o.staffingType === type).length}`).join(' · ')} · Sin clasificar: {filteredOrders.filter(o => !o.staffingType).length}
          </span>
          {/* Toggle Filter Menu Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters || (filterStaffingType !== 'ALL' || filterTaskType !== 'ALL' || filterAreaId !== 'ALL' || filterStatus !== 'ALL' || filterShiftId !== 'ALL' || filterDatePreset !== 'ALL') ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}
          >
            <Filter size={15} />
            <span>{showFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}</span>
            {(filterStaffingType !== 'ALL' || filterTaskType !== 'ALL' || filterAreaId !== 'ALL' || filterStatus !== 'ALL' || filterShiftId !== 'ALL' || filterDatePreset !== 'ALL') && (
              <span style={{ backgroundColor: '#FFF', color: 'var(--orange)', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 900 }}>
                { (filterStaffingType !== 'ALL' ? 1 : 0) + (filterTaskType !== 'ALL' ? 1 : 0) + (filterAreaId !== 'ALL' ? 1 : 0) + (filterStatus !== 'ALL' ? 1 : 0) + (filterShiftId !== 'ALL' ? 1 : 0) + (filterDatePreset !== 'ALL' ? 1 : 0) }
              </span>
            )}
            {showFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {(filterStaffingType !== 'ALL' || filterTaskType !== 'ALL' || filterAreaId !== 'ALL' || filterStatus !== 'ALL' || filterShiftId !== 'ALL' || filterDatePreset !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFilterStaffingType('ALL');
                setFilterTaskType('ALL');
                setFilterAreaId('ALL');
                setFilterStatus('ALL');
                setFilterShiftId('ALL');
                setFilterDatePreset('ALL');
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '8px 12px', borderRadius: '10px', color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}
            >
              Restablecer
            </button>
          )}
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="filter-drawer-box responsive-form-grid" style={{ marginTop: '12px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid var(--slate-200)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '12px' }}>
            {/* Date Preset Filter */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>📅 Fecha de Ejecución</label>
              <select
                value={filterDatePreset}
                onChange={(e) => setFilterDatePreset(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF', fontWeight: 800 }}
              >
                <option value="ALL">Todas las Fechas</option>
                <option value="TODAY">📅 Hoy ({new Date().toISOString().split('T')[0]})</option>
                <option value="THIS_WEEK">🗓️ Esta Semana</option>
                <option value="THIS_MONTH">📆 Este Mes</option>
                <option value="CUSTOM">🛠️ Rango Personalizado...</option>
              </select>
            </div>

            {/* Custom Date Range Pickers (shown only when CUSTOM is chosen) */}
            {filterDatePreset === 'CUSTOM' && (
              <>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>Desde (Fecha Inicio)</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>Hasta (Fecha Término)</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF' }}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="staffing-filter">Tipo de dotación</label>
              <select id="staffing-filter" value={filterStaffingType} onChange={e => setFilterStaffingType(e.target.value)} style={{ width: '100%', padding: '8px' }}>
                <option value="ALL">Todas las dotaciones</option>
                {['Spot13P', 'Spot72P', 'Base'].map(type => <option key={type} value={type}>{type}</option>)}
                <option value="UNCLASSIFIED">Sin clasificar</option>
              </select>
            </div>
            {/* Task Type Filter */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>Tipo Tarea</label>
              <select
                value={filterTaskType}
                onChange={(e) => setFilterTaskType(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF', fontWeight: 800 }}
              >
                <option value="ALL">Todos los Tipos</option>
                <option value="PLANIFICADO">📌 Planificado</option>
                <option value="MANTENIMIENTO_PROGRAMADO">🔧 Mantenimiento Programado</option>
                <option value="EMERGENTE">🚨 Emergente</option>
              </select>
            </div>

            {/* Plant Area Filter */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>Área de Planta</label>
              <select
                value={filterAreaId}
                onChange={(e) => setFilterAreaId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF', fontWeight: 800 }}
              >
                <option value="ALL">Todas las Áreas</option>
                {(plantAreas || []).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>Estado Conformidad</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF', fontWeight: 800 }}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDIENTE">⏳ Pendientes ITO</option>
                <option value="APROBADO">✓ Aprobados Mandante</option>
                <option value="CONTINGENCIA">⚠️ Contingencia / Rechazados</option>
              </select>
            </div>

            {/* Shift Filter */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>Turno Operativo</label>
              <select
                value={filterShiftId}
                onChange={(e) => setFilterShiftId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--slate-200)', fontSize: '12px', backgroundColor: '#FFF' }}
              >
                <option value="ALL">Todos los Turnos</option>
                {shifts.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      <div className="ot-sort-summary">
        <div>
          <strong>Orden:</strong>{' '}
          {effectiveSortSpecs.map((spec, index) => `${index + 1}. ${SORT_LABELS[spec.key]} ${spec.direction === 'asc' ? '↑' : '↓'}`).join(' · ')}
          <span className="ot-sort-help">En escritorio: clic en un encabezado; Shift + clic para combinar.</span>
        </div>
        <div className="ot-mobile-sort-controls">
          <select
            aria-label="Columna para ordenar las órdenes"
            value={effectiveSortSpecs[0].key}
            onChange={(event) => setSortSpecs([{ key: event.target.value as WorkOrderSortKey, direction: effectiveSortSpecs[0].direction }])}
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button type="button" onClick={() => setSortSpecs([{ key: effectiveSortSpecs[0].key, direction: effectiveSortSpecs[0].direction === 'asc' ? 'desc' : 'asc' }])}>
            {effectiveSortSpecs[0].direction === 'asc' ? 'Ascendente ↑' : 'Descendente ↓'}
          </button>
        </div>
        {sortSpecs.length > 0 && <button type="button" className="ot-sort-reset" onClick={() => setSortSpecs([])}>Restablecer orden</button>}
      </div>

      {/* DESKTOP TABLE VIEW (> 768px) */}
      <div className="desktop-only-table grid-table-container">
        <table className="operational-table">
          <thead>
            <tr>
              <SortableHeader sortKey="executionDate">Fecha</SortableHeader>
              <SortableHeader sortKey="sapCode">{labels.sapCode}</SortableHeader>
              <th>Tipo de dotación</th>
              <SortableHeader sortKey="taskType">Tipo de Tarea</SortableHeader>
              <SortableHeader sortKey="areaName">Área de Planta</SortableHeader>
              <SortableHeader sortKey="sectorName">Sector / Proceso</SortableHeader>
              <SortableHeader sortKey="equipmentName">Equipo & Componentes</SortableHeader>
              <SortableHeader sortKey="resourceMode">Modalidad</SortableHeader>
              <SortableHeader sortKey="headcount">Dotación</SortableHeader>
              <SortableHeader sortKey="hh">HH</SortableHeader>
              <SortableHeader sortKey="hm">HM</SortableHeader>
              <SortableHeader sortKey="evidence">Evidencia</SortableHeader>
              <SortableHeader sortKey="volume">Volumen (m³)</SortableHeader>
              <SortableHeader sortKey="status">Estado</SortableHeader>
              <th>Certificación ITO / Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-400)' }}>
                  No hay órdenes de trabajo coincidentes con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                return (
                  <tr key={order.id}>
                    <td className="ot-numeric-cell" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {order.executionDate || 'Sin fecha'}
                      <small className="ot-cell-secondary">{order.shiftName}</small>
                    </td>
                    <td>
                      <span className="sap-code-badge">
                        {order.sapCode}
                      </span>
                      {pendingWorkOrderIds.has(order.id) && (
                        <div style={{ fontSize: '9px', color: '#B45309', fontWeight: 900, marginTop: '3px', whiteSpace: 'nowrap' }} title="Guardada en este dispositivo; esperando confirmación de Firebase">
                          ● Pendiente de sincronizar
                        </div>
                      )}
                    </td>
                    <td>{order.staffingType || 'Sin clasificar'}</td>
                    <td>{getTaskTypeBadge(order.taskType)}</td>
                    <td>
                      <span className="pill pill-complete" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC' }}>
                        {order.areaName || 'General'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-800)' }}>{order.sectorName || 'Sector'}</td>
                    <td style={{ fontWeight: 800, color: 'var(--orange)' }}>{order.equipmentName || order.equipoCorrea}</td>
                    <td>
                      {getWorkOrderResourceFlags(order).manual && getWorkOrderResourceFlags(order).equipment ? 'Mixto' : getWorkOrderResourceFlags(order).equipment ? 'Maquinaria' : 'Manual'}
                      {order.vehiclePatent && <small className="ot-cell-secondary">🚜 {order.vehiclePatent}</small>}
                    </td>
                    <td className="ot-numeric-cell">{getWorkOrderResourceFlags(order).manual ? Number(order.headcount) || 0 : '—'}</td>
                    <td className="ot-numeric-cell">{getWorkOrderResourceFlags(order).manual ? ((Number(order.headcount) || 0) * (Number(order.realHours) || 0)).toLocaleString('es-CL') : '—'}</td>
                    <td className="ot-numeric-cell">{getWorkOrderResourceFlags(order).equipment ? (Number(order.machineHours) || 0).toLocaleString('es-CL') : '—'}</td>
                    <td>{getEvidenceProgressBadge(order)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 900, color: 'var(--orange)', fontSize: '15px' }}>
                      {order.cubicMetersRemoved || 0} m³
                    </td>
                    <td>
                      {getStatusBadge(order.status)}
                      {order.itoApproverName && (
                        <div style={{ fontSize: '10px', color: 'var(--orange)', fontWeight: 800, marginTop: '2px' }}>
                          ✍️ {order.itoApproverName} ({order.itoApprovalDate})
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {order.itoSignatureDataUrl && (
                          <img 
                            src={order.itoSignatureDataUrl} 
                            alt="Firma Digital ITO" 
                            style={{ height: '24px', border: '1px solid #CBD5E1', borderRadius: '4px', backgroundColor: '#FFF' }}
                            title="Firma Digital ITO Registrada"
                          />
                        )}

                        {(currentRole === 'ITO_MANDANTE' || currentRole === 'SUPER_ADMIN') && order.status !== 'APROBADO_MANDANTE' && (
                          <button
                            onClick={() => setItoApprovingOrder(order)}
                            className="btn btn-primary"
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            title="Otorgar Conformidad Mandante"
                          >
                            <UserCheck size={14} /> Firmar ITO
                          </button>
                        )}

                        {(currentRole === 'SUPERVISOR_TERRENO' || currentRole === 'ADMINISTRADOR_CONTRATO' || currentRole === 'SUPER_ADMIN') && (
                          <>
                            <button
                              onClick={() => handleOpenEditModal(order)}
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              title="Editar Orden de Trabajo"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(order.id)}
                              className="btn"
                              style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '4px 8px', fontSize: '11px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE STACKED CARDS VIEW (< 768px) */}
      <div className="mobile-only-cards">
        {filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--slate-400)' }}>
            No hay órdenes registradas.
          </div>
        ) : (
          filteredOrders.map(order => {
            const hhGap = order.realHours - order.estimatedHours;
            return (
              <div key={order.id} className="mobile-ot-card">
                <div className="mobile-ot-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="sap-code-badge">{order.sapCode}</span>
                    {pendingWorkOrderIds.has(order.id) && (
                      <span style={{ fontSize: '9px', color: '#B45309', fontWeight: 900 }} title="Esperando confirmación de Firebase">● Pendiente</span>
                    )}
                    {getTaskTypeBadge(order.taskType)}
                    <span>Dotación: {order.staffingType || 'Sin clasificar'}</span>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="mobile-ot-card-body">
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#0369A1', marginBottom: '2px' }}>
                    📍 {order.areaName || 'General'} ➔ {order.sectorName || 'Sector'}
                  </div>
                  <div style={{ fontWeight: 900, color: 'var(--orange)', fontSize: '15px', marginBottom: '4px' }}>
                    {order.equipoCorrea}
                  </div>
                  <div style={{ color: 'var(--slate-900)', fontSize: '13px' }}>
                    {order.operationDetail}
                  </div>
                </div>

                <div className="mobile-ot-card-stats">
                  <div><strong>Fecha:</strong> 📅 {order.executionDate || order.dia || 'Hoy'} ({order.shiftName})</div>
                  <div><strong>Evidencia:</strong> {getEvidenceProgressBadge(order)}</div>
                  <div><strong>Volumen Removido:</strong> <span style={{ color: 'var(--orange)', fontWeight: 900 }}>{order.cubicMetersRemoved || 0} m³</span></div>
                </div>

                <div className="mobile-ot-card-actions">
                  {(currentRole === 'SUPERVISOR_TERRENO' || currentRole === 'ADMINISTRADOR_CONTRATO' || currentRole === 'SUPER_ADMIN') && (
                    <>
                      <button
                        onClick={() => setEditingOrder(order)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      >
                        <Edit size={14} /> Editar
                      </button>
                      <button
                        onClick={() => handleDeleteClick(order.id)}
                        className="btn"
                        style={{ backgroundColor: '#FEF2F2', color: '#991B1B', border: '1px solid #FCA5A5', padding: '6px 10px', fontSize: '12px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Work Order Modal with 3-Step Guided Wizard */}
      {/* ADD WORK ORDER MODAL WIZARD */}
      {showAddModal && (
        <div className="modal-backdrop-overlay">
          <div className="modal-content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                + Crear Nueva Orden de Trabajo (OT)
              </h3>
              <button onClick={handleCancelAddModal} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            {renderStepper(currentAddStep + 1, 11)}

            <form className="responsive-form-grid" onSubmit={handleCreateSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '16px' }}>
              
              {currentAddStep === 0 && (
                <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '18px' }}>
                  <h4>Paso 1: Tipo de dotación</h4>
                  <div className="responsive-option-grid" role="group" aria-label="Tipo de dotación">
                    {(['Spot13P', 'Spot72P', 'Base'] as const).map(type => (
                      <button key={type} type="button" className="btn btn-secondary" aria-pressed={newOrder.staffingType === type}
                        onClick={() => setNewOrder({ ...newOrder, staffingType: type })}
                        style={{ padding: '18px', border: newOrder.staffingType === type ? '2px solid var(--orange)' : '1px solid var(--slate-200)', background: newOrder.staffingType === type ? '#FFF3E6' : '#FFF' }}>{type}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                    <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal}>Cancelar</button>
                    <button type="button" className="btn btn-primary" disabled={!newOrder.staffingType} onClick={() => setCurrentAddStep(1)}>Siguiente: Clasificación de tarea →</button>
                  </div>
                </div>
              )}
              {/* PASO 1: CLASIFICACIÓN DE TAREA */}
              {currentAddStep === 1 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    📋 Paso 2: ¿Qué tipo de tarea es?
                  </h4>
                  <div className="responsive-option-grid">
                    <button
                      type="button"
                      onClick={() => setNewOrder({ ...newOrder, taskType: 'PLANIFICADO' })}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        fontWeight: 900,
                        fontSize: '13px',
                        cursor: 'pointer',
                        border: newOrder.taskType === 'PLANIFICADO' ? '3px solid #10B981' : '2px solid var(--slate-200)',
                        backgroundColor: newOrder.taskType === 'PLANIFICADO' ? '#ECFDF5' : '#FFFFFF',
                        color: newOrder.taskType === 'PLANIFICADO' ? '#047857' : 'var(--slate-600)',
                        boxShadow: newOrder.taskType === 'PLANIFICADO' ? '0 4px 12px rgba(16,185,129,0.15)' : 'none'
                      }}
                    >
                      📌 Planificado
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewOrder({ ...newOrder, taskType: 'MANTENIMIENTO_PROGRAMADO' })}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        fontWeight: 900,
                        fontSize: '13px',
                        cursor: 'pointer',
                        border: newOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '3px solid #0369A1' : '2px solid var(--slate-200)',
                        backgroundColor: newOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '#E0F2FE' : '#FFFFFF',
                        color: newOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '#0369A1' : 'var(--slate-600)',
                        boxShadow: newOrder.taskType === 'MANTENIMIENTO_PROGRAMADO' ? '0 4px 12px rgba(3,105,161,0.15)' : 'none'
                      }}
                    >
                      🔧 Programado
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewOrder({ ...newOrder, taskType: 'EMERGENTE' })}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        fontWeight: 900,
                        fontSize: '13px',
                        cursor: 'pointer',
                        border: newOrder.taskType === 'EMERGENTE' ? '3px solid #DC2626' : '2px solid var(--slate-200)',
                        backgroundColor: newOrder.taskType === 'EMERGENTE' ? '#FEF2F2' : '#FFFFFF',
                        color: newOrder.taskType === 'EMERGENTE' ? '#991B1B' : 'var(--slate-600)',
                        boxShadow: newOrder.taskType === 'EMERGENTE' ? '0 4px 12px rgba(220,38,38,0.15)' : 'none'
                      }}
                    >
                      🚨 Emergente
                    </button>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(0)}>
                      Anterior: Tipo de dotación
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentAddStep(2)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                      Siguiente: Área de Planta ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 2: ÁREA DE PLANTA (NIVEL 1) */}
              {currentAddStep === 2 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    🌐 Paso 3: Selecciona el Área de Planta (Nivel 1)
                  </h4>
                  <div style={{ backgroundColor: '#F0F9FF', padding: '20px', borderRadius: '18px', border: '2px solid #BAE6FD' }}>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Área Principal de Minera
                    </label>
                    <select
                      value={selectedAreaId}
                      onChange={e => handleAreaChange(e.target.value)}
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #7DD3FC', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                      required
                    >
                      <option value="">Selecciona Área de Planta (Ej: Área Seca)...</option>
                      {(plantAreas || []).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(1)}>
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!selectedAreaId) { alert('Selecciona el Área antes de continuar.'); return; }
                        setCurrentAddStep(3);
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente: Sector / Proceso ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 3: SECTOR / PROCESO (NIVEL 2) */}
              {currentAddStep === 3 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    📍 Paso 4: Selecciona el Sector o Proceso (Nivel 2)
                  </h4>
                  <div style={{ backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '18px', border: '2px solid var(--slate-200)' }}>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Sector / Proceso Operativo
                    </label>
                    <select
                      value={selectedSectorId}
                      onChange={e => handleSectorChange(e.target.value)}
                      style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid var(--slate-300)', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                      required
                    >
                      <option value="">Selecciona Sector (Ej: Chancador Terciario)...</option>
                      {availableSectors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(2)}>
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!selectedSectorId) { alert('Selecciona el Sector antes de continuar.'); return; }
                        setCurrentAddStep(4);
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente: Equipo Principal ➔
                    </button>
                  </div>
                </div>
              )}
              {currentAddStep === 4 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    ⚙️ Paso 5: Selecciona el Equipo / Correa Principal (Nivel 3)
                  </h4>
                  
                  {/* Selector de Sector Nivel 2 */}
                  <div style={{ backgroundColor: '#F8FAFC', padding: '14px 16px', borderRadius: '16px', border: '1px solid var(--slate-200)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-700)', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
                      📍 Sector / Proceso Operativo (Nivel 2)
                    </label>
                    <select
                      value={selectedSectorId}
                      onChange={e => handleSectorChange(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--slate-300)', fontWeight: 800, fontSize: '13px', backgroundColor: '#FFF' }}
                    >
                      <option value="">Todos los Sectores...</option>
                      {availableSectors.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ backgroundColor: '#FFF7ED', padding: '16px', borderRadius: '16px', border: '2px solid #FFEDD5' }}>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--orange)', display: 'block', marginBottom: '6px' }}>
                      Equipo / Correa Principal (Nivel 3) * (Obligatorio)
                    </label>
                    <select
                      value={selectedEquipmentId}
                      onChange={e => handleEquipmentChange(e.target.value)}
                      style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #FDBA74', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                      required
                    >
                      <option value="">Selecciona Equipo (Ej: CT-106)...</option>
                      {availableEquipments.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>N° OT (Correlativo)</label>
                    <input type="text" value={newOrder.sapCode || getNextOtCode()} readOnly disabled style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-300)', backgroundColor: '#E2E8F0', fontWeight: 900, color: '#475569' }} />
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(3)}>
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!selectedEquipmentId) { alert('Selecciona el Equipo antes de continuar.'); return; }
                        setSelectedSubSectorNames([]); // Guarantees NO badge is pre-selected
                        setCurrentAddStep(5);
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente: Componentes (Badges) ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 5: SELECCIÓN DE COMPONENTES INTERVENIDOS (NIVEL 4 BADGES - POR DEFECTO NINGUNO SELECCIONADO) */}
              {currentAddStep === 5 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    🏷️ Paso 6: Selecciona los Componentes Intervenidos (Nivel 4)
                  </h4>
                  
                  <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: selectedSubSectorNames.length === 0 ? '2px solid #EF4444' : '1px solid var(--slate-200)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block' }}>
                        Componentes Intervenidos (Badges Multiseleccionables) <span style={{ color: '#EF4444' }}>* (Obligatorio)</span>
                      </label>
                      {selectedSubSectorNames.length === 0 && (
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#EF4444', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '8px' }}>
                          ⚠️ Ningún componente seleccionado
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {availableSubSectors.map(sub => {
                        const isSelected = selectedSubSectorNames.includes(sub.name);
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            className="badge-select-btn"
                            onClick={() => toggleSubSectorSelection(sub.name)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: 800,
                              border: isSelected ? '2px solid var(--orange)' : '1px solid var(--slate-300)',
                              backgroundColor: isSelected ? 'var(--orange)' : '#FFFFFF',
                              color: isSelected ? '#FFFFFF' : 'var(--slate-700)',
                              cursor: 'pointer'
                            }}
                          >
                            {isSelected ? '✓ ' : '+ '} {sub.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(4)}>
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (selectedSubSectorNames.length === 0) {
                          alert('⚠️ Por favor selecciona al menos 1 Componente Intervenido (Nivel 4) para continuar.');
                          return;
                        }
                        setCurrentAddStep(6);
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente: Recursos Utilizados ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 6: SELECCIÓN DE RECURSOS (POR DEFECTO NINGUNO SELECCIONADO) */}
              {currentAddStep === 6 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    🚜👷 Paso 7: Selecciona los Recursos Utilizados
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--slate-600)', margin: 0 }}>
                    Haz clic en la(s) opción(es) que requieres para esta Orden de Trabajo:
                  </p>

                  <div className="responsive-option-grid" style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: (!newOrder.hasManualLabor && !newOrder.hasEquipment) ? '2px solid #EF4444' : '1px solid var(--slate-200)' }}>
                    <div 
                      onClick={() => {
                        const hasManual = !newOrder.hasManualLabor;
                        const calcM3 = computeCombinedM3(hasManual, newOrder.headcount || 0, newOrder.realHours || 0, newOrder.hasEquipment, newOrder.vehiclePatent, newOrder.fleetTripsCount || 0, newOrder.bucketCapacityM3);
                        setNewOrder({ ...newOrder, hasManualLabor: hasManual, cubicMetersRemoved: calcM3 });
                      }}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '12px', 
                        padding: '24px 16px',
                        borderRadius: '16px',
                        border: newOrder.hasManualLabor ? '3px solid var(--orange)' : '2px dashed var(--slate-300)',
                        backgroundColor: newOrder.hasManualLabor ? '#FFF7ED' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: newOrder.hasManualLabor ? '0 4px 12px rgba(247,122,6,0.15)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '28px' }}>👷‍♂️</span>
                      <span style={{ fontSize: '15px', fontWeight: 900, color: newOrder.hasManualLabor ? 'var(--orange)' : 'var(--slate-700)', textAlign: 'center' }}>
                        {newOrder.hasManualLabor ? '✓ Trabajo Manual (Cuadrilla)' : '+ Agregar Trabajo Manual'}
                      </span>
                    </div>

                    <div 
                      onClick={() => {
                        const hasEquip = !newOrder.hasEquipment;
                        const calcM3 = computeCombinedM3(newOrder.hasManualLabor, newOrder.headcount || 0, newOrder.realHours || 0, hasEquip, newOrder.vehiclePatent, newOrder.fleetTripsCount || 0, newOrder.bucketCapacityM3);
                        setNewOrder({ ...newOrder, hasEquipment: hasEquip, cubicMetersRemoved: calcM3 });
                      }}
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: '12px', 
                        padding: '24px 16px',
                        borderRadius: '16px',
                        border: newOrder.hasEquipment ? '3px solid #0369A1' : '2px dashed var(--slate-300)',
                        backgroundColor: newOrder.hasEquipment ? '#F0F9FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: newOrder.hasEquipment ? '0 4px 12px rgba(3,105,161,0.15)' : 'none'
                      }}
                    >
                      <span style={{ fontSize: '28px' }}>🚜</span>
                      <span style={{ fontSize: '15px', fontWeight: 900, color: newOrder.hasEquipment ? '#0369A1' : 'var(--slate-700)', textAlign: 'center' }}>
                        {newOrder.hasEquipment ? '✓ Maquinaria (Equipos)' : '+ Agregar Maquinaria'}
                      </span>
                    </div>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(5)}>
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!newOrder.hasManualLabor && !newOrder.hasEquipment) {
                          alert('⚠️ Por favor selecciona al menos 1 tipo de recurso (Trabajo Manual o Maquinaria de Flota) para continuar.');
                          return;
                        }
                        if (newOrder.hasManualLabor) {
                          setCurrentAddStep(7);
                        } else if (newOrder.hasEquipment) {
                          setCurrentAddStep(8);
                        } else {
                          setCurrentAddStep(9);
                        }
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 7: CUADRILLA MANUAL */}
              {currentAddStep === 7 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#047857', margin: 0 }}>
                    👷 Paso 8: Información de Cuadrilla Manual
                  </h4>

                  <div style={{ padding: '20px', backgroundColor: '#ECFDF5', borderRadius: '16px', border: '1px solid #6EE7B7', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: '#047857', display: 'block', marginBottom: '6px' }}>N° Personas (Cuadrilla)</label>
                      <input 
                        type="number" 
                        min="1" 
                        value={newOrder.headcount || ''} 
                        onChange={e => { const val = e.target.value; const c = val === '' ? 0 : Number(val); setNewOrder({ ...newOrder, headcount: c, cubicMetersRemoved: computeCombinedM3(true, c, newOrder.realHours || 0, newOrder.hasEquipment, newOrder.vehiclePatent, newOrder.fleetTripsCount || 0, newOrder.bucketCapacityM3) }); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #6EE7B7', fontWeight: 900, fontSize: '15px' }} 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: '#047857', display: 'block', marginBottom: '6px' }}>
                        Horas (HH) (por persona)
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        value={newOrder.realHours || ''} 
                        onChange={e => { const val = e.target.value; const h = val === '' ? 0 : Number(val); setNewOrder({ ...newOrder, realHours: h, estimatedHours: h, cubicMetersRemoved: computeCombinedM3(true, newOrder.headcount || 0, h, newOrder.hasEquipment, newOrder.vehiclePatent, newOrder.fleetTripsCount || 0, newOrder.bucketCapacityM3) }); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #6EE7B7', fontWeight: 900, fontSize: '15px' }} 
                      />
                    </div>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(6)}>
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (newOrder.hasEquipment) {
                          setCurrentAddStep(8);
                        } else {
                          setCurrentAddStep(9);
                        }
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 8: MAQUINARIA DE FLOTA */}
              {currentAddStep === 8 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: '#0369A1', margin: 0 }}>
                    🚜 Paso 9: Información de Maquinaria (Equipos)
                  </h4>

                  <div style={{ padding: '20px', backgroundColor: '#F0F9FF', borderRadius: '16px', border: '1px solid #7DD3FC', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '6px' }}>Vehículo de Flota</label>
                      <select 
                        value={newOrder.vehiclePatent || ''} 
                        onChange={e => { const pat = e.target.value; const m = machines.find(mac => mac.patent === pat); const cap = m?.capacityM3 || 0; setNewOrder({ ...newOrder, vehiclePatent: pat, bucketCapacityM3: cap, cubicMetersRemoved: computeCombinedM3(newOrder.hasManualLabor, newOrder.headcount || 0, newOrder.realHours || 0, true, pat, newOrder.fleetTripsCount || 0, cap) }); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #7DD3FC', fontWeight: 900, fontSize: '14px', backgroundColor: '#FFF' }}
                      >
                        <option value="">Selecciona Vehículo...</option>
                        {machines.map(m => (<option key={m.id} value={m.patent}>{m.name} ({m.patent}) - {m.capacityM3 || 0} m³</option>))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '6px' }}>N° Vueltas</label>
                      <input 
                        type="number" 
                        min="0" 
                        value={newOrder.fleetTripsCount || ''} 
                        onChange={e => { const val = e.target.value; const t = val === '' ? 0 : Number(val); setNewOrder({ ...newOrder, fleetTripsCount: t, cubicMetersRemoved: computeCombinedM3(newOrder.hasManualLabor, newOrder.headcount || 0, newOrder.realHours || 0, true, newOrder.vehiclePatent, t, newOrder.bucketCapacityM3) }); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #7DD3FC', fontWeight: 900, fontSize: '15px' }} 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: '#0369A1', display: 'block', marginBottom: '6px' }}>
                        Horas Máquina (HM) (por equipo)
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.5"
                        value={newOrder.machineHours || ''} 
                        onChange={e => { const val = e.target.value; const hm = val === '' ? 0 : Number(val); setNewOrder({ ...newOrder, machineHours: hm }); }} 
                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #7DD3FC', fontWeight: 900, fontSize: '15px' }} 
                      />
                    </div>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => {
                          if (newOrder.hasManualLabor) {
                            setCurrentAddStep(7);
                          } else {
                            setCurrentAddStep(6);
                          }
                        }}
                      >
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentAddStep(9)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                      Siguiente: Fecha & Turno ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 9: FECHA & TURNO */}
              {currentAddStep === 9 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    ⏱️ Paso 10: ¿Cuándo y en qué Turno se ejecutó?
                  </h4>
                  
                  <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>📅 Fecha de Ejecución</label>
                      <input
                        type="date"
                        value={newOrder.executionDate || new Date().toISOString().split('T')[0]}
                        onChange={e => setNewOrder({ ...newOrder, ...getOrderDateMetadata(e.target.value) })}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--slate-300)', fontWeight: 800, fontSize: '14px' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>Turno Asignado</label>
                      <select
                        value={newOrder.shiftId}
                        onChange={e => setNewOrder({ ...newOrder, shiftId: e.target.value })}
                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid var(--slate-300)', fontWeight: 800, fontSize: '14px', backgroundColor: '#FFF' }}
                      >
                        {shifts.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => {
                          if (newOrder.hasEquipment) {
                            setCurrentAddStep(8);
                          } else if (newOrder.hasManualLabor) {
                            setCurrentAddStep(7);
                          } else {
                            setCurrentAddStep(6);
                          }
                        }}
                      >
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentAddStep(10)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                      Siguiente: Detalle & Fotos ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 10: DETALLE / OBSERVACIONES (OPCIONAL) */}
              {currentAddStep === 10 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    📝 Paso 11: Descripción u Observaciones de la Operación (Opcional)
                  </h4>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>
                      Detalle u Observaciones (Opcional)
                    </label>
                    <textarea
                      placeholder="Opcional: Escribe aquí cualquier detalle u observación adicional..."
                      value={newOrder.operationDetail}
                      onChange={e => setNewOrder({ ...newOrder, operationDetail: e.target.value })}
                      rows={3}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--slate-300)' }}
                    />
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => setCurrentAddStep(9)}
                      >
                        ◄ Atrás
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleCancelAddModal} style={{ color: '#991B1B', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5' }}>
                        ✖ Cancelar
                      </button>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '13px', backgroundColor: '#047857', borderColor: '#047857' }}>
                      <CheckCircle2 size={16} /> Guardar Orden de Trabajo
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
