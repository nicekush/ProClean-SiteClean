import React, { useMemo, useState } from 'react';
import type { PlantEquipment, Sector, WhiteLabelConfig, WorkOrder } from '../types';
import {
  AlertTriangle, BarChart3, CalendarDays, Clock3, FileSpreadsheet, Filter,
  Layers3, Printer, RotateCcw, ShieldCheck, TrendingUp, Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { KpiPdfReport } from './KpiPdfReport';

interface Props {
  workOrders: WorkOrder[];
  sectors?: Sector[];
  equipments?: PlantEquipment[];
  whiteLabel?: WhiteLabelConfig;
  generatedBy?: string;
  contractLabel?: string;
}
type Preset = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'LAST_14' | 'LAST_30' | 'THIS_MONTH' | 'ALL' | 'CUSTOM';
type Grain = 'DAY' | 'WEEK' | 'MONTH';
type Mode = 'ALL' | 'MANUAL' | 'MACHINERY' | 'MIXED';

const DAY_MS = 86_400_000;
const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseDate = (v?: string) => v ? new Date(`${v}T12:00:00`) : undefined;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);
const number = (v: number, decimals = 1) => new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
const integer = (v: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(v);
const prettyDate = (v?: string) => {
  const d = parseDate(v);
  return d ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(d) : 'Sin fecha';
};
const rangeFor = (preset: Preset, start: string, end: string, today: Date) => {
  const todayKey = dateKey(today);
  if (preset === 'TODAY') return { start: todayKey, end: todayKey };
  if (preset === 'YESTERDAY') { const key = dateKey(addDays(today, -1)); return { start: key, end: key }; }
  if (preset === 'LAST_7') return { start: dateKey(addDays(today, -6)), end: todayKey };
  if (preset === 'LAST_14') return { start: dateKey(addDays(today, -13)), end: todayKey };
  if (preset === 'LAST_30') return { start: dateKey(addDays(today, -29)), end: todayKey };
  if (preset === 'THIS_MONTH') return { start: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end: todayKey };
  if (preset === 'CUSTOM') return { start: start || undefined, end: end || undefined };
  return {} as { start?: string; end?: string };
};
const weekStart = (d: Date) => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() === 0 ? 6 : x.getDay() - 1)); return x; };
const periodKey = (v: string, grain: Grain) => {
  const d = parseDate(v); if (!d) return 'SIN_FECHA';
  return grain === 'MONTH' ? v.slice(0, 7) : grain === 'WEEK' ? dateKey(weekStart(d)) : v;
};
const periodLabel = (key: string, grain: Grain) => {
  if (grain === 'MONTH') return new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' }).format(parseDate(`${key}-01`));
  const label = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short' }).format(parseDate(key));
  return grain === 'WEEK' ? `Sem. ${label}` : label;
};
const modeOf = (o: WorkOrder): Exclude<Mode, 'ALL'> => {
  const manual = o.hasManualLabor ?? ((o.headcount || 0) > 0 && (o.realHours || 0) > 0);
  const machinery = o.hasEquipment ?? Boolean(o.vehiclePatent || (o.fleetTripsCount || 0) > 0 || (o.machineHours || 0) > 0);
  return manual && machinery ? 'MIXED' : machinery ? 'MACHINERY' : 'MANUAL';
};
const hhOf = (o: WorkOrder) => Math.max(0, Number(o.headcount) || 0) * Math.max(0, Number(o.realHours) || 0);
const hmOf = (o: WorkOrder) => Math.max(0, Number(o.machineHours) || 0);
const volumeOf = (o: WorkOrder) => Math.max(0, Number(o.cubicMetersRemoved) || 0);
const approved = (o: WorkOrder) => o.status === 'APROBADO_MANDANTE' || o.status === 'COMPLETADO';
const evidence = (o: WorkOrder) => Boolean(o.imageBeforeUrl || o.beforePhotoUrl) && Boolean(o.imageAfterUrl || o.afterPhotoUrl);
const makeBreakdown = (orders: WorkOrder[], pick: (o: WorkOrder) => string) => {
  const map = new Map<string, number>();
  orders.forEach(o => { const key = pick(o); map.set(key, (map.get(key) || 0) + 1); });
  return [...map].sort((a, b) => b[1] - a[1]);
};

const statusNames: Record<string, string> = {
  PROGRAMADO: 'Programado', EN_EJECUCION: 'En ejecución', EN_PROCESO: 'En proceso',
  PENDIENTE_APROBACION_ITO: 'Pendiente aprobación ITO', APROBADO_MANDANTE: 'Aprobado mandante',
  RECHAZADO_CONTINGENCIA: 'Rechazado / contingencia', CONTINGENCIA: 'Contingencia', COMPLETADO: 'Completado',
};
const taskNames: Record<string, string> = { PLANIFICADO: 'Planificado', MANTENIMIENTO_PROGRAMADO: 'Mantención programada', EMERGENTE: 'Emergente' };
const modeNames: Record<Mode, string> = { ALL: 'Todos los recursos', MANUAL: 'Trabajo manual', MACHINERY: 'Maquinaria', MIXED: 'Mixto' };

export const AdherenceDashboard: React.FC<Props> = ({ workOrders, sectors = [], equipments = [], whiteLabel, generatedBy, contractLabel }) => {
  const now = useMemo(() => new Date(), []);
  const todayKey = dateKey(now);
  const [preset, setPreset] = useState<Preset>('LAST_7');
  const [customStart, setCustomStart] = useState(dateKey(addDays(now, -6)));
  const [customEnd, setCustomEnd] = useState(todayKey);
  const [grain, setGrain] = useState<Grain>('DAY');
  const [area, setArea] = useState('ALL');
  const [sector, setSector] = useState('ALL');
  const [shift, setShift] = useState('ALL');
  const [task, setTask] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [mode, setMode] = useState<Mode>('ALL');
  const [includeFuture, setIncludeFuture] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [printGeneratedAt, setPrintGeneratedAt] = useState(() => new Date());
  const range = useMemo(() => rangeFor(preset, customStart, customEnd, now), [preset, customStart, customEnd, now]);

  const options = useMemo(() => ({
    areas: [...new Set(workOrders.flatMap(o => o.areaName ? [o.areaName] : []))].sort(),
    sectors: [...new Set(workOrders.flatMap(o => o.sectorName ? [o.sectorName] : []))].sort(),
    shifts: [...new Set(workOrders.flatMap(o => o.shiftName ? [o.shiftName] : []))].sort(),
    tasks: [...new Set(workOrders.flatMap(o => o.taskType ? [o.taskType] : []))].sort(),
    statuses: [...new Set(workOrders.map(o => o.status))].sort(),
  }), [workOrders]);
  const futureOrders = useMemo(() => workOrders.filter(o => o.executionDate && o.executionDate > todayKey), [workOrders, todayKey]);
  const filtered = useMemo(() => workOrders.filter(o => {
    const d = o.executionDate;
    if (!d) return preset === 'ALL';
    return (includeFuture || d <= todayKey) && (!range.start || d >= range.start) && (!range.end || d <= range.end)
      && (area === 'ALL' || o.areaName === area) && (sector === 'ALL' || o.sectorName === sector)
      && (shift === 'ALL' || o.shiftName === shift) && (task === 'ALL' || o.taskType === task)
      && (status === 'ALL' || o.status === status) && (mode === 'ALL' || modeOf(o) === mode);
  }), [workOrders, preset, includeFuture, todayKey, range, area, sector, shift, task, status, mode]);

  const metrics = useMemo(() => {
    const volume = filtered.reduce((s, o) => s + volumeOf(o), 0);
    const hh = filtered.reduce((s, o) => s + hhOf(o), 0);
    const hm = filtered.reduce((s, o) => s + hmOf(o), 0);
    const days = new Set(filtered.flatMap(o => o.executionDate ? [o.executionDate] : [])).size;
    return {
      volume, hh, hm, days, volumeDay: days ? volume / days : 0, hhDay: days ? hh / days : 0, hmDay: days ? hm / days : 0,
      approved: filtered.filter(approved).length, evidence: filtered.filter(evidence).length,
    };
  }, [filtered]);
  const series = useMemo(() => {
    const map = new Map<string, { key: string; label: string; volume: number; hh: number; hm: number; orders: number }>();
    filtered.forEach(o => {
      if (!o.executionDate) return;
      const key = periodKey(o.executionDate, grain);
      const row = map.get(key) || { key, label: periodLabel(key, grain), volume: 0, hh: 0, hm: 0, orders: 0 };
      row.volume += volumeOf(o); row.hh += hhOf(o); row.hm += hmOf(o); row.orders += 1; map.set(key, row);
    });
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered, grain]);
  const areas = useMemo(() => {
    const map = new Map<string, { name: string; volume: number; hh: number; hm: number; orders: number }>();
    filtered.forEach(o => {
      const name = o.sectorName || o.areaName || 'Sin área informada';
      const row = map.get(name) || { name, volume: 0, hh: 0, hm: 0, orders: 0 };
      row.volume += volumeOf(o); row.hh += hhOf(o); row.hm += hmOf(o); row.orders += 1; map.set(name, row);
    });
    return [...map.values()].sort((a, b) => b.volume - a.volume || b.hh - a.hh);
  }, [filtered]);
  const statusRows = useMemo(() => makeBreakdown(filtered, o => o.status), [filtered]);
  const taskRows = useMemo(() => makeBreakdown(filtered, o => o.taskType || 'SIN_CLASIFICAR'), [filtered]);
  const maxV = Math.max(1, ...series.map(x => x.volume)); const maxHH = Math.max(1, ...series.map(x => x.hh)); const maxHM = Math.max(1, ...series.map(x => x.hm));
  const maxAreaV = Math.max(1, ...areas.map(x => x.volume)); const maxAreaHH = Math.max(1, ...areas.map(x => x.hh)); const maxAreaHM = Math.max(1, ...areas.map(x => x.hm));
  const periodDescription = preset === 'ALL' ? 'Histórico completo' : `${prettyDate(range.start)} — ${prettyDate(range.end)}`;
  const filterLabels = [
    `Área macro: ${area === 'ALL' ? 'Todas' : area}`,
    `Área operativa: ${sector === 'ALL' ? 'Todas' : sector}`,
    `Turno: ${shift === 'ALL' ? 'Todos' : shift}`,
    `Tipo: ${task === 'ALL' ? 'Todos' : taskNames[task] || task}`,
    `Estado: ${status === 'ALL' ? 'Todos' : statusNames[status] || status}`,
    `Modalidad: ${modeNames[mode]}`,
    `OT futuras: ${includeFuture ? 'Incluidas' : 'Excluidas'}`,
  ];

  const printReport = () => {
    setPrintGeneratedAt(new Date());
    const previousOverride = document.getElementById('kpi-print-page-override');
    previousOverride?.remove();
    const pageOverride = document.createElement('style');
    pageOverride.id = 'kpi-print-page-override';
    pageOverride.media = 'print';
    pageOverride.textContent = '@page { size: 297mm 210mm; margin: 8mm; }';
    document.head.appendChild(pageOverride);
    window.addEventListener('afterprint', () => pageOverride.remove(), { once: true });
    window.setTimeout(() => window.print(), 75);
  };

  const reset = () => {
    setPreset('LAST_7'); setCustomStart(dateKey(addDays(now, -6))); setCustomEnd(todayKey); setGrain('DAY');
    setArea('ALL'); setSector('ALL'); setShift('ALL'); setTask('ALL'); setStatus('ALL'); setMode('ALL'); setIncludeFuture(false);
  };
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ['Reporte', 'KPI Operacional ProCleanMG'], ['Generado', new Date().toLocaleString('es-CL')], ['Período', periodDescription],
      ['Área macro', area === 'ALL' ? 'Todas' : area], ['Área operativa', sector === 'ALL' ? 'Todas' : sector],
      ['Turno', shift === 'ALL' ? 'Todos' : shift], ['Tipo', task === 'ALL' ? 'Todos' : taskNames[task] || task],
      ['Estado', status === 'ALL' ? 'Todos' : statusNames[status] || status], ['Modalidad', modeNames[mode]], [],
      ['Indicador', 'Valor'], ['Volumen (m³)', metrics.volume], ['HH-persona', metrics.hh], ['Horas máquina (HM)', metrics.hm],
      ['Promedio m³/día activo', metrics.volumeDay], ['Promedio HH/día activo', metrics.hhDay], ['Promedio HM/día activo', metrics.hmDay],
      ['OT incluidas', filtered.length], ['Días activos', metrics.days], ['OT aprobadas/completadas', metrics.approved],
      ['OT con evidencia completa', metrics.evidence],
    ]), 'Resumen');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(series.map(x => ({ Período: x.label, 'Volumen (m³)': x.volume, 'HH-persona': x.hh, 'Horas máquina': x.hm, OT: x.orders }))), 'Serie temporal');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(areas.map(x => ({ 'Área operativa': x.name, 'Volumen (m³)': x.volume, 'HH-persona': x.hh, 'Horas máquina': x.hm, OT: x.orders }))), 'Por área');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtered.map(o => ({
      Fecha: o.executionDate || '', 'N° OT': o.sapCode, 'Área macro': o.areaName || '', 'Área operativa': o.sectorName || '',
      Ubicación: o.subSectorName || o.equipmentName || o.equipoCorrea || '', Turno: o.shiftName || '',
      Tipo: taskNames[o.taskType || ''] || o.taskType || '', Modalidad: modeNames[modeOf(o)], Estado: statusNames[o.status] || o.status,
      Personas: o.headcount || 0, 'Duración (h)': o.realHours || 0, 'HH-persona': hhOf(o), 'Horas máquina': hmOf(o), 'Volumen (m³)': volumeOf(o),
      'Evidencia completa': evidence(o) ? 'Sí' : 'No',
    }))), 'Detalle OT');
    XLSX.writeFile(wb, `Reporte_KPI_Operacional_${todayKey}.xlsx`);
  };

  return <section className="kpi-dashboard">
    <header className="kpi-dashboard__header">
      <div><span className="kpi-dashboard__eyebrow"><BarChart3 size={15} /> Analítica operacional</span><h2>Reporte KPI de Producción y Recursos</h2><p>Volumen, horas-hombre, actividad y control documental desde las órdenes de trabajo.</p></div>
      <div className="kpi-dashboard__actions kpi-no-print"><button className="btn btn-secondary" onClick={printReport}><Printer size={16} /> Informe PDF consolidado</button><button className="btn btn-secondary" onClick={exportExcel}><FileSpreadsheet size={16} /> Exportar Excel</button></div>
    </header>

    <section className="kpi-filter-panel kpi-no-print">
      <div className="kpi-filter-panel__primary">
        <label className="kpi-field"><span><CalendarDays size={14} /> Período</span><select value={preset} onChange={e => setPreset(e.target.value as Preset)}><option value="TODAY">Hoy</option><option value="YESTERDAY">Ayer</option><option value="LAST_7">Últimos 7 días</option><option value="LAST_14">Últimos 14 días</option><option value="LAST_30">Últimos 30 días</option><option value="THIS_MONTH">Mes actual</option><option value="ALL">Histórico completo</option><option value="CUSTOM">Rango personalizado</option></select></label>
        {preset === 'CUSTOM' && <><label className="kpi-field"><span>Desde</span><input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} /></label><label className="kpi-field"><span>Hasta</span><input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></label></>}
        <label className="kpi-field"><span>Agrupar serie</span><select value={grain} onChange={e => setGrain(e.target.value as Grain)}><option value="DAY">Por día</option><option value="WEEK">Por semana</option><option value="MONTH">Por mes</option></select></label>
        <label className="kpi-field"><span>Área macro</span><select value={area} onChange={e => setArea(e.target.value)}><option value="ALL">Todas las áreas</option>{options.areas.map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="kpi-field"><span>Área operativa</span><select value={sector} onChange={e => setSector(e.target.value)}><option value="ALL">Todas las áreas operativas</option>{options.sectors.map(x => <option key={x}>{x}</option>)}</select></label>
        <button className="kpi-filter-toggle" onClick={() => setAdvanced(x => !x)}><Filter size={15} /> {advanced ? 'Ocultar filtros' : 'Más filtros'}</button>
      </div>
      {advanced && <div className="kpi-filter-panel__advanced">
        <label className="kpi-field"><span>Turno</span><select value={shift} onChange={e => setShift(e.target.value)}><option value="ALL">Todos</option>{options.shifts.map(x => <option key={x}>{x}</option>)}</select></label>
        <label className="kpi-field"><span>Tipo de trabajo</span><select value={task} onChange={e => setTask(e.target.value)}><option value="ALL">Todos</option>{options.tasks.map(x => <option key={x} value={x}>{taskNames[x] || x}</option>)}</select></label>
        <label className="kpi-field"><span>Estado</span><select value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Todos</option>{options.statuses.map(x => <option key={x} value={x}>{statusNames[x] || x}</option>)}</select></label>
        <label className="kpi-field"><span>Modalidad</span><select value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="ALL">Todos</option><option value="MANUAL">Trabajo manual</option><option value="MACHINERY">Maquinaria</option><option value="MIXED">Mixto</option></select></label>
        <label className="kpi-checkbox"><input type="checkbox" checked={includeFuture} onChange={e => setIncludeFuture(e.target.checked)} /> Incluir OT con fecha futura</label>
        <button className="kpi-reset-button" onClick={reset}><RotateCcw size={14} /> Restablecer</button>
      </div>}
    </section>

    <div className="kpi-print-meta">Período: {periodDescription} · Generado: {new Date().toLocaleString('es-CL')}</div>
    {futureOrders.length > 0 && !includeFuture && <div className="kpi-alert kpi-no-print"><AlertTriangle size={18} /><div><strong>{futureOrders.length} OT {futureOrders.length === 1 ? 'tiene' : 'tienen'} fecha futura y no participa en los KPI actuales.</strong><span>La más próxima está fechada para {prettyDate([...futureOrders].sort((a, b) => (a.executionDate || '').localeCompare(b.executionDate || ''))[0]?.executionDate)}. Para analizarla, selecciona “Histórico completo” o un rango futuro y activa “Incluir OT con fecha futura”.</span></div></div>}

    <div className="kpi-summary-grid">
      <article className="kpi-stat kpi-stat--orange"><div className="kpi-stat__icon"><Layers3 /></div><div><span>Volumen registrado</span><strong>{number(metrics.volume)} <small>m³</small></strong><em>Según OT del período</em></div></article>
      <article className="kpi-stat kpi-stat--blue"><div className="kpi-stat__icon"><Users /></div><div><span>Horas-hombre</span><strong>{number(metrics.hh)} <small>HH</small></strong><em>Personas × duración real</em></div></article>
      <article className="kpi-stat kpi-stat--cyan"><div className="kpi-stat__icon"><Clock3 /></div><div><span>Horas máquina</span><strong>{number(metrics.hm)} <small>HM</small></strong><em>Uso mecánico informado</em></div></article>
      <article className="kpi-stat kpi-stat--green"><div className="kpi-stat__icon"><TrendingUp /></div><div><span>Promedio diario</span><strong>{number(metrics.volumeDay)} <small>m³/día</small></strong><em>Sobre {metrics.days} días con actividad</em></div></article>
      <article className="kpi-stat kpi-stat--violet"><div className="kpi-stat__icon"><Clock3 /></div><div><span>Consumo diario</span><strong>{number(metrics.hhDay)} <small>HH/día</small></strong><em>Sobre días con actividad</em></div></article>
      <article className="kpi-stat kpi-stat--slate"><div className="kpi-stat__icon"><BarChart3 /></div><div><span>Órdenes incluidas</span><strong>{integer(filtered.length)} <small>OT</small></strong><em>{periodDescription}</em></div></article>
      <article className="kpi-stat kpi-stat--cyan"><div className="kpi-stat__icon"><CalendarDays /></div><div><span>Jornadas activas</span><strong>{integer(metrics.days)} <small>días</small></strong><em>Con al menos una OT</em></div></article>
    </div>

    {!filtered.length ? <div className="kpi-empty"><BarChart3 size={36} /><strong>No hay órdenes para los filtros seleccionados</strong><span>Amplía el período o restablece los filtros.</span></div> : <>
      <div className="kpi-analysis-grid">
        <article className="kpi-panel"><div className="kpi-panel__heading"><div><span>EVOLUCIÓN TEMPORAL</span><h3>m³, HH y HM por {grain === 'DAY' ? 'día' : grain === 'WEEK' ? 'semana' : 'mes'}</h3></div><small>{series.length} períodos</small></div><div className="kpi-series">
          {series.map(x => <div className="kpi-series__row" key={x.key}><div className="kpi-series__label"><strong>{x.label}</strong><span>{x.orders} OT</span></div><div className="kpi-series__tracks"><div className="kpi-track"><i className="kpi-track__bar kpi-track__bar--volume" style={{ width: `${Math.max(2, x.volume / maxV * 100)}%` }} /><b>{number(x.volume)} m³</b></div><div className="kpi-track"><i className="kpi-track__bar kpi-track__bar--hh" style={{ width: `${Math.max(2, x.hh / maxHH * 100)}%` }} /><b>{number(x.hh)} HH</b></div><div className="kpi-track"><i className="kpi-track__bar kpi-track__bar--hm" style={{ width: `${Math.max(2, x.hm / maxHM * 100)}%` }} /><b>{number(x.hm)} HM</b></div></div></div>)}
        </div><div className="kpi-legend"><span><i className="kpi-legend__volume" /> Volumen registrado</span><span><i className="kpi-legend__hh" /> Horas-hombre</span><span><i className="kpi-legend__hm" /> Horas máquina</span></div></article>
        <article className="kpi-panel"><div className="kpi-panel__heading"><div><span>DESGLOSE OPERACIONAL</span><h3>Producción por área</h3></div><small>{areas.length} áreas</small></div><div className="kpi-area-list">
          {areas.map(x => <div className="kpi-area-row" key={x.name}><div className="kpi-area-row__header"><strong title={x.name}>{x.name}</strong><span>{x.orders} OT</span></div><div className="kpi-area-row__metric"><span>m³</span><div><i style={{ width: `${Math.max(2, x.volume / maxAreaV * 100)}%` }} /></div><b>{number(x.volume)}</b></div><div className="kpi-area-row__metric kpi-area-row__metric--hh"><span>HH</span><div><i style={{ width: `${Math.max(2, x.hh / maxAreaHH * 100)}%` }} /></div><b>{number(x.hh)}</b></div><div className="kpi-area-row__metric kpi-area-row__metric--hm"><span>HM</span><div><i style={{ width: `${Math.max(2, x.hm / maxAreaHM * 100)}%` }} /></div><b>{number(x.hm)}</b></div></div>)}
        </div></article>
      </div>
      <div className="kpi-control-grid">
        <article className="kpi-panel kpi-panel--compact"><div className="kpi-panel__heading"><div><span>FLUJO DOCUMENTAL</span><h3>Estado de las OT</h3></div><ShieldCheck size={19} /></div><div className="kpi-breakdown-list">{statusRows.map(([x, count]) => <div key={x}><span>{statusNames[x] || x}</span><strong>{count} <small>({Math.round(count / filtered.length * 100)}%)</small></strong></div>)}</div></article>
        <article className="kpi-panel kpi-panel--compact"><div className="kpi-panel__heading"><div><span>TIPO DE ACTIVIDAD</span><h3>Composición del trabajo</h3></div><Layers3 size={19} /></div><div className="kpi-breakdown-list">{taskRows.map(([x, count]) => <div key={x}><span>{taskNames[x] || 'Sin clasificar'}</span><strong>{count} <small>({Math.round(count / filtered.length * 100)}%)</small></strong></div>)}</div></article>
        <article className="kpi-panel kpi-panel--compact"><div className="kpi-panel__heading"><div><span>CALIDAD DEL REGISTRO</span><h3>Evidencias y validación</h3></div><AlertTriangle size={19} /></div><div className="kpi-quality"><div><span>Evidencia antes + después</span><strong>{metrics.evidence}/{filtered.length}</strong><i><b style={{ width: `${metrics.evidence / filtered.length * 100}%` }} /></i></div><div><span>Aprobadas / completadas</span><strong>{metrics.approved}/{filtered.length}</strong><i><b style={{ width: `${metrics.approved / filtered.length * 100}%` }} /></i></div><div className="kpi-planning-note"><strong>{number(metrics.hm)} HM informadas</strong><span>El informe PDF identifica por separado las OT de maquinaria que no registran horas máquina.</span></div></div></article>
      </div>
    </>}
    <footer className="kpi-method-note"><strong>Metodología:</strong> HH = cantidad de personas × duración real de cada OT. HM = horas máquina informadas. Los promedios consideran sólo días con actividad. El volumen corresponde al m³ registrado o calculado en la OT; no se interpreta automáticamente como eficiencia.</footer>
    <KpiPdfReport orders={filtered} periodDescription={periodDescription} generatedAt={printGeneratedAt} generatedBy={generatedBy} grain={grain} filterLabels={filterLabels} sectors={sectors} equipments={equipments} whiteLabel={whiteLabel} contractLabel={contractLabel} />
  </section>;
};
