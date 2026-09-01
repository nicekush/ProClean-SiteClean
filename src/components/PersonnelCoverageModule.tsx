import React, { useState, useMemo } from 'react';
import type { 
  PersonnelMember, 
  CargoConfig, 
  PlantArea, 
  DailyPersonnelAssignment, 
  UserRole,
  ShiftType 
} from '../types';
import { 
  Users, 
  Plus, 
  Printer, 
  X, 
  Building2
} from 'lucide-react';

interface PersonnelCoverageModuleProps {
  personnel: PersonnelMember[];
  cargos: CargoConfig[];
  plantAreas: PlantArea[];
  assignments: DailyPersonnelAssignment[];
  onSaveAssignments: (newAssignments: DailyPersonnelAssignment[]) => void;
  onAddPersonnelMember?: (member: Omit<PersonnelMember, 'id'>) => void;
  onUpdatePersonnelMember?: (id: string, updated: Partial<PersonnelMember>) => void;
  onDeletePersonnelMember?: (id: string) => void;
  shifts?: ShiftType[];
  currentRole: UserRole;
  userEmail?: string;
}

// Initial Default Cargos if empty
const DEFAULT_CARGOS: CargoConfig[] = [
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
  { id: 'c_robot', nombre: 'Aseo Robotizado', code: 'ROBOT', restrictedAreaIds: ['pa_3', 'a_personal_4x3'] },
  { id: 'c_acd', nombre: 'ACD', code: 'ACD', restrictedAreaIds: ['pa_3', 'a_personal_4x3'] },
  { id: 'c_jefe_prev', nombre: 'Jefe de Prevención', code: 'JEF-PREV', restrictedAreaIds: ['pa_3', 'a_personal_4x3'] },
  { id: 'c_planif', nombre: 'Planificador', code: 'PLANIF', restrictedAreaIds: ['pa_3', 'a_personal_4x3'] },
  { id: 'c_rrhh', nombre: 'RRHH', code: 'RRHH', restrictedAreaIds: ['pa_3', 'a_personal_4x3'] },
  { id: 'c_jefe_taller', nombre: 'Jefe de Taller', code: 'JEF-TALLER', restrictedAreaIds: ['pa_3', 'a_personal_4x3'] }
];

export const PersonnelCoverageModule: React.FC<PersonnelCoverageModuleProps> = ({
  personnel = [],
  cargos = DEFAULT_CARGOS,
  plantAreas = [],
  assignments = [],
  onSaveAssignments,
  userEmail = 'supervisor@procleanmg.cl'
}) => {
  // Filter States
  const [activeShiftFilter, setActiveShiftFilter] = useState<'ALL' | 'DAY' | 'NIGHT' | 'STAFF'>('ALL');
  const [activeGrupoFilter, setActiveGrupoFilter] = useState<'A' | 'B' | 'ALL'>('A');

  // 4-Step Wizard Modal State
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [wizardAreaId, setWizardAreaId] = useState<string>('');
  const [wizardSelectedCargoIds, setWizardSelectedCargoIds] = useState<string[]>([]);
  const [wizardCargoCounts, setWizardCargoCounts] = useState<Record<string, number>>({});
  
  // Slot Assignments Map in Wizard: key = `${cargoId}_${slotIndex}` -> personId
  const [wizardSlotAssignments, setWizardSlotAssignments] = useState<Record<string, { personId: string; personName: string }>>({});
  const [slotSearchQuery, setSlotSearchQuery] = useState<Record<string, string>>({});

  // Active Date string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Effective Areas List with Default Pre-sets if empty
  const effectiveAreas = useMemo(() => {
    if (plantAreas && plantAreas.length > 0) return plantAreas;
    return [
      { id: 'pa_2', name: 'Área Seca', code: 'AR-SECA' },
      { id: 'pa_1', name: 'Área Húmeda (LIX-SX-EW-RO)', code: 'AR-HUM' },
      { id: 'pa_3', name: 'Sectores Complementarios / Staff 4x3', code: 'AR-COMP' }
    ];
  }, [plantAreas]);

  // Effective Cargos List
  const effectiveCargos = useMemo(() => {
    return cargos.length > 0 ? cargos : DEFAULT_CARGOS;
  }, [cargos]);

  // Filtered Roster by Active Group (Turno A or Turno B)
  const groupPersonnel = useMemo(() => {
    if (activeGrupoFilter === 'ALL') return personnel;
    return personnel.filter(p => p.grupo === activeGrupoFilter || p.grupo === 'AMBOS');
  }, [personnel, activeGrupoFilter]);

  // Set of person IDs currently assigned in active date assignments
  const assignedPersonIdsSet = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach(a => {
      if (a.personId) set.add(a.personId);
    });
    // Also include currently selected in wizard
    Object.values(wizardSlotAssignments).forEach(val => {
      if (val.personId) set.add(val.personId);
    });
    return set;
  }, [assignments, wizardSlotAssignments]);

  // Filtered Cargos for Wizard Step 2 based on selected Area restrictions
  const availableCargosForSelectedArea = useMemo(() => {
    if (!wizardAreaId) return effectiveCargos;
    return effectiveCargos.filter(c => {
      if (!c.restrictedAreaIds || c.restrictedAreaIds.length === 0) return true;
      return c.restrictedAreaIds.includes(wizardAreaId);
    });
  }, [wizardAreaId, effectiveCargos]);

  // Calculate Coverage Metrics
  const metrics = useMemo(() => {
    let totalRequired = 0;
    let totalCovered = 0;
    const cargoBreakdown: Record<string, { required: number; covered: number; name: string }> = {};

    assignments.forEach(a => {
      totalRequired += 1;
      if (a.personId) totalCovered += 1;
      
      if (!cargoBreakdown[a.cargoId]) {
        cargoBreakdown[a.cargoId] = { required: 0, covered: 0, name: a.cargoName || 'Cargo' };
      }
      cargoBreakdown[a.cargoId].required += 1;
      if (a.personId) cargoBreakdown[a.cargoId].covered += 1;
    });

    const pct = totalRequired > 0 ? Math.round((totalCovered / totalRequired) * 100) : 100;
    const gap = totalRequired - totalCovered;

    return { totalRequired, totalCovered, pct, gap, cargoBreakdown };
  }, [assignments]);

  // Open Wizard for an Area
  const handleOpenWizardForArea = (areaId?: string) => {
    setWizardStep(1);
    setWizardAreaId(areaId || '');
    setWizardSelectedCargoIds([]);
    setWizardCargoCounts({});
    setWizardSlotAssignments({});
    setSlotSearchQuery({});

    if (areaId) {
      // Pre-fill existing assignments for this area if any
      const existing = assignments.filter(a => a.areaId === areaId);
      if (existing.length > 0) {
        const cargoIds = Array.from(new Set(existing.map(a => a.cargoId)));
        const counts: Record<string, number> = {};
        const slots: Record<string, { personId: string; personName: string }> = {};

        existing.forEach(a => {
          counts[a.cargoId] = (counts[a.cargoId] || 0) + 1;
          const slotIdx = a.slotIndex || 0;
          slots[`${a.cargoId}_${slotIdx}`] = { personId: a.personId || '', personName: a.personName || '' };
        });

        setWizardSelectedCargoIds(cargoIds);
        setWizardCargoCounts(counts);
        setWizardSlotAssignments(slots);
        setWizardStep(2);
      } else {
        setWizardStep(2);
      }
    }

    setShowWizardModal(true);
  };

  // Toggle Cargo Selection in Step 2
  const handleToggleCargo = (cargoId: string) => {
    if (wizardSelectedCargoIds.includes(cargoId)) {
      setWizardSelectedCargoIds(prev => prev.filter(id => id !== cargoId));
      setWizardCargoCounts(prev => {
        const copy = { ...prev };
        delete copy[cargoId];
        return copy;
      });
    } else {
      setWizardSelectedCargoIds(prev => [...prev, cargoId]);
      setWizardCargoCounts(prev => ({ ...prev, [cargoId]: 1 }));
    }
  };

  // Adjust Cargo Count in Step 3
  const handleAdjustCargoCount = (cargoId: string, delta: number) => {
    setWizardCargoCounts(prev => {
      const current = prev[cargoId] || 1;
      const next = Math.max(1, current + delta);
      return { ...prev, [cargoId]: next };
    });
  };

  // Assign Person to Slot in Step 4
  const handleAssignPersonToSlot = (cargoId: string, slotIdx: number, person: PersonnelMember) => {
    const key = `${cargoId}_${slotIdx}`;
    setWizardSlotAssignments(prev => ({
      ...prev,
      [key]: { personId: person.id, personName: person.nombre }
    }));
    // Clear search query for this slot
    setSlotSearchQuery(prev => ({ ...prev, [key]: '' }));
  };

  // Remove Person from Slot
  const handleRemovePersonFromSlot = (cargoId: string, slotIdx: number) => {
    const key = `${cargoId}_${slotIdx}`;
    setWizardSlotAssignments(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // Submit Wizard and Save Area Coverage Assignments
  const handleSaveWizardAreaCoverage = () => {
    if (!wizardAreaId) return;

    // Filter out previous assignments for this area and build new list
    const otherAssignments = assignments.filter(a => a.areaId !== wizardAreaId);

    const newAreaAssignments: DailyPersonnelAssignment[] = [];

    wizardSelectedCargoIds.forEach(cargoId => {
      const cargoObj = effectiveCargos.find(c => c.id === cargoId);
      const count = wizardCargoCounts[cargoId] || 1;

      for (let i = 0; i < count; i++) {
        const slotKey = `${cargoId}_${i}`;
        const slotData = wizardSlotAssignments[slotKey] || { personId: '', personName: '' };

        newAreaAssignments.push({
          id: `asg_${wizardAreaId}_${cargoId}_${i}_${Date.now()}`,
          areaId: wizardAreaId,
          cargoId,
          cargoName: cargoObj ? cargoObj.nombre : 'Cargo',
          slotIndex: i,
          fecha: todayStr,
          grupo: activeGrupoFilter === 'ALL' ? 'A' : activeGrupoFilter,
          shiftId: activeShiftFilter === 'ALL' ? 't_dia' : activeShiftFilter,
          personId: slotData.personId,
          personName: slotData.personName,
          userEmail
        });
      }
    });

    onSaveAssignments([...otherAssignments, ...newAreaAssignments]);
    setShowWizardModal(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. EXECUTIVE HEADER & KPI METRICS */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={24} style={{ color: 'var(--orange)' }} /> Dotación & Cobertura Operacional de Personal
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginTop: '4px', margin: 0 }}>
              Control diario de cobertura por área, nombramiento de personal y firmas de asistencia — Planta Zaldívar
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => window.print()} 
              className="btn btn-secondary" 
              style={{ fontSize: '13px', padding: '10px 18px' }}
            >
              <Printer size={16} /> Imprimir Reporte PDF (1 Hoja)
            </button>
            <button 
              onClick={() => handleOpenWizardForArea()} 
              className="btn btn-primary" 
              style={{ fontSize: '13px', padding: '10px 18px', backgroundColor: 'var(--orange)' }}
            >
              <Plus size={16} /> + Reportar Cobertura de Área
            </button>
          </div>
        </div>

        {/* KPI METRICS CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          
          {/* Card 1: Cobertura Global */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cobertura Global Planta
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: metrics.pct >= 90 ? '#15803D' : '#C2410C', marginTop: '4px' }}>
              {metrics.pct}%
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-600)', marginTop: '2px' }}>
              {metrics.totalCovered} / {metrics.totalRequired} Personas Asignadas
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ width: `${metrics.pct}%`, height: '100%', backgroundColor: metrics.pct >= 90 ? '#22C55E' : '#F97316', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Card 2: Vacantes Pendientes */}
          <div style={{ backgroundColor: metrics.gap > 0 ? '#FEF2F2' : '#F0FDF4', padding: '16px', borderRadius: '16px', border: `1px solid ${metrics.gap > 0 ? '#FCA5A5' : '#86EFAC'}` }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: metrics.gap > 0 ? '#991B1B' : '#166534', textTransform: 'uppercase' }}>
              Vacantes / Brechas
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: metrics.gap > 0 ? '#DC2626' : '#16A34A', marginTop: '4px' }}>
              {metrics.gap > 0 ? `${metrics.gap} Cupos` : '0 Brechas'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: metrics.gap > 0 ? '#B91C1C' : '#15803D', marginTop: '2px' }}>
              {metrics.gap > 0 ? 'Dotación pendiente por asignar' : '100% Dotación Cubierta'}
            </div>
          </div>

          {/* Card 3: Desglose por Cargos */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Dotación por Cargo (Cubiertos / Requeridos)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(metrics.cargoBreakdown).length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--slate-400)' }}>Sin datos de asignación aún</span>
              ) : (
                Object.values(metrics.cargoBreakdown).map((cb, idx) => {
                  const isFull = cb.covered >= cb.required;
                  return (
                    <span 
                      key={idx}
                      style={{ 
                        fontSize: '11px', 
                        fontWeight: 800, 
                        padding: '4px 10px', 
                        borderRadius: '20px', 
                        backgroundColor: isFull ? '#DCFCE7' : '#FFEDD5',
                        color: isFull ? '#166534' : '#C2410C',
                        border: `1px solid ${isFull ? '#86EFAC' : '#FDBA74'}`
                      }}
                    >
                      {cb.name}: {cb.covered}/{cb.required} {isFull ? '✓' : '🚨'}
                    </span>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

      {/* 2. CONTROL BARS A PRUEBA DE NIÑOS (100% WIDTH FLEX TABS) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* BARRA 1: TURNO / JORNADA */}
        <div style={{ display: 'flex', width: '100%', backgroundColor: '#E2E8F0', borderRadius: '14px', padding: '4px', gap: '4px' }}>
          <button
            onClick={() => setActiveShiftFilter('ALL')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeShiftFilter === 'ALL' ? '#0F172A' : 'transparent',
              color: activeShiftFilter === 'ALL' ? '#FFFFFF' : '#475569',
              boxShadow: activeShiftFilter === 'ALL' ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🌐 Malla Completa
          </button>
          <button
            onClick={() => setActiveShiftFilter('DAY')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeShiftFilter === 'DAY' ? '#FF7A00' : 'transparent',
              color: activeShiftFilter === 'DAY' ? '#FFFFFF' : '#475569',
              boxShadow: activeShiftFilter === 'DAY' ? '0 2px 6px rgba(255,122,0,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            ☀️ Turno Día (29 HH)
          </button>
          <button
            onClick={() => setActiveShiftFilter('NIGHT')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeShiftFilter === 'NIGHT' ? '#4F46E5' : 'transparent',
              color: activeShiftFilter === 'NIGHT' ? '#FFFFFF' : '#475569',
              boxShadow: activeShiftFilter === 'NIGHT' ? '0 2px 6px rgba(79,70,229,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🌙 Turno Noche (15 HH)
          </button>
          <button
            onClick={() => setActiveShiftFilter('STAFF')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeShiftFilter === 'STAFF' ? '#0284C7' : 'transparent',
              color: activeShiftFilter === 'STAFF' ? '#FFFFFF' : '#475569',
              boxShadow: activeShiftFilter === 'STAFF' ? '0 2px 6px rgba(2,132,199,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            👔 Staff 4x3 (6 HH)
          </button>
        </div>

        {/* BARRA 2: MALLA ROTATIVA 7X7 (TURNO A VS TURNO B) */}
        <div style={{ display: 'flex', width: '100%', backgroundColor: '#E2E8F0', borderRadius: '14px', padding: '4px', gap: '4px' }}>
          <button
            onClick={() => setActiveGrupoFilter('A')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeGrupoFilter === 'A' ? '#15803D' : 'transparent',
              color: activeGrupoFilter === 'A' ? '#FFFFFF' : '#475569',
              boxShadow: activeGrupoFilter === 'A' ? '0 2px 6px rgba(21,128,61,0.25)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🅰️ Turno A (42 Colaboradores)
          </button>
          <button
            onClick={() => setActiveGrupoFilter('B')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeGrupoFilter === 'B' ? '#0284C7' : 'transparent',
              color: activeGrupoFilter === 'B' ? '#FFFFFF' : '#475569',
              boxShadow: activeGrupoFilter === 'B' ? '0 2px 6px rgba(2,132,199,0.25)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            🅱️ Turno B (44 Colaboradores)
          </button>
          <button
            onClick={() => setActiveGrupoFilter('ALL')}
            style={{
              flex: 1,
              padding: '10px 4px',
              border: 'none',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              backgroundColor: activeGrupoFilter === 'ALL' ? '#334155' : 'transparent',
              color: activeGrupoFilter === 'ALL' ? '#FFFFFF' : '#475569',
              transition: 'all 0.2s'
            }}
          >
            🌐 Todos los Grupos
          </button>
        </div>

      </div>

      {/* 3. AREA CARDS GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        {effectiveAreas.map(area => {
          const areaAssignments = assignments.filter(a => a.areaId === area.id);
          const reqCount = areaAssignments.length;
          const coveredCount = areaAssignments.filter(a => a.personId).length;
          const isComplete = reqCount > 0 && coveredCount === reqCount;

          return (
            <div 
              key={area.id} 
              className="card" 
              style={{ 
                padding: '18px', 
                borderTop: `4px solid ${isComplete ? '#22C55E' : 'var(--orange)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    📍 {area.code || 'UBICACION'}
                  </span>
                  <span 
                    style={{ 
                      fontSize: '11px', 
                      fontWeight: 800, 
                      padding: '4px 10px', 
                      borderRadius: '12px',
                      backgroundColor: isComplete ? '#DCFCE7' : '#FEF3C7',
                      color: isComplete ? '#15803D' : '#B45309'
                    }}
                  >
                    {reqCount === 0 ? 'Sin Dotación Configurada' : isComplete ? '✅ 100% Cubierto' : `🚨 ${reqCount - coveredCount} Vacantes`}
                  </span>
                </div>

                <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--slate-900)', margin: '0 0 12px 0' }}>
                  {area.name}
                </h3>

                {/* Slots Breakdown inside Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {areaAssignments.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--slate-400)', fontStyle: 'italic', padding: '10px 0' }}>
                      No se ha reportado dotación para esta ubicación. Toca el botón para iniciar.
                    </div>
                  ) : (
                    areaAssignments.map(asg => (
                      <div 
                        key={asg.id}
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '8px 12px', 
                          backgroundColor: asg.personId ? '#F1F5F9' : '#FEF2F2',
                          borderRadius: '10px',
                          border: `1px solid ${asg.personId ? '#CBD5E1' : '#FCA5A5'}`
                        }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--slate-800)' }}>
                          {asg.cargoName}:
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 900, color: asg.personId ? '#0F172A' : '#DC2626' }}>
                          {asg.personName || '❌ Vacante (Sin Asignar)'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                onClick={() => handleOpenWizardForArea(area.id)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 800, justifyContent: 'center', marginTop: '8px' }}
              >
                ✏️ Editar / Reportar Cobertura del Área
              </button>
            </div>
          );
        })}
      </div>

      {/* 4. "A PRUEBA DE NIÑOS" 4-STEP WIZARD MODAL */}
      {showWizardModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: '640px', width: '95%', padding: '24px', borderRadius: '24px' }}>
            
            {/* WIZARD STEP HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 900, color: 'var(--orange)', textTransform: 'uppercase' }}>
                  Paso {wizardStep} de 4
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--slate-900)', margin: 0 }}>
                  {wizardStep === 1 && '📍 Paso 1: Selecciona la Ubicación / Área'}
                  {wizardStep === 2 && '💼 Paso 2: Selecciona los Cargos del Área'}
                  {wizardStep === 3 && '🔢 Paso 3: Define la Cantidad de Personas por Cargo'}
                  {wizardStep === 4 && '👥 Paso 4: Asigna el Personal por Cupo'}
                </h3>
              </div>
              <button onClick={() => setShowWizardModal(false)} className="btn-icon" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {/* STEP 1: SELECT AREA */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: 0 }}>
                  Toca el área de planta que vas a reportar en este turno:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  {effectiveAreas.map(area => (
                    <button
                      key={area.id}
                      onClick={() => {
                        setWizardAreaId(area.id);
                        setWizardStep(2);
                      }}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: '2px solid #E2E8F0',
                        backgroundColor: '#FFF',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Building2 size={24} style={{ color: 'var(--orange)' }} />
                      <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--slate-900)' }}>{area.name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{area.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: SELECT CARGOS (FILTERED STRICTLY BY AREA RESTRICTIONS) */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: 0 }}>
                  Toca los cargos que operarán hoy en <strong>{effectiveAreas.find(a => a.id === wizardAreaId)?.name}</strong>:
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '280px', overflowY: 'auto', padding: '4px' }}>
                  {availableCargosForSelectedArea.map(cargo => {
                    const isSelected = wizardSelectedCargoIds.includes(cargo.id);
                    return (
                      <button
                        key={cargo.id}
                        onClick={() => handleToggleCargo(cargo.id)}
                        style={{
                          padding: '10px 16px',
                          borderRadius: '20px',
                          border: `2px solid ${isSelected ? 'var(--orange)' : '#CBD5E1'}`,
                          backgroundColor: isSelected ? '#FFEDD5' : '#FFF',
                          color: isSelected ? '#C2410C' : '#334155',
                          fontSize: '13px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '} {cargo.nombre}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(1)}>◄ Atrás</button>
                  <button 
                    className="btn btn-primary"
                    disabled={wizardSelectedCargoIds.length === 0}
                    onClick={() => setWizardStep(3)}
                    style={{ backgroundColor: wizardSelectedCargoIds.length > 0 ? 'var(--orange)' : '#CBD5E1' }}
                  >
                    Siguiente: Cantidad de Personas ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: DEFINE CARGO HEADCOUNT (TOUCH COUNTERS) */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: 0 }}>
                  Define cuántas personas se requieren para cada cargo seleccionado:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                  {wizardSelectedCargoIds.map(cargoId => {
                    const cargoObj = effectiveCargos.find(c => c.id === cargoId);
                    const count = wizardCargoCounts[cargoId] || 1;

                    return (
                      <div 
                        key={cargoId}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '14px',
                          border: '1px solid #E2E8F0'
                        }}
                      >
                        <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--slate-900)' }}>
                          {cargoObj?.nombre}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button
                            onClick={() => handleAdjustCargoCount(cargoId, -1)}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFF',
                              fontWeight: 900,
                              fontSize: '18px',
                              cursor: 'pointer'
                            }}
                          >
                            -
                          </button>

                          <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--orange)', minWidth: '24px', textAlign: 'center' }}>
                            {count}
                          </span>

                          <button
                            onClick={() => handleAdjustCargoCount(cargoId, 1)}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              border: '1px solid #CBD5E1',
                              backgroundColor: '#FFF',
                              fontWeight: 900,
                              fontSize: '18px',
                              cursor: 'pointer'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(2)}>◄ Atrás</button>
                  <button className="btn btn-primary" onClick={() => setWizardStep(4)} style={{ backgroundColor: 'var(--orange)' }}>
                    Siguiente: Asignar Nombres ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ASSIGN PERSON NAMES WITH SMART SEARCH */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', margin: 0 }}>
                  Asigna el colaborador correspondiente a cada cupo de la lista:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '340px', overflowY: 'auto' }}>
                  {wizardSelectedCargoIds.map(cargoId => {
                    const cargoObj = effectiveCargos.find(c => c.id === cargoId);
                    const count = wizardCargoCounts[cargoId] || 1;

                    return Array.from({ length: count }).map((_, slotIdx) => {
                      const slotKey = `${cargoId}_${slotIdx}`;
                      const currentAssigned = wizardSlotAssignments[slotKey];
                      const query = slotSearchQuery[slotKey] || '';

                      // Filter personnel by query AND exclude already assigned to other slots
                      const matchingPeople = groupPersonnel.filter(p => {
                        if (assignedPersonIdsSet.has(p.id) && currentAssigned?.personId !== p.id) return false;
                        if (!query) return true;
                        return p.nombre.toLowerCase().includes(query.toLowerCase());
                      });

                      return (
                        <div 
                          key={slotKey}
                          style={{
                            padding: '12px',
                            backgroundColor: currentAssigned?.personId ? '#F0FDF4' : '#FEF2F2',
                            borderRadius: '14px',
                            border: `1.5px solid ${currentAssigned?.personId ? '#86EFAC' : '#FCA5A5'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', fontWeight: 900, color: 'var(--slate-800)' }}>
                              📍 {cargoObj?.nombre} (Cupo {slotIdx + 1} de {count})
                            </span>
                            {currentAssigned?.personId ? (
                              <button 
                                onClick={() => handleRemovePersonFromSlot(cargoId, slotIdx)}
                                style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '11px', fontWeight: 800, cursor: 'pointer' }}
                              >
                                ✖ Quitar
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 800, color: '#DC2626' }}>
                                🚨 Vacante
                              </span>
                            )}
                          </div>

                          {currentAssigned?.personId ? (
                            <div style={{ fontSize: '14px', fontWeight: 900, color: '#166534' }}>
                              ✅ {currentAssigned.personName}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <input
                                type="text"
                                className="form-control"
                                placeholder={`🔍 Buscar colaborador para ${cargoObj?.nombre}...`}
                                value={query}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSlotSearchQuery(prev => ({ ...prev, [slotKey]: val }));
                                }}
                                style={{ fontSize: '12px', padding: '8px 12px' }}
                              />

                              {query && (
                                <div style={{ backgroundColor: '#FFF', borderRadius: '8px', border: '1px solid #CBD5E1', maxHeight: '120px', overflowY: 'auto' }}>
                                  {matchingPeople.length === 0 ? (
                                    <div style={{ padding: '8px', fontSize: '12px', color: 'var(--slate-400)' }}>Sin coincidencias disponibles</div>
                                  ) : (
                                    matchingPeople.slice(0, 5).map(p => (
                                      <div
                                        key={p.id}
                                        onClick={() => handleAssignPersonToSlot(cargoId, slotIdx, p)}
                                        style={{
                                          padding: '8px 12px',
                                          fontSize: '12px',
                                          fontWeight: 800,
                                          cursor: 'pointer',
                                          borderBottom: '1px solid #F1F5F9'
                                        }}
                                      >
                                        👤 {p.nombre} ({p.grupo})
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setWizardStep(3)}>◄ Atrás</button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSaveWizardAreaCoverage}
                    style={{ backgroundColor: '#16A34A', padding: '12px 24px', fontSize: '13px' }}
                  >
                    ✅ Guardar Cobertura del Área
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
