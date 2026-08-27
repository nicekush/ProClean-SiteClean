import React, { useState, useRef, useEffect } from 'react';
import type { WorkOrder, WorkOrderStatus, WhiteLabelConfig, ShiftType, UserRole, Machine, ContingencyReasonConfig, PlantArea, Sector, SubSector, TaskType, PlantEquipment } from '../types';
import { Plus, Filter, Search, CheckCircle2, Clock, AlertTriangle, FileSpreadsheet, Edit, Trash2, X, Save, UserCheck, Eraser, PenTool, AlertOctagon, Camera, Upload, Layers, MapPin, Grid, Wrench, Users, Tag, Cpu, ChevronDown, ChevronUp } from 'lucide-react';
import * as XLSX from 'xlsx';

interface WorkOrdersGridProps {
  workOrders: WorkOrder[];
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

export const WorkOrdersGrid: React.FC<WorkOrdersGridProps> = ({
  workOrders,
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
  const [filterShiftId, setFilterShiftId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAreaId, setFilterAreaId] = useState<string>('ALL');
  const [filterTaskType, setFilterTaskType] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentAddStep, setCurrentAddStep] = useState<number>(1);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [currentEditStep, setCurrentEditStep] = useState<number>(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [reportingContingencyOrder, setReportingContingencyOrder] = useState<WorkOrder | null>(null);
  const [selectedContingencyReason, setSelectedContingencyReason] = useState<string>('');
  const [contingencyComments, setContingencyComments] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);

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
    executionDate: new Date().toISOString().split('T')[0],
    semana: 33,
    dia: 'Lunes 15/08',
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
    hasManualLabor: true,
    hasEquipment: true,
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

  // Filtered Options for 4-Level Cascading Dropdowns (New OT)
  const availableSectors = (sectors || []).filter(s => !selectedAreaId || s.areaId === selectedAreaId);
  const availableEquipments = (equipments || []).filter(e => !selectedSectorId || e.sectorId === selectedSectorId);
  const availableSubSectors = (subSectors || []).filter(sub => {
    if (selectedEquipmentId) return sub.equipmentId === selectedEquipmentId;
    if (selectedSectorId) return sub.sectorId === selectedSectorId;
    return true;
  });

  // Filtered Options for 4-Level Cascading Dropdowns (Edit OT)
  const editAvailableSectors = (sectors || []).filter(s => !editSelectedAreaId || s.areaId === editSelectedAreaId);
  const editAvailableEquipments = (equipments || []).filter(e => !editSelectedSectorId || e.sectorId === editSelectedSectorId);
  const editAvailableSubSectors = (subSectors || []).filter(sub => {
    if (editSelectedEquipmentId) return sub.equipmentId === editSelectedEquipmentId;
    if (editSelectedSectorId) return sub.sectorId === editSelectedSectorId;
    return true;
  });

  const handleOpenEditModal = (order: WorkOrder) => {
    setEditingOrder({ ...order });
    setEditSelectedAreaId(order.areaId || '');
    setEditSelectedSectorId(order.sectorId || '');
    setEditSelectedEquipmentId(order.equipmentId || '');
    setEditSelectedSubSectorNames(order.selectedSubSectorNames || []);
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
    setSelectedSubSectorNames([]);
    const equip = (equipments || []).find(e => e.id === equipmentId);
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

  const filteredOrders = workOrders.filter(order => {
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

    return matchesSearch && matchesShift && matchesStatus && matchesArea && matchesTaskType;
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.sapCode) return;

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
      headcount: newOrder.hasManualLabor ? newOrder.headcount : 0,
      vehiclePatent: newOrder.hasEquipment ? newOrder.vehiclePatent : '',
      equipoCorrea: finalEquipo,
      equipmentName: equipName,
      selectedSubSectorNames,
      shiftName: selectedShift.name
    });

    setShowAddModal(false);
    setSelectedAreaId('');
    setSelectedSectorId('');
    setSelectedEquipmentId('');
    setSelectedSubSectorNames([]);
    setNewOrder({
      executionDate: new Date().toISOString().split('T')[0],
      semana: 33,
      dia: 'Lunes 15/08',
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
      hasManualLabor: true,
      hasEquipment: true,
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
      selectedSubSectorNames: editSelectedSubSectorNames,
      shiftName: selectedShift.name,
      headcount: editingOrder.hasManualLabor ? editingOrder.headcount : 0,
      vehiclePatent: editingOrder.hasEquipment ? editingOrder.vehiclePatent : ''
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
      'Tipo de Tarea': o.taskType || 'Planificado',
      'Área de Planta (Nivel 1)': o.areaName || 'General',
      'Sector / Proceso (Nivel 2)': o.sectorName || '-',
      'Equipo / Sistema (Nivel 3)': o.equipmentName || o.equipoCorrea,
      'Sub-Sectores & Componentes (Nivel 4)': o.selectedSubSectorNames ? o.selectedSubSectorNames.join(', ') : '-',
      'Modalidad Recursos': o.hasManualLabor && o.hasEquipment ? 'Manual + Equipos' : o.hasEquipment ? 'Solo Equipos' : 'Solo Manual',
      'Turno': o.shiftName,
      'N° OT / SAP': o.sapCode,
      'Operación / Detalle': o.operationDetail,
      'Patente / Vehículo': o.vehiclePatent || '-',
      'N° Personas': o.headcount,
      'HH Estimadas': o.estimatedHours,
      'Trabajo Real (HH)': o.realHours,
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

  const renderStepper = (currentStep: number, totalSteps: number = 9) => {
    const stepTitles = [
      '1. Clasificación Tarea',
      '2. Área de Planta',
      '3. Sector / Proceso',
      '4. Equipo & Componentes',
      '5. Fecha & Turno',
      '6. Selección de Recursos',
      '7. Cuadrilla Manual',
      '8. Maquinaria de Flota',
      '9. Detalle & Fotos'
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
            Layout Operativo & Workflow de Aprobación ITO Mandante
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginTop: '2px' }}>
            Matriz de Planta Zaldívar en 4 Niveles (Área ➔ Sector ➔ Equipo ➔ Sub-Sectores Badges), recursos y firma digital
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={exportToExcel} className="btn btn-secondary">
            <FileSpreadsheet size={16} /> Exportar Excel 4N
          </button>

          {(currentRole === 'SUPERVISOR_TERRENO' || currentRole === 'ADMINISTRADOR_CONTRATO' || currentRole === 'SUPER_ADMIN') && (
            <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
              <Plus size={16} /> + Nueva Orden de Trabajo
            </button>
          )}
        </div>
      </div>

      {/* Quick Contingency Report Modal */}
      {reportingContingencyOrder && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#FFF', padding: '24px', borderRadius: '24px', width: '100%', maxWidth: '500px', boxShadow: 'var(--shadow-lg)', border: '2px solid #FCA5A5' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ backgroundColor: '#FFF', padding: '24px', borderRadius: '24px', width: '100%', maxWidth: '560px', boxShadow: 'var(--shadow-lg)', border: '2px solid var(--orange)', maxHeight: '90vh', overflowY: 'auto' }}>
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

            {renderStepper(currentEditStep, 9)}

          <form onSubmit={handleUpdateSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(1)}>
                    ◄ Atrás
                  </button>
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(2)}>
                    ◄ Atrás
                  </button>
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

            {/* PASO 4: EQUIPO (NIVEL 3) & COMPONENTES (NIVEL 4) */}
            {currentEditStep === 4 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  ⚙️ Paso 4: Selecciona Equipo Principal (Nivel 3) & Componentes (Nivel 4)
                </h4>
                
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(3)}>
                    ◄ Atrás
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={() => {
                      if (!editSelectedEquipmentId) { alert('Selecciona el Equipo antes de continuar.'); return; }
                      if (editSelectedSubSectorNames.length === 0) { alert('Debes seleccionar al menos un Componente Intervenido (Nivel 4) para continuar.'); return; }
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
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>📅 Fecha de Ejecución</label>
                    <input
                      type="date"
                      value={editingOrder.executionDate || new Date().toISOString().split('T')[0]}
                      onChange={e => setEditingOrder({ ...editingOrder, executionDate: e.target.value })}
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(4)}>
                    ◄ Atrás
                  </button>
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(5)}>
                    ◄ Atrás
                  </button>
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentEditStep(6)}>
                    ◄ Atrás
                  </button>
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

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
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
                  <button type="button" className="btn btn-primary" onClick={() => setCurrentEditStep(9)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                    Siguiente: Detalle & Fotos ➔
                  </button>
                </div>
              </div>
            )}

            {/* PASO 9: DETALLE & FOTOS */}
            {currentEditStep === 9 && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  📸 Paso 9: Descripción de la Operación & Evidencias Fotográficas
                </h4>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>Detalle de la Operación</label>
                  <textarea
                    value={editingOrder.operationDetail}
                    onChange={e => setEditingOrder({ ...editingOrder, operationDetail: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--slate-300)' }}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '14px', backgroundColor: 'var(--slate-50)', borderRadius: '16px', border: '1px dashed var(--slate-300)' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: '#991B1B', display: 'block', marginBottom: '6px' }}>📸 Foto ANTES</label>
                    {editingOrder.beforePhotoUrl && <div style={{ fontSize: '11px', color: '#047857', fontWeight: 900, marginBottom: '4px' }}>✓ Foto Inicial Cargada</div>}
                    <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex' }}>
                      <Upload size={14} /> Cargar ANTES
                      <input type="file" accept="image/*" onChange={e => handleBeforeFileUpload(e, true)} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: '#047857', display: 'block', marginBottom: '6px' }}>📸 Foto DESPUÉS</label>
                    {editingOrder.afterPhotoUrl && <div style={{ fontSize: '11px', color: '#047857', fontWeight: 900, marginBottom: '4px' }}>✓ Foto Final Cargada</div>}
                    <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', cursor: 'pointer', display: 'inline-flex' }}>
                      <Upload size={14} /> Cargar DESPUÉS
                      <input type="file" accept="image/*" onChange={e => handleAfterFileUpload(e, true)} style={{ display: 'none' }} />
                    </label>
                  </div>
                </div>

                <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
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

      {/* Search and Collapsible Filter Controls */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Quick Search Input */}
          <div style={{ flex: 1, position: 'relative', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Buscar por N° OT / SAP, Área, Equipo / Correa, Detalle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '12px', border: '1px solid var(--slate-200)', fontSize: '13px' }}
            />
          </div>

          {/* Toggle Filter Menu Button */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`btn ${showFilters || (filterTaskType !== 'ALL' || filterAreaId !== 'ALL' || filterStatus !== 'ALL' || filterShiftId !== 'ALL') ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 800 }}
          >
            <Filter size={15} />
            <span>{showFilters ? 'Ocultar Filtros' : 'Filtros Avanzados'}</span>
            {(filterTaskType !== 'ALL' || filterAreaId !== 'ALL' || filterStatus !== 'ALL' || filterShiftId !== 'ALL') && (
              <span style={{ backgroundColor: '#FFF', color: 'var(--orange)', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 900 }}>
                { (filterTaskType !== 'ALL' ? 1 : 0) + (filterAreaId !== 'ALL' ? 1 : 0) + (filterStatus !== 'ALL' ? 1 : 0) + (filterShiftId !== 'ALL' ? 1 : 0) }
              </span>
            )}
            {showFilters ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {(filterTaskType !== 'ALL' || filterAreaId !== 'ALL' || filterStatus !== 'ALL' || filterShiftId !== 'ALL' || searchTerm) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setFilterTaskType('ALL');
                setFilterAreaId('ALL');
                setFilterStatus('ALL');
                setFilterShiftId('ALL');
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
          <div className="filter-drawer-box" style={{ marginTop: '12px', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid var(--slate-200)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
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

      {/* DESKTOP TABLE VIEW (> 768px) */}
      <div className="desktop-only-table grid-table-container">
        <table className="operational-table">
          <thead>
            <tr>
              <th>Tipo de Tarea</th>
              <th>Área de Planta</th>
              <th>Sector / Proceso</th>
              <th>{labels.sapCode}</th>
              <th>Equipo & Componentes (Nivel 3/4)</th>
              <th>Recursos Operativos</th>
              <th>Evidencia Visual</th>
              <th>Volumen Removido (m³)</th>
              <th>Estado Conformidad</th>
              <th>Certificación ITO / Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--slate-400)' }}>
                  No hay órdenes de trabajo coincidentes con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                return (
                  <tr key={order.id}>
                    <td>
                      {getTaskTypeBadge(order.taskType)}
                    </td>
                    <td>
                      <span className="pill pill-complete" style={{ backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #7DD3FC' }}>
                        {order.areaName || 'General'}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-800)' }}>
                      {order.sectorName || 'Sector'}
                    </td>
                    <td>
                      <span className="sap-code-badge">
                        {order.sapCode}
                      </span>
                      <div style={{ fontSize: '10px', color: 'var(--slate-500)', marginTop: '2px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        📅 {order.executionDate || order.dia || 'Hoy'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--orange)' }}>{order.equipoCorrea}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {order.hasManualLabor !== false && (
                          <span className="pill pill-complete" style={{ fontSize: '10px', padding: '2px 6px' }}>
                            👷 {order.headcount} pers.
                          </span>
                        )}
                        {order.hasEquipment !== false && order.vehiclePatent && (
                          <span className="pill pill-pending" style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: '#F1F5F9', color: '#334155' }}>
                            🚜 {order.vehiclePatent}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {getEvidenceProgressBadge(order)}
                    </td>
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
                    {getTaskTypeBadge(order.taskType)}
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
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px' }}><X size={16} /></button>
            </div>

            {renderStepper(currentAddStep, 9)}

            <form onSubmit={handleCreateSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              
              {/* PASO 1: CLASIFICACIÓN DE TAREA */}
              {currentAddStep === 1 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    📋 Paso 1: ¿Qué tipo de tarea es?
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
                    <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                      Cancelar
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
                    🌐 Paso 2: Selecciona el Área de Planta (Nivel 1)
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

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(1)}>
                      ◄ Atrás
                    </button>
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
                    📍 Paso 3: Selecciona el Sector o Proceso (Nivel 2)
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

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(2)}>
                      ◄ Atrás
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!selectedSectorId) { alert('Selecciona el Sector antes de continuar.'); return; }
                        setCurrentAddStep(4);
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente: Equipo & Componentes ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 4: EQUIPO (NIVEL 3) & COMPONENTES (NIVEL 4) */}
              {currentAddStep === 4 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    ⚙️ Paso 4: Selecciona Equipo Principal (Nivel 3) & Componentes (Nivel 4)
                  </h4>
                  
                  <div style={{ backgroundColor: '#FFF7ED', padding: '16px', borderRadius: '16px', border: '2px solid #FFEDD5' }}>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--orange)', display: 'block', marginBottom: '6px' }}>
                      Equipo / Correa Principal (Nivel 3)
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

                  {availableSubSectors.length > 0 && (
                    <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: selectedSubSectorNames.length === 0 ? '2px solid #EF4444' : '1px solid var(--slate-200)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block' }}>
                          Componentes Intervenidos (Nivel 4 Badges Multiseleccionables) <span style={{ color: '#EF4444' }}>* (Obligatorio)</span>
                        </label>
                        {selectedSubSectorNames.length === 0 && (
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#EF4444', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '8px' }}>
                            ⚠️ Selecciona al menos 1
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
                  )}

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-600)', display: 'block', marginBottom: '4px' }}>N° OT (Correlativo)</label>
                    <input type="text" value={newOrder.sapCode || getNextOtCode()} readOnly disabled style={{ width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid var(--slate-300)', backgroundColor: '#E2E8F0', fontWeight: 900, color: '#475569' }} />
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(3)}>
                      ◄ Atrás
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
                        if (!selectedEquipmentId) { alert('Selecciona el Equipo antes de continuar.'); return; }
                        if (selectedSubSectorNames.length === 0) { alert('Debes seleccionar al menos un Componente Intervenido (Nivel 4) para continuar.'); return; }
                        setCurrentAddStep(5);
                      }} 
                      style={{ padding: '12px 24px', fontSize: '13px' }}
                    >
                      Siguiente: Fecha & Turno ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 5: FECHA & TURNO */}
              {currentAddStep === 5 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    ⏱️ Paso 5: ¿Cuándo y en qué Turno se ejecutó?
                  </h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>📅 Fecha de Ejecución</label>
                      <input
                        type="date"
                        value={newOrder.executionDate || new Date().toISOString().split('T')[0]}
                        onChange={e => setNewOrder({ ...newOrder, executionDate: e.target.value })}
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

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(4)}>
                      ◄ Atrás
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentAddStep(6)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                      Siguiente: Recursos & m³ ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 6: SELECCIÓN DE RECURSOS */}
              {currentAddStep === 6 && (
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
                        border: newOrder.hasManualLabor ? '2px solid var(--orange)' : '1px solid var(--slate-300)',
                        backgroundColor: newOrder.hasManualLabor ? '#FFF7ED' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newOrder.hasManualLabor}
                        onChange={e => {
                          const hasManual = e.target.checked;
                          const calcM3 = computeCombinedM3(hasManual, newOrder.headcount || 0, newOrder.realHours || 0, newOrder.hasEquipment, newOrder.vehiclePatent, newOrder.fleetTripsCount || 0, newOrder.bucketCapacityM3);
                          setNewOrder({ ...newOrder, hasManualLabor: hasManual, cubicMetersRemoved: calcM3 });
                        }}
                        style={{ width: '22px', height: '22px', accentColor: 'var(--orange)' }}
                      />
                      <span style={{ fontSize: '15px', fontWeight: 900, color: newOrder.hasManualLabor ? 'var(--orange)' : 'var(--slate-800)', textAlign: 'center' }}>
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
                        border: newOrder.hasEquipment ? '2px solid #0369A1' : '1px solid var(--slate-300)',
                        backgroundColor: newOrder.hasEquipment ? '#F0F9FF' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={newOrder.hasEquipment}
                        onChange={e => {
                          const hasEquip = e.target.checked;
                          const calcM3 = computeCombinedM3(newOrder.hasManualLabor, newOrder.headcount || 0, newOrder.realHours || 0, hasEquip, newOrder.vehiclePatent, newOrder.fleetTripsCount || 0, newOrder.bucketCapacityM3);
                          setNewOrder({ ...newOrder, hasEquipment: hasEquip, cubicMetersRemoved: calcM3 });
                        }}
                        style={{ width: '22px', height: '22px', accentColor: '#0369A1' }}
                      />
                      <span style={{ fontSize: '15px', fontWeight: 900, color: newOrder.hasEquipment ? '#0369A1' : 'var(--slate-800)', textAlign: 'center' }}>
                        🚜 Maquinaria (Equipos)
                      </span>
                    </label>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(5)}>
                      ◄ Atrás
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => {
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
                    👷 Paso 7: Información de Cuadrilla Manual
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

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setCurrentAddStep(6)}>
                      ◄ Atrás
                    </button>
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
                    🚜 Paso 8: Información de Maquinaria (Equipos)
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

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
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
                    <button type="button" className="btn btn-primary" onClick={() => setCurrentAddStep(9)} style={{ padding: '12px 24px', fontSize: '13px' }}>
                      Siguiente: Detalle & Fotos ➔
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 9: DETALLE & FOTOS */}
              {currentAddStep === 9 && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h4 style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                    📸 Paso 9: Descripción de la Operación & Evidencias Fotográficas
                  </h4>

                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)', display: 'block', marginBottom: '6px' }}>Detalle de la Operación</label>
                    <textarea
                      placeholder="Descripción del trabajo de aseo industrial..."
                      value={newOrder.operationDetail}
                      onChange={e => setNewOrder({ ...newOrder, operationDetail: e.target.value })}
                      rows={3}
                      style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--slate-300)' }}
                      required
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1', padding: '14px', borderRadius: '14px', backgroundColor: '#FEF2F2', border: '1px dashed #FCA5A5' }}>
                    <label style={{ fontSize: '11px', fontWeight: 900, color: '#991B1B', display: 'block', marginBottom: '6px' }}>
                      📸 Adjuntar Foto ANTES (Estado Inicial / Sucio) [Opcional]
                    </label>
                    {newOrder.beforePhotoUrl && (
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 900, marginBottom: '4px' }}>✓ Foto Inicial Cargada</div>
                    )}
                    <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex' }}>
                      <Upload size={14} /> Seleccionar Imagen ANTES
                      <input type="file" accept="image/*" onChange={e => handleBeforeFileUpload(e, false)} style={{ display: 'none' }} />
                    </label>
                  </div>

                  <div className="modal-action-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
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
