import React, { useState } from 'react';
import type { WorkOrder, PlantArea, Sector, PlantEquipment, SubSector, WhiteLabelConfig, Machine } from '../types';
import { Layers, Box, Users, Clock, AlertTriangle, ChevronRight, X, Filter, Activity, Cpu, Wrench, Truck, HardHat, Edit } from 'lucide-react';

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

type MetricType = 'VOLUME_M3' | 'MAN_HOURS' | 'OT_COUNT';
type ResourceFilterType = 'MANUAL' | 'EQUIPMENT';
type TimeFilterType = 'ACTIVE_WEEK' | 'MONTH' | 'ALL';

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

export const OperationalMap: React.FC<OperationalMapProps> = ({
  workOrders = [],
  whiteLabel,
  machines = [],
  onEditWorkOrder
}) => {
  const [activeDiagramId, setActiveDiagramId] = useState<string>('primario');
  const [activeMetric, setActiveMetric] = useState<MetricType>('VOLUME_M3');
  const [resourceFilter, setResourceFilter] = useState<ResourceFilterType>('EQUIPMENT');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('ALL');
  const [selectedBeltLabel, setSelectedBeltLabel] = useState<string | null>(null);

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

    // Case 2: Node is a standard belt (e.g. "CT-32", "CT-1", "CT-106")
    const nodeMatch = cleanNode.match(/\bCT-?0*(\d+)\b/i);
    const otMatch = cleanOt.match(/\bCT-?0*(\d+)\b/i);

    if (nodeMatch && otMatch) {
      return nodeMatch[1] === otMatch[1];
    }

    // Fallback: Exact normalized string check
    const normNode = cleanNode.replace(/\s+/g, '').replace(/CORREA/g, '');
    const normOt = cleanOt.replace(/\s+/g, '').replace(/CORREA/g, '');
    return normNode === normOt;
  };

  // Work Orders Filtered by Resource & Time (Non-exclusive)
  const filteredOrders = workOrders.filter(o => {
    if (timeFilter === 'ACTIVE_WEEK' && o.semana !== 33) return false;
    
    if (resourceFilter === 'EQUIPMENT') {
      // Include any order that removed m3 OR used machinery OR has vehicle
      return (o.cubicMetersRemoved && o.cubicMetersRemoved > 0) || o.hasEquipment || Boolean(o.vehiclePatent);
    } else if (resourceFilter === 'MANUAL') {
      // Include any order that used manual crew OR has real hours
      return o.hasManualLabor || (o.realHours && o.realHours > 0) || (o.headcount && o.headcount > 0);
    }
    return true;
  });

  // Calculate Heatmap Metrics per Belt Node Label
  const getBeltMetrics = (label: string) => {
    const matchingOrders = filteredOrders.filter(o => {
      const eqStr = `${o.equipmentName || ''} ${o.equipoCorrea || ''}`;
      return isBeltMatch(label, eqStr);
    });

    const totalM3 = matchingOrders.reduce((sum, o) => sum + (o.cubicMetersRemoved || 0), 0);
    const totalHH = matchingOrders.reduce((sum, o) => sum + (o.realHours || 0), 0);
    const totalOTs = matchingOrders.length;

    // Sub-breakdown of m3 by resource type
    let manualM3 = 0;
    let machineryM3 = 0;

    const wPerDay = whiteLabel?.manualLaborConfig?.wheelbarrowsPerDay ?? 60;
    const hEff = whiteLabel?.manualLaborConfig?.effectiveHoursPerDay ?? 6;
    const capM3 = whiteLabel?.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08;
    const m3PerHour = (hEff > 0 ? wPerDay / hEff : 10) * capM3;

    matchingOrders.forEach(o => {
      let oManual = 0;
      let oMachinery = 0;

      if (o.hasManualLabor !== false) {
        const hh = (o.headcount || 0) * (o.realHours || 0);
        oManual = hh * m3PerHour;
      }

      if (o.hasEquipment !== false) {
        const selectedMachine = (machines || []).find(m => m.patent === o.vehiclePatent);
        const cap = selectedMachine?.capacityM3 ?? o.bucketCapacityM3 ?? 0;
        oMachinery = (o.fleetTripsCount || 0) * cap;
      }

      if (o.hasManualLabor !== false && o.hasEquipment === false) {
        oManual = o.cubicMetersRemoved || oManual;
      } else if (o.hasEquipment !== false && o.hasManualLabor === false) {
        oMachinery = o.cubicMetersRemoved || oMachinery;
      }

      manualM3 += oManual;
      machineryM3 += oMachinery;
    });

    return { totalM3, totalHH, totalOTs, manualM3, machineryM3, matchingOrders };
  };

  // Determine Heatmap Status Color
  const getHeatmapColor = (label: string) => {
    const { totalM3, totalHH, totalOTs } = getBeltMetrics(label);
    
    let isCritical = false;
    let isMedium = false;

    if (activeMetric === 'VOLUME_M3') {
      if (totalM3 >= 30) isCritical = true;
      else if (totalM3 > 0) isMedium = true;
    } else if (activeMetric === 'MAN_HOURS') {
      if (totalHH >= 24) isCritical = true;
      else if (totalHH > 0) isMedium = true;
    } else if (activeMetric === 'OT_COUNT') {
      if (totalOTs >= 3) isCritical = true;
      else if (totalOTs > 0) isMedium = true;
    }

    if (isCritical) {
      return { fill: '#FEF2F2', stroke: '#EF4444', text: '#991B1B', badge: '🔴 CRÍTICO', pattern: true };
    } else if (isMedium) {
      return { fill: '#FFF7ED', stroke: '#F97316', text: '#C2410C', badge: '🟡 MEDIO', pattern: false };
    } else {
      return { fill: '#ECFDF5', stroke: '#10B981', text: '#047857', badge: '🟢 LIMPIO', pattern: false };
    }
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

  // Selected Belt Metrics for Side Inspection Drawer
  const selectedMetrics = selectedBeltLabel ? getBeltMetrics(selectedBeltLabel) : null;

  return (
    <div className="card" style={{ padding: '24px' }}>
      
      {/* HEADER WITH TITLE & CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers style={{ color: 'var(--orange)' }} /> Mapa Operacional SVG & Heatmap de Planta (Zaldívar)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginTop: '2px' }}>
            Visualización gráfica en tiempo real de correas, volumen de material removido (m³), HH y criticidad
          </p>
        </div>

        {/* METRIC CONTROLLER BUTTONS */}
        <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--slate-100)', padding: '4px', borderRadius: '14px', border: '1px solid var(--slate-200)' }}>
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
            onClick={() => setActiveMetric('MAN_HOURS')}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              fontWeight: 900,
              fontSize: '11px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeMetric === 'MAN_HOURS' ? 'var(--orange)' : 'transparent',
              color: activeMetric === 'MAN_HOURS' ? '#FFF' : 'var(--slate-600)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={14} /> 👷 Horas Hombre (HH)
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
        <div className="scrollable-tabs" style={{ margin: 0, border: 'none', padding: 0 }}>
          {DIAGRAMS.map(d => (
            <button
              key={d.id}
              onClick={() => { setActiveDiagramId(d.id); setSelectedBeltLabel(null); }}
              className={`nav-item ${activeDiagramId === d.id ? 'active' : ''}`}
              style={{
                padding: '8px 16px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 900,
                whiteSpace: 'nowrap',
                backgroundColor: activeDiagramId === d.id ? '#FFF7ED' : 'transparent',
                color: activeDiagramId === d.id ? 'var(--orange)' : 'var(--slate-600)',
                borderRight: activeDiagramId === d.id ? '4px solid var(--orange)' : 'none'
              }}
            >
              {d.title}
            </button>
          ))}
        </div>

        {/* TIME FILTER */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800 }}>
            <Filter size={14} style={{ color: 'var(--slate-400)' }} />
            <span>Periodo:</span>
            <select
              value={timeFilter}
              onChange={e => setTimeFilter(e.target.value as TimeFilterType)}
              style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--slate-200)', fontSize: '11px', fontWeight: 800 }}
            >
              <option value="ALL">Histórico Consolidado</option>
              <option value="ACTIVE_WEEK">Semana Activa (W33)</option>
            </select>
          </div>
        </div>
      </div>

      {/* HEATMAP LEGEND BAR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', padding: '10px 16px', backgroundColor: 'var(--slate-50)', borderRadius: '12px', border: '1px solid var(--slate-200)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--slate-400)', letterSpacing: '0.05em' }}>
          Nivel de Calor ({resourceFilter === 'EQUIPMENT' ? '📦 Volumen m³' : '👷 Horas Hombre'}):
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#991B1B' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#FEF2F2', border: '2px solid #EF4444', display: 'inline-block' }} />
          🔴 Crítico ({resourceFilter === 'EQUIPMENT' ? '>50 m³' : '>40 HH'})
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#C2410C' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#FFF7ED', border: '2px solid #F97316', display: 'inline-block' }} />
          🟡 Medio ({resourceFilter === 'EQUIPMENT' ? '15-50 m³' : '15-40 HH'})
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#047857' }}>
          <span style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#ECFDF5', border: '2px solid #10B981', display: 'inline-block' }} />
          🟢 Normal ({resourceFilter === 'EQUIPMENT' ? '<15 m³' : '<15 HH'})
        </div>
      </div>

      {/* MAIN LAYOUT CONTAINER: SVG DIAGRAM CANVAS WITH FLOATING TOP-RIGHT TOGGLE */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', alignItems: 'start' }}>
        
        {/* SVG DIAGRAM CANVAS WITH RELATIVE POSITIONING */}
        <div style={{ position: 'relative', backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid var(--slate-200)', padding: '20px', overflowX: 'auto', boxShadow: 'var(--shadow-sm)' }}>
          
          {/* FLOATING TOP-RIGHT DIDACTIC RESOURCE TOGGLE SWITCHER */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              zIndex: 20, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px', 
              backgroundColor: '#FFFFFF', 
              padding: '6px', 
              borderRadius: '16px', 
              border: '2px solid var(--orange)', 
              boxShadow: 'var(--shadow-md)' 
            }}
          >
            <button
              onClick={() => {
                setResourceFilter('EQUIPMENT');
                setActiveMetric('VOLUME_M3');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: resourceFilter === 'EQUIPMENT' ? 'var(--orange)' : 'transparent',
                color: resourceFilter === 'EQUIPMENT' ? '#FFFFFF' : 'var(--slate-600)',
                boxShadow: resourceFilter === 'EQUIPMENT' ? '0 4px 12px rgba(255, 122, 0, 0.3)' : 'none'
              }}
            >
              <Truck size={16} /> 🚜 Maquinaria (Flota)
            </button>

            <button
              onClick={() => {
                setResourceFilter('MANUAL');
                setActiveMetric('MAN_HOURS');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '12px',
                fontWeight: 900,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: resourceFilter === 'MANUAL' ? '#0284C7' : 'transparent',
                color: resourceFilter === 'MANUAL' ? '#FFFFFF' : 'var(--slate-600)',
                boxShadow: resourceFilter === 'MANUAL' ? '0 4px 12px rgba(2, 132, 199, 0.3)' : 'none'
              }}
            >
              <HardHat size={16} /> 👷 Trabajo Manual
            </button>
          </div>
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

                  {/* NODE LABEL TEXT */}
                  <text
                    x={cx}
                    y={cy - (lines.length - 1) * 6 + 3}
                    textAnchor="middle"
                    fill={colorInfo.text}
                    fontSize={11}
                    fontWeight={900}
                  >
                    {lines.map((l, i) => (
                      <tspan key={i} x={cx} dy={i === 0 ? 0 : 12}>{l}</tspan>
                    ))}
                  </text>

                  {/* METRIC BADGE CENTERED ATOP NODE WITH DYNAMIC AUTO-WIDTH & DROP SHADOW */}
                  {metrics.totalOTs > 0 && (() => {
                    const valStr = activeMetric === 'VOLUME_M3' 
                      ? `${Math.round(metrics.totalM3)} m³` 
                      : activeMetric === 'MAN_HOURS' 
                        ? `${metrics.totalHH}h` 
                        : `${metrics.totalOTs} OTs`;
                    
                    const badgeWidth = Math.max(36, valStr.length * 6.5 + 14);
                    const badgeHeight = 18;
                    const badgeX = cx - badgeWidth / 2;
                    const badgeY = n.y - badgeHeight + 3;

                    return (
                      <g transform={`translate(${badgeX}, ${badgeY})`} style={{ pointerEvents: 'none' }}>
                        <rect 
                          width={badgeWidth} 
                          height={badgeHeight} 
                          rx={9} 
                          fill={colorInfo.stroke} 
                          stroke="#FFFFFF" 
                          strokeWidth="1.5"
                          style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.25))' }} 
                        />
                        <text 
                          x={badgeWidth / 2} 
                          y={12} 
                          textAnchor="middle" 
                          fill="#FFFFFF" 
                          fontSize="10" 
                          fontWeight="900"
                        >
                          {valStr}
                        </text>
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </svg>
        </div>

      {/* POP-UP MODAL EMERGENTE DE INSPECCIÓN DE CORREA / SECTOR */}
      {selectedBeltLabel && selectedMetrics && (
        <div 
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              <div style={{ backgroundColor: '#FFF7ED', padding: '12px', borderRadius: '14px', border: '1px solid #FFEDD5' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#C2410C', textTransform: 'uppercase' }}>📦 Volumen Total</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--orange)' }}>{selectedMetrics.totalM3.toFixed(1)} m³</div>
                <div style={{ fontSize: '10px', color: 'var(--slate-500)', marginTop: '2px', fontWeight: 700 }}>{selectedMetrics.totalOTs} OTs Totales</div>
              </div>

              <div style={{ backgroundColor: '#ECFDF5', padding: '12px', borderRadius: '14px', border: '1px solid #A7F3D0' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#047857', textTransform: 'uppercase' }}>👷 Aporte Manual</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#059669' }}>{selectedMetrics.manualM3.toFixed(1)} m³</div>
                <div style={{ fontSize: '10px', color: '#047857', marginTop: '2px', fontWeight: 800 }}>
                  {selectedMetrics.totalM3 > 0 ? `${((selectedMetrics.manualM3 / selectedMetrics.totalM3) * 100).toFixed(0)}% del total` : '0%'}
                </div>
              </div>

              <div style={{ backgroundColor: '#F0F9FF', padding: '12px', borderRadius: '14px', border: '1px solid #7DD3FC' }}>
                <div style={{ fontSize: '10px', fontWeight: 900, color: '#0369A1', textTransform: 'uppercase' }}>🚜 Aporte Maquinaria</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0284C7' }}>{selectedMetrics.machineryM3.toFixed(1)} m³</div>
                <div style={{ fontSize: '10px', color: '#0369A1', marginTop: '2px', fontWeight: 800 }}>
                  {selectedMetrics.totalM3 > 0 ? `${((selectedMetrics.machineryM3 / selectedMetrics.totalM3) * 100).toFixed(0)}% del total` : '0%'}
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
                  Sin Órdenes de Trabajo registradas en este periodo para esta correa.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                  {selectedMetrics.matchingOrders.map(o => {
                    let oManualM3 = 0;
                    let oMachineryM3 = 0;
                    const wPerDay = whiteLabel?.manualLaborConfig?.wheelbarrowsPerDay ?? 60;
                    const hEff = whiteLabel?.manualLaborConfig?.effectiveHoursPerDay ?? 6;
                    const capM3 = whiteLabel?.manualLaborConfig?.wheelbarrowCapacityM3 ?? 0.08;
                    const m3PerHour = (hEff > 0 ? wPerDay / hEff : 10) * capM3;

                    if (o.hasManualLabor !== false) {
                      oManualM3 = (o.headcount || 0) * (o.realHours || 0) * m3PerHour;
                    }
                    if (o.hasEquipment !== false) {
                      const selectedMachine = (machines || []).find(m => m.patent === o.vehiclePatent);
                      const cap = selectedMachine?.capacityM3 ?? o.bucketCapacityM3 ?? 0;
                      oMachineryM3 = (o.fleetTripsCount || 0) * cap;
                    }
                    if (o.hasManualLabor !== false && o.hasEquipment === false) {
                      oManualM3 = o.cubicMetersRemoved || oManualM3;
                    } else if (o.hasEquipment !== false && o.hasManualLabor === false) {
                      oMachineryM3 = o.cubicMetersRemoved || oMachineryM3;
                    }

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
                          {o.hasManualLabor !== false && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontWeight: 800 }}>
                              👷 Manual: {oManualM3.toFixed(1)} m³ ({o.headcount || 1} pers)
                            </span>
                          )}
                          {o.hasEquipment !== false && (
                            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '6px', backgroundColor: '#F0F9FF', color: '#0369A1', border: '1px solid #7DD3FC', fontWeight: 800 }}>
                              🚜 Maquinaria: {oMachineryM3.toFixed(1)} m³ ({o.fleetTripsCount || 0} vueltas)
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
