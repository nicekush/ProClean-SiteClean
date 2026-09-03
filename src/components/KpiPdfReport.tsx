import React, { useMemo } from 'react';
import type { PlantEquipment, Sector, WhiteLabelConfig, WorkOrder } from '../types';

type Grain = 'DAY' | 'WEEK' | 'MONTH';

interface Props {
  orders: WorkOrder[];
  periodDescription: string;
  generatedAt: Date;
  generatedBy?: string;
  grain: Grain;
  filterLabels: string[];
  sectors: Sector[];
  equipments: PlantEquipment[];
  whiteLabel?: WhiteLabelConfig;
  contractLabel?: string;
}

const num = (value: number, decimals = 1) => new Intl.NumberFormat('es-CL', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(value);

const dateValue = (value?: string) => value ? new Date(`${value}T12:00:00`) : undefined;
const dateLabel = (value?: string) => {
  const parsed = dateValue(value);
  return parsed ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed) : 'Sin fecha';
};
const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleUpperCase();
const hhOf = (order: WorkOrder) => Math.max(0, Number(order.headcount) || 0) * Math.max(0, Number(order.realHours) || 0);
const hmOf = (order: WorkOrder) => Math.max(0, Number(order.machineHours) || 0);
const volumeOf = (order: WorkOrder) => Math.max(0, Number(order.cubicMetersRemoved) || 0);
const isApproved = (order: WorkOrder) => order.status === 'APROBADO_MANDANTE' || order.status === 'COMPLETADO';
const hasEvidence = (order: WorkOrder) => Boolean(order.imageBeforeUrl || order.beforePhotoUrl) && Boolean(order.imageAfterUrl || order.afterPhotoUrl);
const resourceMode = (order: WorkOrder) => {
  const manual = order.hasManualLabor ?? (hhOf(order) > 0);
  const machinery = order.hasEquipment ?? Boolean(order.vehiclePatent || order.fleetTripsCount || hmOf(order));
  return manual && machinery ? 'Mixto' : machinery ? 'Maquinaria' : 'Manual';
};
const statusLabel = (status: WorkOrder['status']) => ({
  PROGRAMADO: 'Programado',
  EN_EJECUCION: 'En ejecución',
  EN_PROCESO: 'En proceso',
  PENDIENTE_APROBACION_ITO: 'Pendiente ITO',
  APROBADO_MANDANTE: 'Aprobado ITO',
  RECHAZADO_CONTINGENCIA: 'Rechazado',
  CONTINGENCIA: 'Contingencia',
  COMPLETADO: 'Completado',
}[status] || status);

const weekStart = (date: Date) => {
  const result = new Date(date);
  result.setDate(result.getDate() - (result.getDay() === 0 ? 6 : result.getDay() - 1));
  return result;
};
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const groupKey = (value: string, grain: Grain) => {
  const date = dateValue(value);
  if (!date) return 'SIN_FECHA';
  if (grain === 'MONTH') return value.slice(0, 7);
  if (grain === 'WEEK') return dateKey(weekStart(date));
  return value;
};

export const KpiPdfReport: React.FC<Props> = ({
  orders,
  periodDescription,
  generatedAt,
  generatedBy,
  grain,
  filterLabels,
  sectors,
  equipments,
  whiteLabel,
  contractLabel,
}) => {
  const generatedLabel = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt);
  const reportId = `KPI-${dateKey(generatedAt).replaceAll('-', '')}-${String(generatedAt.getHours()).padStart(2, '0')}${String(generatedAt.getMinutes()).padStart(2, '0')}`;

  const metrics = useMemo(() => {
    const volume = orders.reduce((sum, order) => sum + volumeOf(order), 0);
    const hh = orders.reduce((sum, order) => sum + hhOf(order), 0);
    const hm = orders.reduce((sum, order) => sum + hmOf(order), 0);
    const activeDays = new Set(orders.flatMap(order => order.executionDate ? [order.executionDate] : [])).size;
    return {
      volume,
      hh,
      hm,
      activeDays,
      approved: orders.filter(isApproved).length,
      evidence: orders.filter(hasEvidence).length,
      manual: orders.filter(order => resourceMode(order) === 'Manual').length,
      machinery: orders.filter(order => resourceMode(order) === 'Maquinaria').length,
      mixed: orders.filter(order => resourceMode(order) === 'Mixto').length,
    };
  }, [orders]);

  const timeline = useMemo(() => {
    const rows = new Map<string, { key: string; volume: number; hh: number; hm: number; ots: number; approved: number; evidence: number }>();
    orders.forEach(order => {
      if (!order.executionDate) return;
      const key = groupKey(order.executionDate, grain);
      const row = rows.get(key) || { key, volume: 0, hh: 0, hm: 0, ots: 0, approved: 0, evidence: 0 };
      row.volume += volumeOf(order);
      row.hh += hhOf(order);
      row.hm += hmOf(order);
      row.ots += 1;
      row.approved += isApproved(order) ? 1 : 0;
      row.evidence += hasEvidence(order) ? 1 : 0;
      rows.set(key, row);
    });
    return [...rows.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [orders, grain]);

  const areaRows = useMemo(() => {
    const rows = new Map<string, { name: string; volume: number; hh: number; hm: number; ots: number; approved: number; evidence: number }>();
    orders.forEach(order => {
      const name = order.sectorName || order.areaName || 'Sin ubicación informada';
      const row = rows.get(name) || { name, volume: 0, hh: 0, hm: 0, ots: 0, approved: 0, evidence: 0 };
      row.volume += volumeOf(order);
      row.hh += hhOf(order);
      row.hm += hmOf(order);
      row.ots += 1;
      row.approved += isApproved(order) ? 1 : 0;
      row.evidence += hasEvidence(order) ? 1 : 0;
      rows.set(name, row);
    });
    return [...rows.values()].sort((a, b) => b.volume - a.volume || b.hh - a.hh);
  }, [orders]);

  const heatmapSections = useMemo(() => {
    const catalogSections = sectors.map(sector => {
      const sectorOrders = orders.filter(order => order.sectorId === sector.id || normalize(order.sectorName) === normalize(sector.name));
      const catalogEquipment = equipments.filter(equipment => equipment.sectorId === sector.id || normalize(equipment.sectorName) === normalize(sector.name));
      const seen = new Set<string>();
      const rows = catalogEquipment.map(equipment => {
        seen.add(normalize(equipment.name));
        const equipmentOrders = sectorOrders.filter(order => {
          if (order.equipmentId === equipment.id) return true;
          const candidate = normalize(order.equipmentName || order.equipoCorrea);
          const catalogName = normalize(equipment.name);
          return candidate === catalogName || candidate.startsWith(`${catalogName} (`);
        });
        return {
          name: equipment.name,
          volume: equipmentOrders.reduce((sum, order) => sum + volumeOf(order), 0),
          hh: equipmentOrders.reduce((sum, order) => sum + hhOf(order), 0),
          hm: equipmentOrders.reduce((sum, order) => sum + hmOf(order), 0),
          ots: equipmentOrders.length,
        };
      });
      sectorOrders.forEach(order => {
        const name = order.equipmentName || order.equipoCorrea || 'Sin equipo informado';
        if (seen.has(normalize(name))) return;
        const matching = sectorOrders.filter(candidate => normalize(candidate.equipmentName || candidate.equipoCorrea) === normalize(name));
        rows.push({
          name,
          volume: matching.reduce((sum, candidate) => sum + volumeOf(candidate), 0),
          hh: matching.reduce((sum, candidate) => sum + hhOf(candidate), 0),
          hm: matching.reduce((sum, candidate) => sum + hmOf(candidate), 0),
          ots: matching.length,
        });
        seen.add(normalize(name));
      });
      return { sector, orders: sectorOrders, rows };
    });
    return catalogSections.filter(section => section.orders.length > 0);
  }, [orders, sectors, equipments]);

  const globalHeatMax = Math.max(1, ...heatmapSections.flatMap(section => section.rows.map(row => row.volume)));
  const heatClass = (value: number) => {
    if (value <= 0) return 'is-empty';
    const ratio = value / globalHeatMax;
    if (ratio <= .25) return 'is-low';
    if (ratio <= .5) return 'is-medium';
    if (ratio <= .75) return 'is-high';
    return 'is-critical';
  };

  const quality = {
    missingDate: orders.filter(order => !order.executionDate).length,
    missingLocation: orders.filter(order => !order.sectorName && !order.areaName).length,
    zeroVolume: orders.filter(order => volumeOf(order) === 0).length,
    machineryWithoutHm: orders.filter(order => resourceMode(order) !== 'Manual' && hmOf(order) === 0).length,
    manualWithoutHh: orders.filter(order => resourceMode(order) !== 'Maquinaria' && hhOf(order) === 0).length,
    missingEvidence: orders.filter(order => !hasEvidence(order)).length,
    pendingIto: orders.filter(order => !isApproved(order)).length,
  };

  const Header = ({ title, subtitle }: { title: string; subtitle: string }) => <header className="kpi-pdf-header">
    <div className="kpi-pdf-brand">
      {whiteLabel?.companyLogoUrl ? <img src={whiteLabel.companyLogoUrl} alt="ProCleanMG" /> : <strong>ProCleanMG</strong>}
      <div><span>REPORTE KPI OPERACIONAL</span><h1>{title}</h1><p>{subtitle}{contractLabel ? ` · ${contractLabel}` : ''}</p></div>
    </div>
    <div className="kpi-pdf-id"><span>ID INFORME</span><strong>{reportId}</strong><small>{periodDescription.replaceAll('—', '-')}</small></div>
  </header>;

  const Footer = () => <footer className="kpi-pdf-footer">
    <span>Generado por: {generatedBy || 'Usuario autenticado'} · {generatedLabel}</span>
    <strong>Fuente: Órdenes de Trabajo - Firebase Cloud</strong>
  </footer>;

  const pct = (value: number) => orders.length ? Math.round(value / orders.length * 100) : 0;

  return <section className="kpi-pdf-report" aria-label="Informe KPI operacional imprimible">
    <article className="kpi-pdf-page">
      <Header title="Resumen ejecutivo del período" subtitle="Producción, recursos y respaldo documental de las OT incluidas" />
      <div className="kpi-pdf-filter-strip"><strong>Alcance aplicado</strong>{filterLabels.map(label => <span key={label}>{label}</span>)}</div>
      <div className="kpi-pdf-hero-grid">
        <div><span>VOLUMEN TOTAL</span><strong>{num(metrics.volume)} <small>m³</small></strong><em>{num(metrics.activeDays ? metrics.volume / metrics.activeDays : 0)} m³/día activo</em></div>
        <div><span>HORAS HOMBRE</span><strong>{num(metrics.hh)} <small>HH</small></strong><em>{num(metrics.activeDays ? metrics.hh / metrics.activeDays : 0)} HH/día activo</em></div>
        <div><span>HORAS MÁQUINA</span><strong>{num(metrics.hm)} <small>HM</small></strong><em>{num(metrics.activeDays ? metrics.hm / metrics.activeDays : 0)} HM/día activo</em></div>
        <div><span>ÓRDENES INCLUIDAS</span><strong>{orders.length} <small>OT</small></strong><em>{metrics.activeDays} jornadas con actividad</em></div>
      </div>
      <div className="kpi-pdf-summary-columns">
        <section><h2>Control documental</h2><div className="kpi-pdf-progress-row"><span>Aprobadas / completadas</span><strong>{metrics.approved}/{orders.length} ({pct(metrics.approved)}%)</strong></div><i><b style={{ width: `${pct(metrics.approved)}%` }} /></i><div className="kpi-pdf-progress-row"><span>Evidencia antes y después</span><strong>{metrics.evidence}/{orders.length} ({pct(metrics.evidence)}%)</strong></div><i><b style={{ width: `${pct(metrics.evidence)}%` }} /></i></section>
        <section><h2>Composición de las OT</h2><div className="kpi-pdf-mode-grid"><div><span>Manual</span><strong>{metrics.manual}</strong></div><div><span>Maquinaria</span><strong>{metrics.machinery}</strong></div><div><span>Mixtas</span><strong>{metrics.mixed}</strong></div></div><p>La clasificación utiliza los indicadores de recursos registrados en cada OT.</p></section>
      </div>
      <div className="kpi-pdf-note"><strong>Criterio de lectura:</strong> HH = dotación × duración real. HM corresponde a horas máquina informadas. Los promedios diarios consideran jornadas con al menos una OT.</div>
      <Footer />
    </article>

    <article className="kpi-pdf-page">
      <Header title="Evolución y distribución operacional" subtitle="Valores exactos por período y área operativa" />
      <div className="kpi-pdf-two-tables">
        <section><h2>Evolución {grain === 'DAY' ? 'diaria' : grain === 'WEEK' ? 'semanal' : 'mensual'}</h2><table><thead><tr><th>Período</th><th>OT</th><th>m³</th><th>HH</th><th>HM</th><th>Aprob.</th><th>Evid.</th></tr></thead><tbody>{timeline.map(row => <tr key={row.key}><td>{grain === 'MONTH' ? row.key : dateLabel(row.key)}</td><td>{row.ots}</td><td>{num(row.volume)}</td><td>{num(row.hh)}</td><td>{num(row.hm)}</td><td>{row.approved}</td><td>{row.evidence}</td></tr>)}</tbody></table></section>
        <section><h2>Resultados por área operativa</h2><table><thead><tr><th>Área / sector</th><th>OT</th><th>m³</th><th>HH</th><th>HM</th><th>Aprob.</th><th>Evid.</th></tr></thead><tbody>{areaRows.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.ots}</td><td>{num(row.volume)}</td><td>{num(row.hh)}</td><td>{num(row.hm)}</td><td>{row.approved}</td><td>{row.evidence}</td></tr>)}</tbody></table></section>
      </div>
      <Footer />
    </article>

    {heatmapSections.map(section => {
      const totals = {
        volume: section.orders.reduce((sum, order) => sum + volumeOf(order), 0),
        hh: section.orders.reduce((sum, order) => sum + hhOf(order), 0),
        hm: section.orders.reduce((sum, order) => sum + hmOf(order), 0),
      };
      return <article className="kpi-pdf-page" key={section.sector.id}>
        <Header title={`Mapa de calor - ${section.sector.name}`} subtitle="Intensidad por equipo según volumen consolidado del período" />
        <div className="kpi-pdf-sector-totals"><span>{section.orders.length} OT</span><span>{num(totals.volume)} m³</span><span>{num(totals.hh)} HH</span><span>{num(totals.hm)} HM</span></div>
        <div className="kpi-pdf-heat-legend"><span className="is-empty">Sin actividad</span><span className="is-low">Baja</span><span className="is-medium">Media</span><span className="is-high">Alta</span><span className="is-critical">Máxima</span><small>Escala relativa al mayor volumen por equipo del informe ({num(globalHeatMax)} m³).</small></div>
        <div className="kpi-pdf-heat-grid">{section.rows.map(row => <div className={`kpi-pdf-heat-cell ${heatClass(row.volume)}`} key={row.name}><strong>{row.name}</strong><b>{num(row.volume)} m³</b><span>{num(row.hh)} HH · {num(row.hm)} HM · {row.ots} OT</span></div>)}</div>
        <Footer />
      </article>;
    })}

    <article className="kpi-pdf-page">
      <Header title="Control y calidad del registro" subtitle="Excepciones que afectan la interpretación del período" />
      <div className="kpi-pdf-quality-grid">
        <div className={quality.pendingIto ? 'has-warning' : ''}><span>Pendientes de aprobación/cierre</span><strong>{quality.pendingIto}</strong><small>OT no aprobadas ni completadas</small></div>
        <div className={quality.missingEvidence ? 'has-warning' : ''}><span>Sin evidencia completa</span><strong>{quality.missingEvidence}</strong><small>Falta fotografía antes o después</small></div>
        <div className={quality.zeroVolume ? 'has-warning' : ''}><span>Volumen igual a cero</span><strong>{quality.zeroVolume}</strong><small>Revisar ejecución o registro</small></div>
        <div className={quality.machineryWithoutHm ? 'has-warning' : ''}><span>Maquinaria sin HM</span><strong>{quality.machineryWithoutHm}</strong><small>OT con recurso mecánico sin horas máquina</small></div>
        <div className={quality.manualWithoutHh ? 'has-warning' : ''}><span>Trabajo manual sin HH</span><strong>{quality.manualWithoutHh}</strong><small>OT manual sin dotación o duración</small></div>
        <div className={quality.missingLocation ? 'has-warning' : ''}><span>Sin ubicación completa</span><strong>{quality.missingLocation}</strong><small>Área o sector no informado</small></div>
        <div className={quality.missingDate ? 'has-warning' : ''}><span>Sin fecha de ejecución</span><strong>{quality.missingDate}</strong><small>No participa correctamente en la serie</small></div>
      </div>
      <div className="kpi-pdf-note"><strong>Transparencia del informe:</strong> un valor faltante se informa como excepción; no se interpreta automáticamente como producción o consumo real igual a cero.</div>
      <Footer />
    </article>

    <article className="kpi-pdf-page kpi-pdf-page--detail">
      <Header title="Anexo de trazabilidad de órdenes de trabajo" subtitle={`${orders.length} OT que sustentan los resultados del informe`} />
      <table className="kpi-pdf-detail-table"><thead><tr><th>Fecha / OT</th><th>Área / equipo</th><th>Trabajo</th><th>Recursos</th><th>m³</th><th>HH</th><th>HM</th><th>Estado</th><th>Evidencia</th></tr></thead><tbody>{[...orders].sort((a, b) => (a.executionDate || '').localeCompare(b.executionDate || '') || a.sapCode.localeCompare(b.sapCode)).map(order => <tr key={order.id}><td><strong>{order.sapCode}</strong><br />{dateLabel(order.executionDate)}<br />{order.shiftName}</td><td><strong>{order.sectorName || order.areaName || 'Sin área'}</strong><br />{order.equipmentName || order.equipoCorrea || 'Sin equipo'}<br /><small>{(order.selectedSubSectorNames || []).join(', ')}</small></td><td>{order.taskType || 'Sin clasificar'}<br /><small>{order.operationDetail || 'Sin detalle'}</small></td><td>{resourceMode(order)}<br /><small>{order.headcount || 0} pers. · {num(Number(order.realHours) || 0)} h{order.vehiclePatent ? ` · ${order.vehiclePatent}` : ''}</small></td><td>{num(volumeOf(order))}</td><td>{num(hhOf(order))}</td><td>{num(hmOf(order))}</td><td>{statusLabel(order.status)}</td><td>{hasEvidence(order) ? 'Completa' : 'Incompleta'}</td></tr>)}</tbody></table>
      <div className="kpi-pdf-methodology"><strong>Metodología:</strong> volumen = m³ consolidado registrado en cada OT; HH = cantidad de personas × duración real; HM = horas máquina informadas. Las OT mixtas conservan el volumen total registrado y no se reparte artificialmente entre trabajo manual y maquinaria. El estado documental se informa independientemente de los valores operacionales.</div>
      <Footer />
    </article>
  </section>;
};
