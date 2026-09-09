import React, { useState, useMemo } from 'react';
import type { 
  PersonnelMember, 
  CargoConfig, 
  PlantArea, 
  DailyPersonnelAssignment, 
  UserRole,
  ShiftType,
  CoverageArea,
  AreaCargoTarget 
} from '../types';
import { 
  Users, 
  Plus, 
  Printer, 
  X, 
  Building2,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { OFFICIAL_PROCLEAN_LOGO_URL } from '../config/branding';

interface PersonnelCoverageModuleProps {
  personnel: PersonnelMember[];
  cargos?: CargoConfig[];
  coverageAreas?: CoverageArea[];
  assignments: DailyPersonnelAssignment[];
  onSaveAssignments: (newAssignments: DailyPersonnelAssignment[]) => void;
  onAddPersonnelMember?: (member: Omit<PersonnelMember, 'id'>) => void;
  onUpdatePersonnelMember?: (id: string, updated: Partial<PersonnelMember>) => void;
  onDeletePersonnelMember?: (id: string) => void;
  shifts?: ShiftType[];
  currentRole: UserRole;
  userEmail?: string;
  userName?: string;
}

interface WizardSlotAssignment {
  personId: string;
  personName: string;
  personSource?: 'ROSTER' | 'MANUAL_ENTRY';
}

const normalizePersonName = (value: string) => value.trim().replace(/\s+/g, ' ');

const getComparablePersonName = (value: string) => normalizePersonName(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-CL');

const getManualPersonId = (name: string) => {
  const comparableName = getComparablePersonName(name);
  let hash = 5381;
  for (let i = 0; i < comparableName.length; i += 1) {
    hash = ((hash << 5) + hash) ^ comparableName.charCodeAt(i);
  }
  return `manual_${(hash >>> 0).toString(36)}`;
};

export const PersonnelCoverageModule: React.FC<PersonnelCoverageModuleProps> = ({
  personnel = [],
  cargos = [],
  coverageAreas = [],
  assignments = [],
  onSaveAssignments,
  userEmail = 'supervisor@procleanmg.cl',
  userName = 'Supervisor de Terreno'
}) => {
  // Filter States
  const [activeShiftFilter, setActiveShiftFilter] = useState<'ALL' | 'DAY' | 'NIGHT' | 'STAFF'>('ALL');
  const [activeGrupoFilter, setActiveGrupoFilter] = useState<'A' | 'B' | 'ALL'>('A');

  // 4-Step Wizard Modal State (with Guided Tour Steps 5 & 6)
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isGuidedTour, setIsGuidedTour] = useState(false);
  const [wizardAreaId, setWizardAreaId] = useState<string>('');
  const [wizardSelectedCargoIds, setWizardSelectedCargoIds] = useState<string[]>([]);
  const [wizardCargoCounts, setWizardCargoCounts] = useState<Record<string, number>>({});
  
  // Slot Assignments Map in Wizard: key = `${cargoId}_${slotIndex}` -> personId
  const [wizardSlotAssignments, setWizardSlotAssignments] = useState<Record<string, WizardSlotAssignment>>({});
  const [slotSearchQuery, setSlotSearchQuery] = useState<Record<string, string>>({});
  const [printGeneratedAt, setPrintGeneratedAt] = useState(() => new Date());

  // Active Date string
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Effective Coverage Areas List (Puras desde Base de Datos)
  const effectiveAreas = useMemo(() => {
    return coverageAreas || [];
  }, [coverageAreas]);

  // Filtered Effective Areas based on Shift Filter
  const filteredAreas = useMemo(() => {
    if (activeShiftFilter === 'DAY') return effectiveAreas.filter(a => a.turnoId === 't_dia' || a.turnoId === 't_ambos');
    if (activeShiftFilter === 'NIGHT') return effectiveAreas.filter(a => a.turnoId === 't_noche' || a.turnoId === 't_ambos');
    if (activeShiftFilter === 'STAFF') return effectiveAreas.filter(a => a.turnoId === 't_4x3');
    return effectiveAreas;
  }, [effectiveAreas, activeShiftFilter]);

  // Effective Cargos List (Puros desde Base de Datos)
  const effectiveCargos = useMemo(() => {
    return cargos || [];
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

  // Filtered Cargos for Wizard Step 2 based on selected Area restrictions (with safe fallback)
  const availableCargosForSelectedArea = useMemo(() => {
    if (!wizardAreaId) return effectiveCargos;
    const filtered = effectiveCargos.filter(c => {
      if (!c.restrictedAreaIds || c.restrictedAreaIds.length === 0) return true;
      if (wizardAreaId === 'a_personal_4x3') return true;
      return c.restrictedAreaIds.includes(wizardAreaId);
    });
    return filtered.length > 0 ? filtered : effectiveCargos;
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

    const pct = totalRequired > 0 ? Math.round((totalCovered / totalRequired) * 100) : 0;
    const gap = totalRequired - totalCovered;

    return { totalRequired, totalCovered, pct, gap, cargoBreakdown };
  }, [assignments]);

  const printAssignments = useMemo(() => {
    // The operational cards are filtered by the area's configured shift, not by
    // assignment metadata. Older Firebase assignments may not have grupo/shiftId,
    // so filtering those fields here made valid reported areas disappear from PDF.
    const printableAreaIds = new Set(filteredAreas.map(area => area.id));
    return assignments.filter(assignment => printableAreaIds.has(assignment.areaId));
  }, [assignments, filteredAreas]);

  const printAreas = useMemo(() => effectiveAreas
    .filter(area => printAssignments.some(assignment => assignment.areaId === area.id))
    .sort((a, b) => a.orden - b.orden), [effectiveAreas, printAssignments]);

  const printMetrics = useMemo(() => {
    const required = printAssignments.length;
    const coveredAssignments = printAssignments.filter(assignment => assignment.personId);
    const covered = coveredAssignments.length;
    const planta = coveredAssignments.filter(assignment => personnel.find(person => person.id === assignment.personId)?.tipo === 'PLANTA').length;
    const spot = coveredAssignments.filter(assignment => personnel.find(person => person.id === assignment.personId)?.tipo === 'SPOT').length;
    return {
      required,
      covered,
      gap: required - covered,
      pct: required > 0 ? Math.round((covered / required) * 100) : 0,
      planta,
      spot
    };
  }, [printAssignments, personnel]);

  const printShiftLabel = {
    ALL: 'Malla Completa',
    DAY: 'Turno Día',
    NIGHT: 'Turno Noche',
    STAFF: 'Staff 4x3'
  }[activeShiftFilter];
  const printGroupLabel = activeGrupoFilter === 'ALL' ? 'Todos los grupos' : `Turno ${activeGrupoFilter}`;
  const reportDate = printAssignments[0]?.fecha || todayStr;
  const formattedReportDate = (() => {
    const [year, month, day] = reportDate.split('-');
    return year && month && day ? `${day}-${month}-${year}` : reportDate;
  })();
  const formattedPrintTime = new Intl.DateTimeFormat('es-CL', {
    timeZone: 'America/Santiago',
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(printGeneratedAt);

  const handlePrintCoverageReport = () => {
    setPrintGeneratedAt(new Date());
    const previousTitle = document.title;
    document.title = `ProCleanMG - Reporte dotación ${formattedReportDate}`;

    let titleRestored = false;
    const restoreDocumentTitle = () => {
      if (titleRestored) return;
      titleRestored = true;
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreDocumentTitle);
    };

    window.addEventListener('afterprint', restoreDocumentTitle, { once: true });

    window.setTimeout(() => {
      window.print();
      // Some embedded browsers do not emit afterprint. In regular browsers,
      // print() returns only after the dialog closes, so this remains safe.
      window.setTimeout(restoreDocumentTitle, 0);
    }, 75);
  };

  // Helper to select an area within Step 1 and pre-fill cargos/headcount
  const handleSelectAreaInStep1 = (areaId: string) => {
    setWizardAreaId(areaId);

    const existing = assignments.filter(a => a.areaId === areaId);
    if (existing.length > 0) {
      const cargoIds = Array.from(new Set(existing.map(a => a.cargoId)));
      const counts: Record<string, number> = {};
      const slots: Record<string, WizardSlotAssignment> = {};

      existing.forEach(a => {
        counts[a.cargoId] = (counts[a.cargoId] || 0) + 1;
        const slotIdx = a.slotIndex || 0;
        slots[`${a.cargoId}_${slotIdx}`] = {
          personId: a.personId || '',
          personName: a.personName || '',
          personSource: a.personSource || (a.personId?.startsWith('manual_') ? 'MANUAL_ENTRY' : 'ROSTER')
        };
      });

      setWizardSelectedCargoIds(cargoIds);
      setWizardCargoCounts(counts);
      setWizardSlotAssignments(slots);
    } else {
      // Pre-select allowed cargos for this area so Siguiente is active right away
      const allowed = effectiveCargos.filter(c => {
        if (!c.restrictedAreaIds || c.restrictedAreaIds.length === 0) return true;
        return c.restrictedAreaIds.includes(areaId);
      });
      const allowedIds = allowed.map(c => c.id);
      const counts: Record<string, number> = {};
      allowedIds.forEach(id => { counts[id] = 1; });

      setWizardSelectedCargoIds(allowedIds);
      setWizardCargoCounts(counts);
      setWizardSlotAssignments({});
    }

    setWizardStep(2);
  };

  // Open Wizard for an Area (or launch Guided Continuous Tour)
  const handleOpenWizardForArea = (areaId?: string, forceTour: boolean = false) => {
    const isTourMode = forceTour || !areaId;
    setIsGuidedTour(isTourMode);

    setWizardSelectedCargoIds([]);
    setWizardCargoCounts({});
    setWizardSlotAssignments({});
    setSlotSearchQuery({});

    if (areaId) {
      handleSelectAreaInStep1(areaId);
    } else {
      setWizardAreaId('');
      setWizardStep(1);
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
      [key]: { personId: person.id, personName: person.nombre, personSource: 'ROSTER' }
    }));
    // Clear search query for this slot
    setSlotSearchQuery(prev => ({ ...prev, [key]: '' }));
  };

  // Assign a typed name without silently adding it to the official personnel roster.
  const handleAssignTypedPersonToSlot = (cargoId: string, slotIdx: number, rawName: string) => {
    const personName = normalizePersonName(rawName);
    if (personName.length < 2) return;

    const comparableName = getComparablePersonName(personName);
    const rosterMatch = personnel.find(person => getComparablePersonName(person.nombre) === comparableName);
    if (rosterMatch) {
      if (!assignedPersonIdsSet.has(rosterMatch.id)) {
        handleAssignPersonToSlot(cargoId, slotIdx, rosterMatch);
      }
      return;
    }

    const personId = getManualPersonId(personName);
    if (assignedPersonIdsSet.has(personId)) return;

    const key = `${cargoId}_${slotIdx}`;
    setWizardSlotAssignments(prev => ({
      ...prev,
      [key]: { personId, personName, personSource: 'MANUAL_ENTRY' }
    }));
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
        const assignmentGroup = activeGrupoFilter === 'ALL' ? 'A' : activeGrupoFilter;
        const assignmentShift = activeShiftFilter === 'ALL' ? 't_dia' : activeShiftFilter;

        newAreaAssignments.push({
          // Stable IDs make retries idempotent and prevent duplicate staffing
          // slots when two devices save the same operational position.
          id: `asg_${todayStr}_${wizardAreaId}_${assignmentShift}_${assignmentGroup}_${cargoId}_${i}`,
          areaId: wizardAreaId,
          cargoId,
          cargoName: cargoObj ? cargoObj.nombre : 'Cargo',
          slotIndex: i,
          fecha: todayStr,
          grupo: assignmentGroup,
          shiftId: assignmentShift,
          personId: slotData.personId,
          personName: slotData.personName,
          ...(slotData.personId ? {
            personSource: slotData.personSource || (slotData.personId.startsWith('manual_') ? 'MANUAL_ENTRY' : 'ROSTER')
          } : {}),
          userEmail
        });
      }
    });

    const updatedAssignments = [...otherAssignments, ...newAreaAssignments];
    onSaveAssignments(updatedAssignments);

    if (isGuidedTour) {
      const remaining = effectiveAreas.filter(a => !updatedAssignments.some(asg => asg.areaId === a.id));
      if (remaining.length > 0) {
        setWizardStep(5);
      } else {
        setWizardStep(6);
      }
    } else {
      setShowWizardModal(false);
    }
  };

  const handleClearDailyCoverage = () => {
    if (confirm('🧹 ¿Estás seguro de que deseas limpiar todas las asignaciones del día para iniciar el turno desde cero?')) {
      onSaveAssignments([]);
      alert('✨ Cobertura del día limpiada exitosamente. Las tarjetas han quedado listas para reportar desde cero con el Wizard.');
    }
  };

  return (
    <>
      <section className="personnel-print-report" aria-label="Reporte imprimible de dotación">
        <header className="personnel-print-header">
          <img src={OFFICIAL_PROCLEAN_LOGO_URL} alt="ProCleanMG" />
          <div className="personnel-print-title">
            <h1>PROCONTROL ZALDÍVAR</h1>
            <p>FICHA EJECUTIVA DE COBERTURA OPERACIONAL</p>
          </div>
          <div className="personnel-print-contract">
            <strong>MINERA ZALDÍVAR</strong>
            <span>Fecha: {formattedReportDate}</span>
          </div>
        </header>

        <div className="personnel-print-summary">
          <div><span>RÉGIMEN</span><strong>{printShiftLabel}</strong></div>
          <div><span>MALLA</span><strong>{printGroupLabel}</strong></div>
          <div><span>DOTACIÓN</span><strong>{printMetrics.covered}/{printMetrics.required} HH ({printMetrics.pct}%)</strong></div>
          <div><span>PLANTA</span><strong>{printMetrics.planta}</strong></div>
          <div><span>SPOT</span><strong>{printMetrics.spot}</strong></div>
          <div className={printMetrics.gap > 0 ? 'has-gap' : ''}><span>BRECHA</span><strong>{printMetrics.gap}</strong></div>
        </div>

        {printAreas.length > 0 ? (
          <div className="personnel-print-area-grid">
            {printAreas.map(area => {
              const areaAssignments = printAssignments.filter(assignment => assignment.areaId === area.id);
              const areaCovered = areaAssignments.filter(assignment => assignment.personId).length;
              const areaGap = areaAssignments.length - areaCovered;
              return (
                <article className="personnel-print-area" key={area.id}>
                  <div className="personnel-print-area-header">
                    <h2>{area.name}</h2>
                    <strong className={areaGap > 0 ? 'has-gap' : ''}>
                      {areaGap > 0 ? `BRECHA ${areaCovered}/${areaAssignments.length}` : `${areaCovered}/${areaAssignments.length}`}
                    </strong>
                  </div>
                  <div className="personnel-print-rows">
                    {areaAssignments.map(assignment => {
                      const rosterPerson = personnel.find(person => person.id === assignment.personId);
                      return (
                        <div className={`personnel-print-row ${assignment.personId ? '' : 'is-vacant'}`} key={assignment.id}>
                          <span className="personnel-print-role">{assignment.cargoName}</span>
                          <span className="personnel-print-name">
                            {assignment.personName || '[VACANTE]'}
                            {rosterPerson?.tipo ? <small>[{rosterPerson.tipo}]</small> : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="personnel-print-empty">
            No existe dotación declarada para los filtros seleccionados.
          </div>
        )}

        <footer className="personnel-print-footer">
          <span>Generado por: <strong>{userName || userEmail}</strong></span>
          <span>{formattedPrintTime} hrs · Fuente: Firebase Cloud</span>
        </footer>
      </section>

      <div className="personnel-screen-view" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      
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

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              onClick={handleClearDailyCoverage}
              className="btn btn-secondary" 
              style={{ fontSize: '13px', padding: '10px 16px', backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', fontWeight: 800, borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
              title="Limpiar todas las asignaciones del día para comenzar el turno desde cero"
            >
              <Trash2 size={16} /> Limpiar Cobertura del Día
            </button>
            <button 
              onClick={handlePrintCoverageReport}
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
              <Plus size={16} /> Reportar Cobertura de Área
            </button>
          </div>
        </div>

        {/* KPI METRICS CARDS GRID */}
        <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '14px' }}>
          
          {/* Card 1: Cobertura Global */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cobertura Global Planta
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: metrics.totalRequired === 0 ? 'var(--slate-400)' : metrics.pct >= 90 ? '#15803D' : '#C2410C', marginTop: '4px' }}>
              {metrics.totalRequired === 0 ? '0%' : `${metrics.pct}%`}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-600)', marginTop: '2px' }}>
              {metrics.totalRequired === 0 ? 'Sin dotación declarada hoy' : `${metrics.totalCovered} / ${metrics.totalRequired} Personas Asignadas`}
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: '#E2E8F0', borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ width: `${metrics.pct}%`, height: '100%', backgroundColor: metrics.pct >= 90 ? '#22C55E' : '#F97316', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Card 2: Vacantes Pendientes */}
          <div style={{ backgroundColor: metrics.totalRequired === 0 ? '#FFFBEB' : metrics.gap > 0 ? '#FEF2F2' : '#F0FDF4', padding: '16px', borderRadius: '16px', border: `1px solid ${metrics.totalRequired === 0 ? '#FDE68A' : metrics.gap > 0 ? '#FCA5A5' : '#86EFAC'}` }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: metrics.totalRequired === 0 ? '#B45309' : metrics.gap > 0 ? '#991B1B' : '#166534', textTransform: 'uppercase' }}>
              Vacantes / Brechas
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: metrics.totalRequired === 0 ? '#D97706' : metrics.gap > 0 ? '#DC2626' : '#16A34A', marginTop: '4px' }}>
              {metrics.totalRequired === 0 ? 'Sin Reportar' : metrics.gap > 0 ? `${metrics.gap} Cupos` : '0 Brechas'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: metrics.totalRequired === 0 ? '#B45309' : metrics.gap > 0 ? '#B91C1C' : '#15803D', marginTop: '2px' }}>
              {metrics.totalRequired === 0 ? 'Toca "+ Reportar Cobertura" para iniciar' : metrics.gap > 0 ? 'Dotación pendiente por asignar' : '100% Dotación Cubierta'}
            </div>
          </div>

          {/* Card 3: Desglose por Cargos */}
          <div className="coverage-breakdown-card" style={{ backgroundColor: '#F8FAFC', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0', gridColumn: 'span 2' }}>
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
            🅰️ Turno A ({personnel.filter(person => person.grupo === 'A' || person.grupo === 'AMBOS').length} Colaboradores)
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
            🅱️ Turno B ({personnel.filter(person => person.grupo === 'B' || person.grupo === 'AMBOS').length} Colaboradores)
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
      {(() => {
        const declaredAreas = filteredAreas.filter(area => assignments.some(a => a.areaId === area.id));

        if (declaredAreas.length === 0) {
          return (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '24px', border: '2px dashed #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '20px', backgroundColor: '#FFEDD5', color: 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
                🧹
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)', margin: '0 0 6px 0' }}>
                  Hoja de Dotación del Día Limpia
                </h3>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--slate-600)', margin: 0, maxWidth: '520px', lineHeight: '1.5' }}>
                  No se ha declarado dotación para ninguna ubicación hoy. Presiona el botón a continuación para iniciar el asistente guiado que te llevará paso a paso por cada una de las áreas configuradas.
                </p>
              </div>
              <button
                onClick={() => handleOpenWizardForArea()}
                className="btn btn-primary"
                style={{
                  padding: '16px 32px',
                  fontSize: '15px',
                  fontWeight: 900,
                  backgroundColor: 'var(--orange)',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px rgba(255,122,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                <Plus size={20} /> 🚀 INICIAR RECORRIDO GUIADO DE PLANTA
              </button>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <div className="responsive-card-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '16px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
              {declaredAreas.map(area => {
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
                      gap: '14px',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      overflowX: 'hidden'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
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
                            color: isComplete ? '#15803D' : '#B45309',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {reqCount === 0 ? 'Sin Dotación Configurada' : isComplete ? '✅ 100% Cubierto' : `🚨 ${reqCount - coveredCount} Vacantes`}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--slate-900)', margin: '0 0 12px 0' }}>
                        {area.name}
                      </h3>

                      {/* Slots Breakdown inside Card (Child-Proof Ultra Simple) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                        {areaAssignments.map(asg => (
                          <div 
                            key={asg.id}
                            style={{ 
                              padding: '8px 10px', 
                              backgroundColor: asg.personId ? '#F0FDF4' : '#FEF2F2',
                              borderRadius: '12px',
                              border: `1.5px solid ${asg.personId ? '#86EFAC' : '#FCA5A5'}`,
                              width: '100%',
                              maxWidth: '100%',
                              boxSizing: 'border-box',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>
                              <span style={{ fontSize: '14px', flexShrink: 0 }}>{asg.personId ? '👤' : '🚨'}</span>
                              <span 
                                title={`${asg.cargoName}: ${asg.personName || 'Vacante'}`}
                                style={{ 
                                  fontSize: '12px', 
                                  fontWeight: 900, 
                                  color: asg.personId ? '#166534' : '#991B1B',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {asg.cargoName}{asg.personName ? `: ${asg.personName}` : ''}
                              </span>
                            </div>
                            <span 
                              style={{ 
                                fontSize: '10px', 
                                fontWeight: 900, 
                                color: asg.personId ? '#15803D' : '#DC2626',
                                backgroundColor: asg.personId ? '#DCFCE7' : '#FEE2E2',
                                padding: '2px 6px',
                                borderRadius: '6px',
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              {asg.personId ? '✓ Cubierto' : 'Vacante'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => handleOpenWizardForArea(area.id)}
                      className="btn btn-secondary" 
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        fontSize: '12px', 
                        fontWeight: 900, 
                        color: 'var(--orange)', 
                        border: '1.5px solid #FFEDD5', 
                        backgroundColor: '#FFF7ED',
                        borderRadius: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ EDITAR / RE-REPORTAR ÁREA
                    </button>
                  </div>
                );
              })}
            </div>

            {declaredAreas.length < filteredAreas.length && (
              <div style={{ backgroundColor: '#FFF7ED', border: '1.5px solid #FFEDD5', borderRadius: '16px', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#C2410C' }}>
                  📋 Quedan {filteredAreas.length - declaredAreas.length} de {filteredAreas.length} áreas operacionales pendientes por declarar hoy.
                </span>
                <button
                  onClick={() => handleOpenWizardForArea()}
                  style={{ border: 'none', backgroundColor: 'var(--orange)', color: '#FFF', padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: 900, cursor: 'pointer' }}
                >
                  ➡️ Continuar Recorrido Guiado ➔
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* 4. "A PRUEBA DE NIÑOS" 4-STEP WIZARD MODAL (TOP-LEVEL FIXED OVERLAY) */}
      {showWizardModal && (
        <div
          className="modal-backdrop-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
            boxSizing: 'border-box'
          }}
          onClick={() => setShowWizardModal(false)}
        >
          <div
            className="card modal-content-card"
            style={{ 
              maxWidth: '640px', 
              width: '100%', 
              maxHeight: '92vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '20px', 
              borderRadius: '20px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.45)',
              border: '1px solid #E2E8F0',
              boxSizing: 'border-box'
            }}
            onClick={e => e.stopPropagation()}
          >
            
            {/* WIZARD GAMIFIED STEP HEADER */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', borderBottom: '2px solid #E2E8F0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: 'linear-gradient(135deg, var(--orange), #EA580C)', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(255,122,0,0.35)', flexShrink: 0 }}>
                    {wizardStep === 1 && <Building2 size={22} />}
                    {wizardStep === 2 && <Users size={22} />}
                    {wizardStep === 3 && <Plus size={22} />}
                    {wizardStep === 4 && <CheckCircle size={22} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '17px', fontWeight: 900, color: 'var(--slate-900)', margin: 0, letterSpacing: '-0.02em' }}>
                      {wizardStep === 1 && '🏭 Paso 1: Escoge el Área de Trabajo'}
                      {wizardStep === 2 && '💼 Paso 2: Escoge los Cargos del Área'}
                      {wizardStep === 3 && '🔢 Paso 3: Ajusta las Cantidades con + y -'}
                      {wizardStep === 4 && '✍️ Paso 4: Selecciona a las Personas'}
                    </h3>
                  </div>
                </div>
                <button onClick={() => setShowWizardModal(false)} style={{ width: '34px', height: '34px', borderRadius: '50%', border: '2px solid #CBD5E1', backgroundColor: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={18} />
                </button>
              </div>

              {/* GAMIFIED PROGRESS TRACKER */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {[
                  { step: 1, label: '1. Área' },
                  { step: 2, label: '2. Cargos' },
                  { step: 3, label: '3. Cantidad' },
                  { step: 4, label: '4. Personas' }
                ].map(s => {
                  const isActive = wizardStep === s.step;
                  const isDone = wizardStep > s.step;
                  return (
                    <div 
                      key={s.step}
                      style={{
                        padding: '6px 4px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontWeight: 900,
                        backgroundColor: isActive ? 'var(--orange)' : isDone ? '#DCFCE7' : '#F1F5F9',
                        color: isActive ? '#FFFFFF' : isDone ? '#15803D' : '#64748B',
                        border: `2px solid ${isActive ? '#EA580C' : isDone ? '#86EFAC' : '#E2E8F0'}`,
                        boxShadow: isActive ? '0 2px 8px rgba(255,122,0,0.3)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isDone ? '✓ ' : ''}{s.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 1: SELECT AREA */}
            {wizardStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '100%', boxSizing: 'border-box' }}>
                <div style={{ backgroundColor: '#EFF6FF', border: '2px solid #BFDBFE', borderRadius: '14px', padding: '12px 16px', fontSize: '13px', color: '#1E40AF', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>👇</span>
                  <span><strong>¡Toca la casilla gigante!</strong> Selecciona el área de la planta que vas a reportar hoy:</span>
                </div>

                <div className="responsive-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '12px' }}>
                  {effectiveAreas.map(area => {
                    const areaAsgs = assignments.filter(a => a.areaId === area.id);
                    const isReported = areaAsgs.length > 0;
                    const coveredCount = areaAsgs.filter(a => a.personId).length;

                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => handleSelectAreaInStep1(area.id)}
                        style={{
                          padding: '16px 12px',
                          borderRadius: '18px',
                          border: `3px solid ${isReported ? '#86EFAC' : '#E2E8F0'}`,
                          backgroundColor: isReported ? '#F0FDF4' : '#FFFFFF',
                          cursor: 'pointer',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ width: '44px', height: '44px', borderRadius: '14px', backgroundColor: isReported ? '#DCFCE7' : '#FFEDD5', color: isReported ? '#15803D' : 'var(--orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Building2 size={24} />
                        </div>
                        <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--slate-900)' }}>{area.name}</span>
                        <span style={{ fontSize: '10px', fontWeight: 900, color: isReported ? '#15803D' : '#C2410C', backgroundColor: isReported ? '#DCFCE7' : '#FFF7ED', padding: '3px 8px', borderRadius: '10px' }}>
                          {isReported ? `✅ Cubierto (${coveredCount}/${areaAsgs.length})` : '🚨 Pendiente por Reportar'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: SELECT CARGOS */}
            {wizardStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: '#F0F9FF', border: '2px solid #BAE6FD', borderRadius: '14px', padding: '12px 16px', fontSize: '13px', color: '#0369A1', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>💡</span>
                  <span><strong>¡Toca para activar o desactivar!</strong> Los verdes <strong>(✅)</strong> operan hoy. Los grises <strong>(+)</strong> no.</span>
                </div>

                <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--slate-700)', margin: 0 }}>
                  Cargos autorizados para <strong style={{ color: 'var(--orange)', fontSize: '15px' }}>{effectiveAreas.find(a => a.id === wizardAreaId)?.name}</strong>:
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', maxHeight: '300px', overflowY: 'auto', padding: '4px' }}>
                  {availableCargosForSelectedArea.map(cargo => {
                    const isSelected = wizardSelectedCargoIds.includes(cargo.id);
                    return (
                      <button
                        key={cargo.id}
                        onClick={() => handleToggleCargo(cargo.id)}
                        style={{
                          padding: '12px 20px',
                          borderRadius: '24px',
                          border: `3px solid ${isSelected ? '#10B981' : '#CBD5E1'}`,
                          background: isSelected ? 'linear-gradient(135deg, #10B981, #059669)' : '#F1F5F9',
                          color: isSelected ? '#FFFFFF' : '#334155',
                          fontSize: '14px',
                          fontWeight: 900,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: isSelected ? '0 4px 14px rgba(16,185,129,0.35)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{isSelected ? '✅' : '➕'}</span>
                        <span>{cargo.nombre}</span>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #E2E8F0', gap: '10px' }}>
                  <button onClick={() => setWizardStep(1)} style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 900, padding: '14px 22px', borderRadius: '16px', border: '2px solid #CBD5E1', cursor: 'pointer', fontSize: '14px' }}>
                    ◄ Volver al Área
                  </button>
                  <button 
                    disabled={wizardSelectedCargoIds.length === 0}
                    onClick={() => setWizardStep(3)}
                    style={{ 
                      background: wizardSelectedCargoIds.length > 0 ? 'linear-gradient(135deg, var(--orange), #EA580C)' : '#CBD5E1', 
                      color: '#FFF', 
                      fontWeight: 900, 
                      padding: '14px 28px', 
                      borderRadius: '16px', 
                      border: 'none', 
                      cursor: wizardSelectedCargoIds.length > 0 ? 'pointer' : 'not-allowed', 
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: wizardSelectedCargoIds.length > 0 ? '0 6px 18px rgba(255,122,0,0.4)' : 'none'
                    }}
                  >
                    Definir Cantidades ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: DEFINE CARGO HEADCOUNT */}
            {wizardStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: '#FFF7ED', border: '2px solid #FFEDD5', borderRadius: '14px', padding: '12px 16px', fontSize: '13px', color: '#C2410C', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>🔢</span>
                  <span><strong>¡Usa los botones gigantes + y -!</strong> Sube o baja la cantidad de personas por cargo:</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }}>
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
                          padding: '14px 18px',
                          backgroundColor: '#F8FAFC',
                          borderRadius: '18px',
                          border: '2px solid #E2E8F0',
                          gap: '10px'
                        }}
                      >
                        <span style={{ fontSize: '15px', fontWeight: 900, color: 'var(--slate-900)', flex: 1, wordBreak: 'break-word' }}>
                          💼 {cargoObj?.nombre}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            onClick={() => handleAdjustCargoCount(cargoId, -1)}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '14px',
                              border: 'none',
                              backgroundColor: '#EF4444',
                              color: '#FFF',
                              fontWeight: 900,
                              fontSize: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 10px rgba(239,68,68,0.35)'
                            }}
                          >
                            -
                          </button>

                          <div style={{ width: '48px', height: '46px', borderRadius: '14px', backgroundColor: '#FFFFFF', border: '2px solid #CBD5E1', color: '#0F172A', fontSize: '20px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {count}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAdjustCargoCount(cargoId, 1)}
                            style={{
                              width: '46px',
                              height: '46px',
                              borderRadius: '14px',
                              border: 'none',
                              backgroundColor: '#22C55E',
                              color: '#FFF',
                              fontWeight: 900,
                              fontSize: '24px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 4px 10px rgba(34,197,94,0.35)'
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #E2E8F0', gap: '10px' }}>
                  <button onClick={() => setWizardStep(2)} style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 900, padding: '14px 22px', borderRadius: '16px', border: '2px solid #CBD5E1', cursor: 'pointer', fontSize: '14px' }}>
                    ◄ Volver a Cargos
                  </button>
                  <button 
                    onClick={() => setWizardStep(4)}
                    style={{ 
                      background: 'linear-gradient(135deg, var(--orange), #EA580C)', 
                      color: '#FFF', 
                      fontWeight: 900, 
                      padding: '14px 28px', 
                      borderRadius: '16px', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 6px 18px rgba(255,122,0,0.4)'
                    }}
                  >
                    Asignar Nombres ➔
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: ASSIGN PERSON NAMES */}
            {wizardStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ backgroundColor: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: '14px', padding: '12px 16px', fontSize: '13px', color: '#166534', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>✍️</span>
                  <span><strong>¡Busca o toca el nombre del colaborador!</strong> Asigna quién cubrirá cada vacante hoy:</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '360px', overflowY: 'auto' }}>
                  {wizardSelectedCargoIds.map(cargoId => {
                    const cargoObj = effectiveCargos.find(c => c.id === cargoId);
                    const count = wizardCargoCounts[cargoId] || 1;

                    return Array.from({ length: count }).map((_, slotIdx) => {
                      const slotKey = `${cargoId}_${slotIdx}`;
                      const currentAssigned = wizardSlotAssignments[slotKey];
                      const query = slotSearchQuery[slotKey] || '';
                      const normalizedQuery = normalizePersonName(query);
                      const comparableQuery = getComparablePersonName(normalizedQuery);

                      const matchingPeople = groupPersonnel.filter(p => {
                        if (assignedPersonIdsSet.has(p.id) && currentAssigned?.personId !== p.id) return false;
                        if (!query) return true;
                        return p.nombre.toLowerCase().includes(query.toLowerCase());
                      });
                      const exactRosterMatch = normalizedQuery.length >= 2
                        ? personnel.find(p => getComparablePersonName(p.nombre) === comparableQuery)
                        : undefined;
                      const typedPersonId = normalizedQuery.length >= 2 ? getManualPersonId(normalizedQuery) : '';
                      const typedNameAlreadyAssigned = Boolean(typedPersonId && assignedPersonIdsSet.has(typedPersonId));
                      const rosterMatchAlreadyAssigned = Boolean(exactRosterMatch && assignedPersonIdsSet.has(exactRosterMatch.id));
                      const rosterMatchAvailableInGroup = Boolean(exactRosterMatch && matchingPeople.some(p => p.id === exactRosterMatch.id));
                      const canAssignTypedName = normalizedQuery.length >= 2 && !exactRosterMatch && !typedNameAlreadyAssigned;

                      return (
                        <div 
                          key={slotKey}
                          style={{
                            padding: '14px 16px',
                            backgroundColor: currentAssigned?.personId ? '#F0FDF4' : '#FFF7ED',
                            borderRadius: '18px',
                            border: `2px solid ${currentAssigned?.personId ? '#86EFAC' : '#FFEDD5'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: 'var(--slate-900)' }}>
                              📍 {cargoObj?.nombre} <span style={{ color: '#C2410C', fontSize: '12px' }}>(Cupo {slotIdx + 1} de {count})</span>
                            </span>
                            {currentAssigned?.personId ? (
                              <button 
                                onClick={() => handleRemovePersonFromSlot(cargoId, slotIdx)}
                                style={{ border: 'none', backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: '12px', fontWeight: 900, padding: '4px 10px', borderRadius: '10px', cursor: 'pointer' }}
                              >
                                ✖ Cambiar
                              </button>
                            ) : (
                              <span style={{ fontSize: '11px', fontWeight: 900, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '2px 8px', borderRadius: '10px' }}>
                                🚨 Vacante Pendiente
                              </span>
                            )}
                          </div>

                          {currentAssigned?.personId ? (
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#166534', backgroundColor: '#DCFCE7', padding: '10px 14px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '18px' }}>✅</span>
                              <span>{currentAssigned.personName}</span>
                              {currentAssigned.personSource === 'MANUAL_ENTRY' && (
                                <span style={{ marginLeft: 'auto', color: '#9A3412', backgroundColor: '#FFEDD5', padding: '3px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 900 }}>
                                  NOMBRE INGRESADO
                                </span>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder={`🔍 Escribe o busca a la persona...`}
                                value={query}
                                onChange={e => {
                                  const val = e.target.value;
                                  setSlotSearchQuery(prev => ({ ...prev, [slotKey]: val }));
                                }}
                                onKeyDown={event => {
                                  if (event.key !== 'Enter') return;
                                  event.preventDefault();
                                  if (canAssignTypedName || (rosterMatchAvailableInGroup && !rosterMatchAlreadyAssigned)) {
                                    handleAssignTypedPersonToSlot(cargoId, slotIdx, normalizedQuery);
                                  }
                                }}
                                style={{ width: '100%', padding: '12px 14px', borderRadius: '14px', border: '2px solid #CBD5E1', fontSize: '13px', fontWeight: 900, color: '#0F172A', backgroundColor: '#FFF', outline: 'none', boxSizing: 'border-box' }}
                              />

                              {/* TAP-SUGGESTION CHIPS */}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                                {matchingPeople.slice(0, 6).map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleAssignPersonToSlot(cargoId, slotIdx, p)}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: '12px',
                                      border: '1.5px solid #86EFAC',
                                      backgroundColor: '#F0FDF4',
                                      color: '#15803D',
                                      fontSize: '12px',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    👤 {p.nombre}
                                  </button>
                                ))}
                              </div>

                              {canAssignTypedName && (
                                <button
                                  type="button"
                                  onClick={() => handleAssignTypedPersonToSlot(cargoId, slotIdx, normalizedQuery)}
                                  style={{ width: '100%', padding: '10px 12px', borderRadius: '12px', border: '1.5px dashed #F97316', backgroundColor: '#FFF7ED', color: '#C2410C', fontSize: '12px', fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}
                                >
                                  ➕ Usar “{normalizedQuery}” como nombre ingresado
                                </button>
                              )}

                              {(typedNameAlreadyAssigned || rosterMatchAlreadyAssigned) && normalizedQuery.length >= 2 && (
                                <div style={{ color: '#B45309', backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '8px 10px', fontSize: '11px', fontWeight: 800 }}>
                                  Esta persona ya está asignada en otro cargo.
                                </div>
                              )}

                              {exactRosterMatch && !rosterMatchAlreadyAssigned && !rosterMatchAvailableInGroup && (
                                <div style={{ color: '#475569', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '8px 10px', fontSize: '11px', fontWeight: 800 }}>
                                  El nombre ya existe en la nómina de otro grupo. Selecciona el grupo correspondiente para asignarlo.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '2px solid #E2E8F0', gap: '10px' }}>
                  <button onClick={() => setWizardStep(3)} style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 900, padding: '14px 22px', borderRadius: '16px', border: '2px solid #CBD5E1', cursor: 'pointer', fontSize: '14px' }}>
                    ◄ Volver a Cantidades
                  </button>
                  <button 
                    onClick={handleSaveWizardAreaCoverage}
                    style={{ 
                      background: 'linear-gradient(135deg, #22C55E, #15803D)', 
                      color: '#FFF', 
                      fontWeight: 900, 
                      padding: '14px 28px', 
                      borderRadius: '16px', 
                      border: 'none', 
                      cursor: 'pointer', 
                      fontSize: '14px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      boxShadow: '0 6px 20px rgba(34,197,94,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    🎉 ¡FINALIZAR Y GUARDAR REPORTE!
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: GUIDED TOUR CONTINUOUS TRANSITION */}
            {wizardStep === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: '52px', margin: '0 0 -10px 0' }}>🎉</div>
                
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)', margin: '0 0 6px 0' }}>
                    ¡{effectiveAreas.find(a => a.id === wizardAreaId)?.name} Guardada Exitosamente!
                  </h3>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#059669', backgroundColor: '#DCFCE7', padding: '6px 14px', borderRadius: '20px', display: 'inline-block', margin: 0 }}>
                    📊 Avance Planta: {effectiveAreas.length - effectiveAreas.filter(a => !assignments.some(asg => asg.areaId === a.id)).length} de {effectiveAreas.length} Áreas Completadas
                  </p>
                </div>

                {(() => {
                  const remainingAreas = effectiveAreas.filter(a => a.id !== wizardAreaId && !assignments.some(asg => asg.areaId === a.id));
                  const nextArea = remainingAreas[0];
                  if (!nextArea) return null;

                  return (
                    <div style={{ backgroundColor: '#FFF7ED', border: '2px solid #FFEDD5', borderRadius: '20px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 900, color: '#C2410C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        👉 Siguiente Ubicación Pendiente por Reportar
                      </span>
                      <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--slate-900)' }}>
                        📍 {nextArea.name} ({nextArea.code})
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectAreaInStep1(nextArea.id)}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, var(--orange), #EA580C)',
                          color: '#FFF',
                          fontWeight: 900,
                          padding: '16px 24px',
                          borderRadius: '16px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '15px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          boxShadow: '0 6px 20px rgba(255,122,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                      >
                        ➡️ CONTINUAR CON {nextArea.name.toUpperCase()} ➔
                      </button>
                    </div>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <button 
                    type="button"
                    onClick={() => setWizardStep(1)} 
                    style={{ backgroundColor: '#F1F5F9', color: '#475569', fontWeight: 900, padding: '12px 20px', borderRadius: '14px', border: '2px solid #CBD5E1', cursor: 'pointer', fontSize: '13px' }}
                  >
                    📋 Elegir otra área de la lista
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowWizardModal(false)} 
                    style={{ backgroundColor: '#FFF', color: '#64748B', fontWeight: 800, padding: '12px 20px', borderRadius: '14px', border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '13px' }}
                  >
                    ✖ Salir al Panel
                  </button>
                </div>
              </div>
            )}

            {/* STEP 6: MASTER TOUR COMPLETION SCREEN */}
            {wizardStep === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '20px 10px' }}>
                <div style={{ fontSize: '64px', margin: '0 0 -10px 0' }}>🎊</div>
                
                <div>
                  <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--slate-900)', margin: '0 0 8px 0' }}>
                    ¡FELICITACIONES! REPORTABILIDAD COMPLETA DE PLANTA
                  </h2>
                  <p style={{ fontSize: '14px', fontWeight: 900, color: '#15803D', backgroundColor: '#DCFCE7', padding: '8px 18px', borderRadius: '20px', display: 'inline-block', margin: 0 }}>
                    🏆 100% de las Ubicaciones Declaradas para el Turno de Hoy
                  </p>
                </div>

                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--slate-600)', margin: 0 }}>
                  Has completado de forma guiada el reporte de dotación para todas las áreas operacionales de la planta.
                </p>

                <button
                  type="button"
                  onClick={() => setShowWizardModal(false)}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #22C55E, #15803D)',
                    color: '#FFF',
                    fontWeight: 900,
                    padding: '16px 28px',
                    borderRadius: '18px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    boxShadow: '0 8px 24px rgba(34,197,94,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px'
                  }}
                >
                  🏆 VER REPORTE COMPLETO EN PANTALLA
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      </div>
    </>
  );
};
