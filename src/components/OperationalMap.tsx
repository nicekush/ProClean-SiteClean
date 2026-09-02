import React, { useState } from 'react';
import type { WorkOrder, PlantArea, Sector, PlantEquipment, SubSector, WhiteLabelConfig, Machine } from '../types';
import { Layers, Box, Clock, X, Filter, Activity, Cpu, Truck, HardHat, Edit, MapPin, ChevronDown } from 'lucide-react';

interface OperationalMapProps {
  workOrders: WorkOrder[];
  plantAreas: PlantArea[];
  sectors: Sector[];
  equipments: PlantEquipment[];
  subSectors: SubSector[];
  whiteLabel: WhiteLabelConfig;
  machines?: Machine[];
  onEditWorkOrder?: (order: WorkOrder) => void;
}

type MetricType = 'VOLUME_M3' | 'RESOURCE_HOURS' | 'OT_COUNT';
type ResourceFilterType = 'MANUAL' | 'EQUIPMENT';
type TimeFilterType = 'ACTIVE_WEEK' | 'MONTH' | 'ALL';
type StatusFilterType = 'ALL' | 'PENDING' | 'APPROVED' | 'CONTINGENCY';

interface BeltNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'belt' | 'crusher' | 'screen' | 'pile' | 'dome' | 'box' | 'truck';
  label: string;
  vertical?: boolean;
}

interface DiagramConfig {
  id: string;
  title: string;
  w: number;
  h: number;
  nodes: BeltNode[];
  edges: [string, string][];
}

interface MapMetrics {
  totalM3: number;
  totalHH: number;
  totalHM: number;
  totalOTs: number;
  manualM3: number;
  machineryM3: number;
  matchingOrders: WorkOrder[];
}

const normalizeLabel = (value?: string) => (value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const getResourceFlags = (order: WorkOrder) => {
  const hasExplicitFlags = typeof order.hasManualLabor === 'boolean' || typeof order.hasEquipment === 'boolean';
  if (hasExplicitFlags) {
    return {
      manual: order.hasManualLabor === true,
      equipment: order.hasEquipment === true
    };
  }

  // Compatibilidad conservadora para documentos históricos sin indicadores.
  return {
    manual: (order.headcount || 0) > 0 && (order.realHours || 0) > 0,
    equipment: Boolean(order.vehiclePatent?.trim()) || (order.fleetTripsCount || 0) > 0 || (order.machineHours || 0) > 0
  };
};

const getLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getIsoWeek = (date: Date) => {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  return Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const OperationalMap: React.FC<OperationalMapProps> = ({
  workOrders = [],
  plantAreas = [],
  sectors = [],
  equipments = [],
  subSectors = [],
  whiteLabel,
  machines = [],
  onEditWorkOrder
}) => {
  const [activeDiagramId, setActiveDiagramId] = useState<string>('primario');
  const [activeMetric, setActiveMetric] = useState<MetricType>('RESOURCE_HOURS');
  const [resourceFilter, setResourceFilter] = useState<ResourceFilterType>('MANUAL');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [selectedBeltLabel, setSelectedBeltLabel] = useState<string | null>(null);
  const [expandedWetSectorId, setExpandedWetSectorId] = useState<string | null>(null);

  const now = new Date();
  const activeWeek = getIsoWeek(now);
  const currentMonth = getLocalDateKey(now).slice(0, 7);

  // Zaldívar Operational Diagrams Definition
  const DIAGRAMS: DiagramConfig[] = [
    {
      id: 'primario',
      title: '1. Chancado Primario & Secundario',
      w: 1200,
      h: 620,
      nodes: [
        { id: 'truck', x: 30, y: 30, w: 110, h: 55, type: 'truck', label: 'Camión' },
        { id: 'ct1', x: 30, y: 110, w: 150, h: 34, type: 'belt', label: 'CT-1' },
        { id: 'crusher1', x: 220, y: 80, w: 110, h: 100, type: 'crusher', label: 'Chancador\nPrimario' },
        { id: 'ct3', x: 220, y: 220, w: 200, h: 34, type: 'belt', label: 'CT-3' },
        { id: 'ct4', x: 460, y: 180, w: 180, h: 34, type: 'belt', label: 'CT-4' },
        { id: 'h013', x: 680, y: 120, w: 100, h: 60, type: 'screen', label: 'Harnero H013' },
        { id: 'h014', x: 790, y: 120, w: 100, h: 60, type: 'screen', label: 'Harnero H014' },
        { id: 'ct105', x: 910, y: 110, w: 170, h: 34, type: 'belt', label: 'CT-105' },
        { id: 'ct106', x: 680, y: 250, w: 300, h: 34, type: 'belt', label: 'CT-106' },
        { id: 'ct5', x: 910, y: 180, w: 170, h: 34, type: 'belt', label: 'CT-5' },
        { id: 'secc', x: 910, y: 250, w: 170, h: 34, type: 'box', label: 'Chancadores\nSecundarios' },
        { id: 'ct5a', x: 830, y: 330, w: 130, h: 34, type: 'belt', label: 'CT-5A' },
        { id: 'ct5b', x: 990, y: 330, w: 130, h: 34, type: 'belt', label: 'CT-5B' },
        { id: 'ct6', x: 850, y: 520, w: 330, h: 34, type: 'belt', label: 'CT-6' },
        { id: 'domo', x: 20, y: 520, w: 110, h: 70, type: 'dome', label: 'DOMO' },
        { id: 'ct8', x: 150, y: 480, w: 170, h: 34, type: 'belt', label: 'CT-8' },
        { id: 'ct7', x: 340, y: 520, w: 220, h: 34, type: 'belt', label: 'CT-7' }
      ],
      edges: [
        ['truck', 'ct1'], ['ct1', 'crusher1'], ['crusher1', 'ct3'], ['ct3', 'ct4'], ['ct4', 'h013'], ['ct4', 'h014'],
        ['h013', 'ct106'], ['h014', 'ct106'], ['h013', 'ct105'], ['h014', 'ct105'], ['ct105', 'ct5'], ['ct5', 'secc'],
        ['secc', 'ct5a'], ['secc', 'ct5b'], ['ct5a', 'ct6'], ['ct5b', 'ct6'], ['ct106', 'ct6'], ['domo', 'ct8'], ['ct8', 'ct7'], ['ct7', 'ct106']
      ]
    },
    {
      id: 'terciario',
      title: '2. Chancador Terciario',
      w: 1220,
      h: 520,
      nodes: [
        { id: 'domoSP', x: 520, y: 20, w: 170, h: 50, type: 'dome', label: 'Domo Stock Pile' },
        { id: 'ct14a', x: 380, y: 100, w: 120, h: 34, type: 'belt', label: 'CT-14A' },
        { id: 'ct15a', x: 700, y: 100, w: 120, h: 34, type: 'belt', label: 'CT-15A' },
        { id: 'ct14b', x: 70, y: 160, w: 230, h: 34, type: 'belt', label: 'CT-14B' },
        { id: 'ct15b', x: 900, y: 160, w: 230, h: 34, type: 'belt', label: 'CT-15B' },
        { id: 'ct42', x: 460, y: 230, w: 220, h: 34, type: 'belt', label: 'CT-42' },
        { id: 'chuteL', x: 110, y: 230, w: 130, h: 50, type: 'box', label: 'Chute Pantalón Izq' },
        { id: 'chuteR', x: 960, y: 230, w: 130, h: 50, type: 'box', label: 'Chute Pantalón Der' },
        { id: 'ct16', x: 60, y: 310, w: 90, h: 34, type: 'belt', label: 'CT-16' },
        { id: 'ct17', x: 170, y: 310, w: 90, h: 34, type: 'belt', label: 'CT-17' },
        { id: 'ct18', x: 940, y: 310, w: 90, h: 34, type: 'belt', label: 'CT-18' },
        { id: 'ct19', x: 1050, y: 310, w: 90, h: 34, type: 'belt', label: 'CT-19' },
        { id: 'ct40', x: 400, y: 310, w: 130, h: 34, type: 'belt', label: 'CT-40' },
        { id: 'ct43', x: 600, y: 290, w: 130, h: 34, type: 'belt', label: 'CT-43' },
        { id: 'ct41', x: 560, y: 360, w: 150, h: 34, type: 'belt', label: 'CT-41' },
        { id: 'ct20', x: 30, y: 440, w: 160, h: 34, type: 'belt', label: 'CT-20' },
        { id: 'ct27', x: 250, y: 450, w: 220, h: 34, type: 'belt', label: 'CT-27' },
        { id: 'ct26', x: 550, y: 450, w: 260, h: 34, type: 'belt', label: 'CT-26' },
        { id: 'ct21', x: 930, y: 440, w: 160, h: 34, type: 'belt', label: 'CT-21' },
        { id: 'ct22', x: 20, y: 150, w: 30, h: 300, type: 'belt', label: 'CT-22', vertical: true },
        { id: 'ct23', x: 1170, y: 150, w: 30, h: 300, type: 'belt', label: 'CT-23', vertical: true }
      ],
      edges: [
        ['domoSP', 'ct14a'], ['domoSP', 'ct15a'], ['ct14a', 'ct14b'], ['ct14a', 'ct42'], ['ct15a', 'ct15b'], ['ct15a', 'ct42'],
        ['ct14b', 'chuteL'], ['ct14b', 'ct16'], ['ct14b', 'ct17'], ['ct15b', 'chuteR'], ['ct15b', 'ct18'], ['ct15b', 'ct19'],
        ['ct42', 'ct40'], ['ct42', 'ct43'], ['ct43', 'ct41'], ['ct16', 'ct20'], ['ct16', 'ct27'], ['ct17', 'ct20'], ['ct17', 'ct27'],
        ['ct40', 'ct26'], ['ct41', 'ct26'], ['ct18', 'ct26'], ['ct18', 'ct21'], ['ct19', 'ct26'], ['ct19', 'ct21'],
        ['ct20', 'ct22'], ['ct21', 'ct23']
      ]
    },
    {
      id: 'apilado',
      title: '3. Apilado de Mineral',
      w: 1340,
      h: 440,
      nodes: [
        { id: 'stockL', x: 20, y: 250, w: 100, h: 60, type: 'pile', label: 'Stock Emergencia' },
        { id: 'ct35', x: 140, y: 210, w: 220, h: 34, type: 'belt', label: 'CT-35' },
        { id: 'tripper', x: 570, y: 250, w: 150, h: 50, type: 'box', label: 'Tripper Sennet' },
        { id: 'ct34', x: 740, y: 250, w: 280, h: 34, type: 'belt', label: 'CT-34' },
        { id: 'traspaso', x: 1040, y: 250, w: 150, h: 50, type: 'box', label: 'Traspaso CT-32/34' },
        { id: 'salmuera', x: 1040, y: 170, w: 150, h: 50, type: 'box', label: 'Salmuera' },
        { id: 'ct32', x: 1270, y: 10, w: 30, h: 170, type: 'belt', label: 'CT-32', vertical: true },
        { id: 'stockR', x: 840, y: 70, w: 100, h: 60, type: 'pile', label: 'Stock Emergencia' },
        { id: 'ct31', x: 970, y: 20, w: 140, h: 30, type: 'belt', label: 'CT-31' },
        { id: 'ct31a', x: 1140, y: 20, w: 110, h: 30, type: 'belt', label: 'CT-31A' },
        { id: 'ct30', x: 970, y: 80, w: 140, h: 30, type: 'belt', label: 'CT-30' },
        { id: 'ct31b', x: 970, y: 140, w: 140, h: 30, type: 'belt', label: 'CT-31B' },
        { id: 'ct201', x: 610, y: 330, w: 30, h: 80, type: 'belt', label: 'CT-201', vertical: true },
        { id: 'ct202', x: 660, y: 340, w: 150, h: 34, type: 'belt', label: 'CT-202' }
      ],
      edges: [
        ['stockL', 'ct35'], ['ct35', 'tripper'], ['tripper', 'ct34'], ['ct34', 'traspaso'], ['traspaso', 'salmuera'],
        ['salmuera', 'ct32'], ['ct32', 'ct31'], ['ct32', 'ct30'], ['ct32', 'ct31b'], ['ct31', 'ct31a'], ['stockR', 'ct31'],
        ['tripper', 'ct201'], ['ct201', 'ct202']
      ]
    },
    {
      id: 'remanejo',
      title: '4. Remanejo (MOH / MRCH / Rotopala)',
      w: 1290,
      h: 400,
      nodes: [
        { id: 'tripper138', x: 30, y: 60, w: 150, h: 34, type: 'box', label: 'Tripper CT-138' },
        { id: 'ct138', x: 70, y: 104, w: 30, h: 216, type: 'belt', label: 'CT-138', vertical: true },
        { id: 'ct144', x: 130, y: 330, w: 150, h: 34, type: 'belt', label: 'CT-144' },
        { id: 'ct140', x: 310, y: 295, w: 170, h: 34, type: 'belt', label: 'CT-140' },
        { id: 'ct143', x: 510, y: 255, w: 150, h: 34, type: 'belt', label: 'CT-143' },
        { id: 'ct139', x: 690, y: 210, w: 150, h: 34, type: 'belt', label: 'CT-139' },
        { id: 'moh', x: 880, y: 144, w: 110, h: 56, type: 'box', label: 'MOH' },
        { id: 'ct137', x: 1010, y: 154, w: 150, h: 34, type: 'belt', label: 'CT-137' },
        { id: 'ct136', x: 930, y: 64, w: 30, h: 70, type: 'belt', label: 'CT-136', vertical: true },
        { id: 'mrch', x: 890, y: 10, w: 100, h: 44, type: 'box', label: 'MRCH' },
        { id: 'ct135', x: 1010, y: 15, w: 80, h: 30, type: 'belt', label: 'CT-135' },
        { id: 'rotopala', x: 1130, y: 10, w: 100, h: 44, type: 'box', label: 'Disco Rotopala' }
      ],
      edges: [
        ['rotopala', 'ct135'], ['ct135', 'mrch'], ['mrch', 'ct136'], ['ct136', 'moh'], ['moh', 'ct137'], ['ct137', 'ct139'],
        ['ct139', 'ct143'], ['ct143', 'ct140'], ['ct140', 'ct144'], ['ct144', 'ct138'], ['ct138', 'tripper138']
      ]
    }
  ];

  const currentDiagram = DIAGRAMS.find(d => d.id === activeDiagramId) || DIAGRAMS[0];

  // Smart matching function to distinguish belts (CT-32) from transfer chutes (Traspaso CT-32/34)
  const isBeltMatch = (nodeLabel: string, otEquipmentStr: string): boolean => {
    const cleanNode = nodeLabel.replace(/\n/g, ' ').trim().toUpperCase();
    const cleanOt = otEquipmentStr.replace(/\n/g, ' ').trim().toUpperCase();

    const nodeHasTraspaso = cleanNode.includes('TRASPASO') || cleanNode.includes('/');
    const otHasTraspaso = cleanOt.includes('TRASPASO') || cleanOt.includes('/');

    // Case 1: Node is a specific transfer chute (e.g., "Traspaso CT-32/34")
    if (nodeHasTraspaso) {
      // Must NOT match if OT is just a standard belt without Traspaso
      if (!otHasTraspaso) return false;

      // If both mention Traspaso, match numbers
      const nodeNumbers: string[] = cleanNode.match(/\d+/g) || [];
      const otNumbers: string[] = cleanOt.match(/\d+/g) || [];
      return nodeNumbers.length > 0 && nodeNumbers.every(n => otNumbers.includes(n));
    }

    // Una OT de traspaso no debe iluminar además cada correa mencionada en su nombre.
    if (otHasTraspaso) return false;

    // Case 2: preserve alpha suffixes so CT-5, CT-5A and CT-5B stay distinct.
    const nodeMatch = cleanNode.match(/\bCT-?0*(\d+[A-Z]?)\b/i);
    const otMatch = cleanOt.match(/\bCT-?0*(\d+[A-Z]?)\b/i);

    if (nodeMatch && otMatch) {
      return nodeMatch[1] === otMatch[1];
    }

    // Fallback: Exact normalized string check
    const normNode = cleanNode.replace(/\s+/g, '').replace(/CORREA/g, '');
    const normOt = cleanOt.replace(/\s+/g, '').replace(/CORREA/g, '');
    return normNode === normOt;
  };

  const orderMatchesPeriod = (order: WorkOrder) => {
    if (timeFilter === 'ALL') return true;
    const executionDate = order.executionDate ? new Date(`${order.executionDate}T12:00:00`) : null;
    if (timeFilter === 'MONTH') {
      return Boolean(order.executionDate?.startsWith(currentMonth));
    }
    if (executionDate && !Number.isNaN(executionDate.getTime())) {
      return executionDate.getFullYear() === now.getFullYear() && getIsoWeek(executionDate) === activeWeek;
    }
    return order.semana === activeWeek;
  };

  const orderMatchesStatus = (order: WorkOrder) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PENDING') return order.status === 'PENDIENTE_APROBACION_ITO';
    if (statusFilter === 'APPROVED') return order.status === 'APROBADO_MANDANTE' || order.status === 'COMPLETADO';
    return order.status === 'CONTINGENCIA' || order.status === 'RECHAZADO_CONTINGENCIA';
  };

  // Resource flags are the source of truth. Volume and personnel values are metrics, not classifiers.
  const filteredOrders = workOrders.filter(order => {
    if (!orderMatchesPeriod(order) || !orderMatchesStatus(order)) return false;
    const flags = getResourceFlags(order);
    return resourceFilter === 'MANUAL' ? flags.manual : flags.equipment;
  });

  const getOrderBreakdown = (order: WorkOrder) => {
    const flags = getResourceFlags(order);
    const totalHH = flags.manual ? (order.headcount || 0) * (order.realHours || 0) : 0;
    const totalHM = flags.equipment ? (order.machineHours || 0) : 0;
    const wheelbarrowsPerDay = whiteLabel?.manualLaborConfig?.wheelbarrowsPerDay ?? 60;
    const effectiveHours = whiteLabel?.manualLaborConfig?.effectiveHoursPerDay ?? 6;
    const wheelbarrowCapacity = whiteLabel?.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08;
    const manualRate = (effectiveHours > 0 ? wheelbarrowsPerDay / effectiveHours : 10) * wheelbarrowCapacity;
    const machine = machines.find(item => item.patent === order.vehiclePatent);
    const machineCapacity = machine?.capacityM3 ?? order.bucketCapacityM3 ?? 0;

    let manualM3 = flags.manual ? totalHH * manualRate : 0;
    let machineryM3 = flags.equipment ? (order.fleetTripsCount || 0) * machineCapacity : 0;

    // A single-resource OT stores an authoritative total. Mixed OTs keep their calculated split.
    if (flags.manual && !flags.equipment) manualM3 = order.cubicMetersRemoved ?? manualM3;
    if (flags.equipment && !flags.manual) machineryM3 = order.cubicMetersRemoved ?? machineryM3;

    return { totalHH, totalHM, manualM3, machineryM3 };
  };

  const getMetricsForOrders = (orders: WorkOrder[]): MapMetrics => {
    let totalHH = 0;
    let totalHM = 0;
    let manualM3 = 0;
    let machineryM3 = 0;
    orders.forEach(order => {
      const metrics = getOrderBreakdown(order);
      totalHH += metrics.totalHH;
      totalHM += metrics.totalHM;
      manualM3 += metrics.manualM3;
      machineryM3 += metrics.machineryM3;
    });
    return {
      totalM3: resourceFilter === 'MANUAL' ? manualM3 : machineryM3,
      totalHH,
      totalHM,
      totalOTs: orders.length,
      manualM3,
      machineryM3,
      matchingOrders: orders
    };
  };

  const getEquipmentToken = (value: string) => normalizeLabel(value).replace(/[^A-Z0-9]/g, '').match(/CT0*(\d+[A-Z]?)/)?.[1] || '';

  // Prefer stable catalog IDs; retain text matching only for historical records.
  const getBeltMetrics = (label: string) => {
    const nodeToken = getEquipmentToken(label);
    const catalogIds = equipments
      .filter(item => nodeToken && (getEquipmentToken(item.code) === nodeToken || getEquipmentToken(item.name) === nodeToken))
      .map(item => item.id);
    const matchingOrders = filteredOrders.filter(order => {
      if (order.equipmentId && catalogIds.includes(order.equipmentId)) return true;
      const equipmentText = `${order.equipmentName || ''} ${order.equipoCorrea || ''}`;
      return isBeltMatch(label, equipmentText);
    });
    return getMetricsForOrders(matchingOrders);
  };

  const wetArea = plantAreas.find(area => area.code === 'REAH' || normalizeLabel(area.name).includes('AREA HUMEDA'));
  const wetSectors = sectors.filter(sector => wetArea && (sector.areaId === wetArea.id || normalizeLabel(sector.areaName) === normalizeLabel(wetArea.name)));
  const wetSectorIds = new Set(wetSectors.map(sector => sector.id));
  const wetOrders = filteredOrders.filter(order =>
    Boolean(wetArea) && (order.areaId === wetArea?.id || wetSectorIds.has(order.sectorId || '') || normalizeLabel(order.areaName) === normalizeLabel(wetArea?.name))
  );

  const getWetSectorMetrics = (sector: Sector) => getMetricsForOrders(wetOrders.filter(order =>
    order.sectorId === sector.id || normalizeLabel(order.sectorName) === normalizeLabel(sector.name)
  ));

  const getWetLocationMetrics = (location: SubSector) => getMetricsForOrders(wetOrders.filter(order => {
    if (order.selectedSubSectorIds?.includes(location.id)) return true;
    if (order.subSectorId === location.id) return true;
    return (order.selectedSubSectorNames || []).some(name => normalizeLabel(name) === normalizeLabel(location.name))
      || normalizeLabel(order.subSectorName) === normalizeLabel(location.name);
  }));

  const getMetricValue = (metrics: MapMetrics) => {
    if (activeMetric === 'VOLUME_M3') return metrics.totalM3;
    if (activeMetric === 'RESOURCE_HOURS') return resourceFilter === 'MANUAL' ? metrics.totalHH : metrics.totalHM;
    return metrics.totalOTs;
  };

  const getMetricThresholds = () => {
    if (activeMetric === 'VOLUME_M3') return { medium: 15, critical: 50, unit: 'm³', label: 'Volumen removido' };
    if (activeMetric === 'RESOURCE_HOURS' && resourceFilter === 'MANUAL') return { medium: 15, critical: 40, unit: 'HH', label: 'Horas hombre' };
    if (activeMetric === 'RESOURCE_HOURS') return { medium: 8, critical: 16, unit: 'HM', label: 'Horas máquina' };
    return { medium: 1, critical: 3, unit: 'OT', label: 'Frecuencia de OT' };
  };

  const getHeatmapColorForMetrics = (metrics: MapMetrics) => {
    if (metrics.totalOTs === 0) {
      return { fill: '#F8FAFC', stroke: '#CBD5E1', text: '#64748B', badge: '⚪ SIN REGISTROS', pattern: false };
    }
    const value = getMetricValue(metrics);
    const thresholds = getMetricThresholds();
    if (value >= thresholds.critical) {
      return { fill: '#FEF2F2', stroke: '#EF4444', text: '#991B1B', badge: '🔴 CRÍTICO', pattern: true };
    }
    if (value >= thresholds.medium) {
      return { fill: '#FFF7ED', stroke: '#F97316', text: '#C2410C', badge: '🟡 MEDIO', pattern: false };
    }
    return { fill: '#ECFDF5', stroke: '#10B981', text: '#047857', badge: '🟢 NORMAL', pattern: false };
  };

  const getHeatmapColor = (label: string) => getHeatmapColorForMetrics(
    activeDiagramId === 'humeda'
      ? getWetLocationMetrics(subSectors.find(location => location.name === label) || { id: '', name: label, code: '' })
      : getBeltMetrics(label)
  );

  const formatMetricValue = (metrics: MapMetrics) => {
    const value = getMetricValue(metrics);
    if (activeMetric === 'OT_COUNT') return `${value} ${value === 1 ? 'OT' : 'OTs'}`;
    return `${value.toFixed(1)} ${getMetricThresholds().unit}`;
  };

  // Helper Node Anchor Routing
  const getAnchor = (n: BeltNode, side: string): [number, number] => {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    if (side === 'top') return [cx, n.y];
    if (side === 'bottom') return [cx, n.y + n.h];
    if (side === 'left') return [n.x, cy];
    if (side === 'right') return [n.x + n.w, cy];
    return [cx, cy];
  };

  const routeEdge = (nodeMap: Record<string, BeltNode>, aId: string, bId: string) => {
    const a = nodeMap[aId], b = nodeMap[bId];
    if (!a || !b) return '';
    const dx = (b.x + b.w / 2) - (a.x + a.w / 2);
    const dy = (b.y + b.h / 2) - (a.y + a.h / 2);
    let p1: [number, number], p2: [number, number];

    if (Math.abs(dx) > Math.abs(dy) * 1.15) {
      if (dx >= 0) { p1 = getAnchor(a, 'right'); p2 = getAnchor(b, 'left'); }
      else { p1 = getAnchor(a, 'left'); p2 = getAnchor(b, 'right'); }
      const midX = (p1[0] + p2[0]) / 2;
      return `M ${p1[0]} ${p1[1]} L ${midX} ${p1[1]} L ${midX} ${p2[1]} L ${p2[0]} ${p2[1]}`;
    } else {
      if (dy >= 0) { p1 = getAnchor(a, 'bottom'); p2 = getAnchor(b, 'top'); }
      else { p1 = getAnchor(a, 'top'); p2 = getAnchor(b, 'bottom'); }
      const midY = (p1[1] + p2[1]) / 2;
      return `M ${p1[0]} ${p1[1]} L ${p1[0]} ${midY} L ${p2[0]} ${midY} L ${p2[0]} ${p2[1]}`;
    }
  };

  // Node Map Reference for Edge Routing
  const nodeMap: Record<string, BeltNode> = {};
  currentDiagram.nodes.forEach(n => nodeMap[n.id] = n);

  const selectedWetLocation = selectedBeltLabel
    ? subSectors.find(location => normalizeLabel(location.name) === normalizeLabel(selectedBeltLabel))
    : undefined;
  const selectedMetrics = selectedBeltLabel
    ? (activeDiagramId === 'humeda' && selectedWetLocation
      ? getWetLocationMetrics(selectedWetLocation)
      : getBeltMetrics(selectedBeltLabel))
    : null;
  const wetAreaMetrics = getMetricsForOrders(wetOrders);
  const wetLocationRanking = subSectors
    .filter(location => wetSectorIds.has(location.sectorId || ''))
    .map(location => ({ location, metrics: getWetLocationMetrics(location) }))
    .filter(item => item.metrics.totalOTs > 0)
    .sort((a, b) => getMetricValue(b.metrics) - getMetricValue(a.metrics))
    .slice(0, 8);
  const rankingMax = Math.max(1, ...wetLocationRanking.map(item => getMetricValue(item.metrics)));
  const metricThresholds = getMetricThresholds();
  const wetCriticalCount = wetLocationRanking.filter(item => getMetricValue(item.metrics) >= metricThresholds.critical).length;

  return (
    <div className="card" style={{ padding: '24px' }}>
      
      {/* HEADER WITH TITLE & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers style={{ color: 'var(--orange)' }} /> Mapa Operacional y Heatmap de Planta (Zaldívar)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginTop: '2px' }}>
            Visualización en tiempo real de ubicaciones, volumen removido, HH/HM y criticidad operacional
          </p>
        </div>

        {/* METRIC CONTROLLER BUTTONS */}
        <div className="operational-map-metrics" style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--slate-100)', padding: '4px', borderRadius: '14px', border: '1px solid var(--slate-200)' }}>
          <button
            onClick={() => setActiveMetric('VOLUME_M3')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'VOLUME_M3' ? 'var(--orange)' : 'transparent',
              color: activeMetric === 'VOLUME_M3' ? '#FFF' : 'var(--slate-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Box size={14} /> 📦 Volumen (m³)
          </button>

          <button
            onClick={() => setActiveMetric('RESOURCE_HOURS')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'RESOURCE_HOURS' ? 'var(--orange)' : 'transparent',
              color: activeMetric === 'RESOURCE_HOURS' ? '#FFF' : 'var(--slate-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} /> {resourceFilter === 'MANUAL' ? '👷 Horas Hombre (HH)' : '🚜 Horas Máquina (HM)'}
          </button>

          <button
            onClick={() => setActiveMetric('OT_COUNT')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'OT_COUNT' ? 'var(--orange)' : 'transparent',
              color: activeMetric === 'OT_COUNT' ? '#FFF' : 'var(--slate-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Activity size={14} /> 🚨 Frecuencia OTs
          </button>
        </div>
      </div>

      {/* FILTER BAR: PROCESS DIAGRAM TABS & DUAL RESOURCE SELECTOR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px', borderBottom: '2px solid var(--slate-100)', paddingBottom: '12px' }}>
        
        {/* PROCESS DIAGRAM TABS */}
        <div className="scrollable-tabs operational-area-tabs" style={{ margin: 0, border: 'none', padding: '2px' }}>
          {DIAGRAMS.map(d => (
            <button
              key={d.id}
              onClick={() => { setActiveDiagramId(d.id); setSelectedBeltLabel(null); }}
              className={`nav-item operational-area-tab ${activeDiagramId === d.id ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 900,
                backgroundColor: activeDiagramId === d.id ? '#FFF7ED' : 'transparent',
                color: activeDiagramId === d.id ? 'var(--orange)' : 'var(--slate-600)',
                border: activeDiagramId === d.id ? '1px solid #FDBA74' : '1px solid transparent'
              }}
            >
              {d.title}
            </button>
          ))}
          <button
            onClick={() => { setActiveDiagramId('humeda'); setSelectedBeltLabel(null); }}
            className={`nav-item operational-area-tab ${activeDiagramId === 'humeda' ? 'active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 900,
              backgroundColor: activeDiagramId === 'humeda' ? '#ECFEFF' : 'transparent',
              color: activeDiagramId === 'humeda' ? '#0E7490' : 'var(--slate-600)',
              border: activeDiagramId === 'humeda' ? '1px solid #67E8F9' : '1px solid transparent'
            }}
          >
            5. Área Húmeda (LIX-SX-EW-RO)
          </button>
        </div>

        <div className="operational-map-filters" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="operational-resource-toggle" style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', border: '1px solid var(--slate-200)', backgroundColor: '#FFFFFF' }}>
            <button
              onClick={() => { setResourceFilter('MANUAL'); setActiveMetric('RESOURCE_HOURS'); }}
              className="btn"
              style={{ padding: '7px 10px', fontSize: '11px', backgroundColor: resourceFilter === 'MANUAL' ? '#0284C7' : 'transparent', color: resourceFilter === 'MANUAL' ? '#FFF' : 'var(--slate-600)' }}
            >
              <HardHat size={14} /> Manual
            </button>
            <button
              onClick={() => { setResourceFilter('EQUIPMENT'); setActiveMetric('VOLUME_M3'); }}
              className="btn"
              style={{ padding: '7px 10px', fontSize: '11px', backgroundColor: resourceFilter === 'EQUIPMENT' ? 'var(--orange)' : 'transparent', color: resourceFilter === 'EQUIPMENT' ? '#FFF' : 'var(--slate-600)' }}
            >
              <Truck size={14} /> Maquinaria
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800 }}>
            <Filter size={14} style={{ color: 'var(--slate-400)' }} />
            <span>Periodo:</span>
            <select
              value={timeFilter}
              onChange={e => setTimeFilter(e.target.value as TimeFilterType)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--slate-200)', fontSize: '11px', fontWeight: 800 }}
            >
              <option value="ALL">Histórico Consolidado</option>
              <option value="ACTIVE_WEEK">Semana Activa (W{activeWeek})</option>
              <option value="MONTH">Mes actual</option>
            </select>
          </div>
          <select
            aria-label="Filtrar por estado de orden"
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as StatusFilterType)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--slate-200)', fontSize: '11px', fontWeight: 800 }}
          >
            <option value="ALL">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobadas / completadas</option>
            <option value="CONTINGENCY">Contingencias</option>
          </select>
        </div>
      </div>

      {/* HEATMAP LEGEND BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '10px 16px', backgroundColor: 'var(--slate-50)', borderRadius: '12px', border: '1px solid var(--slate-200)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '0.05em' }}>
          Nivel de calor ({metricThresholds.label}):
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#991B1B' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#FEF2F2', border: '2px solid #EF4444', display: 'inline-block' }} />
          🔴 Crítico (≥ {metricThresholds.critical} {metricThresholds.unit})
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#C2410C' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#FFF7ED', border: '2px solid #F97316', display: 'inline-block' }} />
          🟡 Medio ({metricThresholds.medium}–{metricThresholds.critical - 1} {metricThresholds.unit})
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#047857' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#ECFDF5', border: '2px solid #10B981', display: 'inline-block' }} />
          🟢 Normal (&lt; {metricThresholds.medium} {metricThresholds.unit})
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#64748B' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#F8FAFC', border: '2px solid #CBD5E1', display: 'inline-block' }} />
          ⚪ Sin registros
        </div>
      </div>

      {/* MAIN LAYOUT CONTAINER: SVG DIAGRAM CANVAS WITH FLOATING TOP-RIGHT TOGGLE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', alignItems: 'start' }}>
        {activeDiagramId === 'humeda' ? (
          <div className="wet-area-dashboard">
            <div className="wet-area-kpis">
              <div className="wet-kpi-card"><span>OT visibles</span><strong>{wetAreaMetrics.totalOTs}</strong></div>
              <div className="wet-kpi-card"><span>{resourceFilter === 'MANUAL' ? 'Horas hombre' : 'Horas máquina'}</span><strong>{resourceFilter === 'MANUAL' ? wetAreaMetrics.totalHH.toFixed(1) : wetAreaMetrics.totalHM.toFixed(1)}</strong></div>
              <div className="wet-kpi-card"><span>Volumen {resourceFilter === 'MANUAL' ? 'manual' : 'maquinaria'}</span><strong>{wetAreaMetrics.totalM3.toFixed(1)} m³</strong></div>
              <div className="wet-kpi-card wet-kpi-critical"><span>Ubicaciones críticas</span><strong>{wetCriticalCount}</strong></div>
            </div>

            {!wetArea || wetSectors.length === 0 ? (
              <div className="wet-empty-state">
                <MapPin size={28} />
                <strong>No se encontró la parametrización del Área Húmeda.</strong>
                <span>Configura el área y sus sectores para habilitar esta visualización.</span>
              </div>
            ) : (
              <div className="wet-area-layout">
                <div className="wet-sector-grid">
                  {wetSectors.map(sector => {
                    const metrics = getWetSectorMetrics(sector);
                    const color = getHeatmapColorForMetrics(metrics);
                    const isExpanded = expandedWetSectorId === sector.id;
                    const locations = subSectors.filter(location =>
                      location.sectorId === sector.id || normalizeLabel(location.sectorName) === normalizeLabel(sector.name)
                    );
                    return (
                      <section key={sector.id} className="wet-sector-card" style={{ borderColor: color.stroke }}>
                        <button
                          type="button"
                          className="wet-sector-header"
                          onClick={() => setExpandedWetSectorId(isExpanded ? null : sector.id)}
                          aria-expanded={isExpanded}
                        >
                          <span className="wet-sector-icon" style={{ backgroundColor: color.fill, color: color.text }}><MapPin size={18} /></span>
                          <span className="wet-sector-title"><strong>{sector.name}</strong><small>{color.badge}</small></span>
                          <span className="wet-sector-value" style={{ color: color.text }}>{formatMetricValue(metrics)}</span>
                          <ChevronDown size={18} className={isExpanded ? 'is-expanded' : ''} />
                        </button>
                        <div className="wet-sector-summary">
                          <span>{metrics.totalOTs} OT</span>
                          <span>{metrics.totalHH.toFixed(1)} HH</span>
                          <span>{metrics.totalHM.toFixed(1)} HM</span>
                          <span>{metrics.totalM3.toFixed(1)} m³</span>
                        </div>
                        {isExpanded && (
                          <div className="wet-location-list">
                            {locations.length === 0 ? (
                              <div className="wet-location-empty">Sin ubicaciones parametrizadas.</div>
                            ) : locations.map(location => {
                              const locationMetrics = getWetLocationMetrics(location);
                              const locationColor = getHeatmapColorForMetrics(locationMetrics);
                              return (
                                <button
                                  type="button"
                                  key={location.id}
                                  className="wet-location-row"
                                  onClick={() => setSelectedBeltLabel(location.name)}
                                >
                                  <span className="wet-status-dot" style={{ backgroundColor: locationColor.stroke }} />
                                  <span className="wet-location-name">{location.name}</span>
                                  <strong style={{ color: locationColor.text }}>{formatMetricValue(locationMetrics)}</strong>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>

                <aside className="wet-ranking-card">
                  <div className="wet-ranking-heading">
                    <div><span>Priorización operacional</span><h3>Ubicaciones con mayor carga</h3></div>
                    <Activity size={20} />
                  </div>
                  {wetLocationRanking.length === 0 ? (
                    <div className="wet-location-empty">No existen ubicaciones con OT para los filtros seleccionados.</div>
                  ) : wetLocationRanking.map(({ location, metrics }, index) => {
                    const color = getHeatmapColorForMetrics(metrics);
                    const width = Math.max(8, (getMetricValue(metrics) / rankingMax) * 100);
                    return (
                      <button type="button" key={location.id} className="wet-ranking-row" onClick={() => setSelectedBeltLabel(location.name)}>
                        <span className="wet-ranking-label"><b>{index + 1}</b><span>{location.name}</span><strong>{formatMetricValue(metrics)}</strong></span>
                        <span className="wet-ranking-track"><span style={{ width: `${width}%`, backgroundColor: color.stroke }} /></span>
                      </button>
                    );
                  })}
                </aside>
              </div>
            )}
          </div>
        ) : (
        /* SVG DIAGRAM CANVAS WITH RELATIVE POSITIONING */
        <div className="operational-svg-canvas" style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid var(--slate-200)', padding: '20px', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' }}>

          <svg
            viewBox={`0 0 ${currentDiagram.w} ${currentDiagram.h}`}
            style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#FFFFFF' }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="var(--slate-400)" />
              </marker>

              {/* Critical Stripes Pattern */}
              <pattern id="criticalPattern" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="12" stroke="#EF4444" strokeWidth="3" opacity="0.3" />
              </pattern>
            </defs>

            {/* EDGES / PIPELINES */}
            {currentDiagram.edges.map(([aId, bId], idx) => (
              <path
                key={idx}
                d={routeEdge(nodeMap, aId, bId)}
                fill="none"
                stroke="var(--slate-400)"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            ))}

            {/* NODES / BELTS & EQUIPMENT */}
            {currentDiagram.nodes.map(n => {
              const metrics = getBeltMetrics(n.label);
              const colorInfo = getHeatmapColor(n.label);
              const isSelected = selectedBeltLabel === n.label;
              const cx = n.x + n.w / 2;
              const cy = n.y + n.h / 2;
              const lines = n.label.split('\n');
              const metricLabel = metrics.totalOTs > 0 ? formatMetricValue(metrics) : '';
              const textLines = metricLabel ? [...lines, metricLabel] : lines;

              return (
                <g
                  key={n.id}
                  onClick={() => setSelectedBeltLabel(n.label)}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  {/* BASE NODE RECTANGLE / POLYGON */}
                  {n.type === 'crusher' ? (
                    <polygon
                      points={`${n.x},${n.y} ${n.x + n.w},${n.y} ${n.x + n.w * 0.68},${n.y + n.h} ${n.x + n.w * 0.32},${n.y + n.h}`}
                      fill={colorInfo.fill}
                      stroke={colorInfo.stroke}
                      strokeWidth={isSelected ? 3.5 : 2}
                    />
                  ) : n.type === 'dome' ? (
                    <path
                      d={`M ${n.x} ${n.y + n.h} A ${n.w / 2} ${n.h * 0.9} 0 0 1 ${n.x + n.w} ${n.y + n.h} Z`}
                      fill={colorInfo.fill}
                      stroke={colorInfo.stroke}
                      strokeWidth={isSelected ? 3.5 : 2}
                    />
                  ) : n.type === 'pile' ? (
                    <polygon
                      points={`${n.x},${n.y + n.h} ${n.x + n.w / 2},${n.y} ${n.x + n.w},${n.y + n.h}`}
                      fill={colorInfo.fill}
                      stroke={colorInfo.stroke}
                      strokeWidth={isSelected ? 3.5 : 2}
                    />
                  ) : (
                    <rect
                      x={n.x}
                      y={n.y}
                      width={n.w}
                      height={n.h}
                      rx={8}
                      fill={colorInfo.fill}
                      stroke={colorInfo.stroke}
                      strokeWidth={isSelected ? 3.5 : 2}
                    />
                  )}

                  {/* CRITICAL STRIPED OVERLAY */}
                  {colorInfo.pattern && (
                    <rect
                      x={n.x}
                      y={n.y}
                      width={n.w}
                      height={n.h}
                      rx={8}
                      fill="url(#criticalPattern)"
                      pointerEvents="none"
                    />
                  )}

                  {/* Labels and values stay inside each node to avoid collisions with adjacent equipment. */}
                  <text
                    x={cx}
                    y={cy - (textLines.length - 1) * 6 + 3}
                    textAnchor="middle"
                    fill={colorInfo.text}
                    fontSize={n.vertical ? 10 : 11}
                    fontWeight={900}
                    transform={n.vertical ? `rotate(-90 ${cx} ${cy})` : undefined}
                    pointerEvents="none"
                  >
                    {textLines.map((line, index) => (
                      <tspan
                        key={`${line}-${index}`}
                        x={cx}
                        dy={index === 0 ? 0 : 12}
                        fontSize={metricLabel && index === textLines.length - 1 ? 9 : undefined}
                        fontWeight={metricLabel && index === textLines.length - 1 ? 800 : 900}
                        opacity={metricLabel && index === textLines.length - 1 ? 0.82 : 1}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        )}

      {/* POP-UP MODAL EMERGENTE DE INSPECCIÓN DE CORREA / SECTOR */}
      {selectedBeltLabel && selectedMetrics && (
        <div
          className="modal-backdrop-overlay"
          onClick={() => setSelectedBeltLabel(null)}
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(3px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000, 
            padding: '16px' 
          }}
        >
          <div
            className="modal-content-card"
            onClick={e => e.stopPropagation()}
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderRadius: '24px', 
              border: '2px solid var(--orange)', 
              padding: '24px', 
              boxShadow: 'var(--shadow-lg)', 
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '18px' 
            }}
          >
            {/* MODAL HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--slate-100)', paddingBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  🔍 Inspección Operativa & Componentes
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  {selectedBeltLabel.replace(/\n/g, ' ')}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedBeltLabel(null)} 
                className="btn btn-secondary" 
                style={{ padding: '6px 10px', borderRadius: '12px' }}
                title="Cerrar Ventana (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            {/* ACCUMULATED METRICS SUMMARY CARDS (3 DIDACTIC KPIS FOR TOTAL, MANUAL & MACHINERY) */}
            <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(130px, 100%), 1fr))', gap: '10px' }}>
              <div style={{ backgroundColor: '#FFF7ED', padding: '12px', borderRadius: '14px', border: '1px solid #FFEDD5' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#C2410C', textTransform: 'uppercase' }}>📦 Volumen del filtro</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--orange)' }}>{selectedMetrics.totalM3.toFixed(1)} m³</div>
                <div style={{ fontSize: '10px', color: 'var(--slate-500)', marginTop: '2px', fontWeight: 700 }}>{selectedMetrics.totalOTs} OTs Totales</div>
              </div>

              <div style={{ backgroundColor: '#ECFDF5', padding: '12px', borderRadius: '14px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#047857', textTransform: 'uppercase' }}>👷 Aporte Manual</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669' }}>{selectedMetrics.manualM3.toFixed(1)} m³</div>
                <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px', fontWeight: 800 }}>
                  {selectedMetrics.totalHH.toFixed(1)} HH
                </div>
              </div>

              <div style={{ backgroundColor: '#F0F9FF', padding: '12px', borderRadius: '14px', border: '1px solid #7DD3FC' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#0369A1', textTransform: 'uppercase' }}>🚜 Aporte Maquinaria</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284C7' }}>{selectedMetrics.machineryM3.toFixed(1)} m³</div>
                <div style={{ fontSize: '10px', color: '#0369A1', marginTop: '2px', fontWeight: 800 }}>
                  {selectedMetrics.totalHM.toFixed(1)} HM
                </div>
              </div>
            </div>

            {/* LEVEL 4 SUB-SECTOR / COMPONENT HEATMAP BREAKDOWN */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 900, color: 'var(--slate-900)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} style={{ color: 'var(--orange)' }} /> Desglose por Componentes Intervenidos (Nivel 4)
              </h4>

              {selectedMetrics.matchingOrders.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--slate-400)', fontStyle: 'italic', padding: '16px', backgroundColor: 'var(--slate-50)', borderRadius: '14px', textAlign: 'center' }}>
                  Sin Órdenes de Trabajo registradas en este periodo para esta ubicación.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                  {selectedMetrics.matchingOrders.map(o => {
                    const breakdown = getOrderBreakdown(o);
                    const flags = getResourceFlags(o);

                    return (
                      <div key={o.id} style={{ padding: '12px 14px', borderRadius: '14px', backgroundColor: 'var(--slate-50)', border: '1px solid var(--slate-200)', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, color: 'var(--slate-900)', marginBottom: '4px', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="sap-code-badge">{o.sapCode}</span>
                            <span style={{ fontSize: '11px', color: 'var(--slate-600)', fontWeight: 800 }}>
                              📅 {o.executionDate || o.dia || 'Hoy'} ({o.shiftName})
                            </span>
                            {onEditWorkOrder && (
                              <button
                                onClick={() => {
                                  setSelectedBeltLabel(null);
                                  onEditWorkOrder(o);
                                }}
                                className="btn btn-secondary"
                                style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--orange)', color: 'var(--orange)', backgroundColor: '#FFF7ED' }}
                                title="Editar esta Orden de Trabajo"
                              >
                                <Edit size={12} /> Editar
                              </button>
                            )}
                          </span>
                          <span style={{ color: 'var(--orange)', fontWeight: 900 }}>
                            📦 {o.cubicMetersRemoved || 0} m³ Total
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', margin: '4px 0', flexWrap: 'wrap' }}>
                          {flags.manual && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontWeight: 800 }}>
                              👷 Manual: {breakdown.manualM3.toFixed(1)} m³ · {breakdown.totalHH.toFixed(1)} HH
                            </span>
                          )}
                          {flags.equipment && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F0F9FF', color: '#0369A1', border: '1px solid #7DD3FC', fontWeight: 800 }}>
                              🚜 Maquinaria: {breakdown.machineryM3.toFixed(1)} m³ · {breakdown.totalHM.toFixed(1)} HM
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#0369A1', marginBottom: '2px' }}>
                          🧩 Componentes: {o.selectedSubSectorNames && o.selectedSubSectorNames.length > 0 ? o.selectedSubSectorNames.join(', ') : 'Gabinete / Correa Principal'}
                        </div>

                        <div style={{ color: 'var(--slate-600)', fontSize: '12px' }}>
                          {o.operationDetail}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--slate-100)', paddingTop: '14px' }}>
              <button 
                onClick={() => setSelectedBeltLabel(null)} 
                className="btn btn-primary"
                style={{ padding: '10px 20px', borderRadius: '12px' }}
              >
                Cerrar Inspección
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
