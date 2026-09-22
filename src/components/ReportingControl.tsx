import { useMemo, useState } from 'react';
import type { WorkOrder, UserAccount } from '../types';
import { chileDate, orderDate, person, positive, delayDays, reviewIssues, UNKNOWN } from '../utils/reportability';
import type { DateBasis, PersonBasis } from '../utils/reportability';
import './ReportingControl.css';

interface Props { orders: WorkOrder[]; users: UserAccount[]; onOpen: (o: WorkOrder) => void; onUpdate: (id: string, change: Partial<WorkOrder>) => void; fromCache: boolean; pendingIds: Set<string>; }
const fmt = (n: number) => n.toLocaleString('es-CL', { maximumFractionDigits: 1 });
export function ReportingControl({ orders, users, onOpen, onUpdate, fromCache, pendingIds }: Props) {
  const today = chileDate(new Date().toISOString());
  const [from, setFrom] = useState(today.slice(0, 8) + '01'), [to, setTo] = useState(today);
  const [basis, setBasis] = useState<DateBasis>('execution');
  const [peopleBasis, setPeopleBasis] = useState<PersonBasis>('author');
  const [selected, setSelected] = useState(''), [state, setState] = useState(''), [shift, setShift] = useState('');
  const [issueOnly, setIssueOnly] = useState(false), [grace, setGrace] = useState(1);
  const [query, setQuery] = useState('');
  const invalid = !from || !to || from > to;
  const scoped = useMemo(() => orders.filter(o => !invalid && orderDate(o, basis) >= from && orderDate(o, basis) <= to && !!orderDate(o, basis)), [orders, from, to, basis, invalid]);
  const withoutDate = orders.filter(o => !orderDate(o, basis)).length;
  const rows = useMemo(() => scoped.filter(o => (!selected || person(o, peopleBasis).id === selected) && (!state || o.status === state) && (!shift || o.shiftId === shift) && (!issueOnly || reviewIssues(o).length > 0) && (!query || `${o.id} ${o.sapCode} ${o.equipoCorrea} ${o.operationDetail} ${o.vehiclePatent || ''}`.toLowerCase().includes(query.toLowerCase()))), [scoped, selected, peopleBasis, state, shift, issueOnly, query]);
  const metrics = (items: WorkOrder[]) => ({ count: items.length, hh: items.reduce((s,o)=>s+positive(o.headcount)*positive(o.realHours),0), hm: items.reduce((s,o)=>s+positive(o.machineHours),0), m3: items.reduce((s,o)=>s+positive(o.cubicMetersRemoved),0), review: items.filter(o=>reviewIssues(o).length>0).length, late: items.filter(o=>o.status!=='PROGRAMADO' && delayDays(o)!==null && (delayDays(o) ?? 0) > grace).length, undated: items.filter(o=>delayDays(o)===null).length, evidence: items.filter(o=>(o.imageBeforeUrl||o.beforePhotoUrl)&&(o.imageAfterUrl||o.afterPhotoUrl)).length, pending: items.filter(o=>o.status==='PENDIENTE_APROBACION_ITO').length, rejected: items.filter(o=>o.status==='RECHAZADO_CONTINGENCIA').length, days: new Set(items.map(o=>o.executionDate).filter(Boolean)).size });
  const total = metrics(rows);
  const people = new Map<string,string>();
  users.filter(u=>u.role==='SUPERVISOR_TERRENO').forEach(u=>people.set(u.id,u.name));
  orders.forEach(o=>{const p=person(o,peopleBasis);people.set(p.id,p.name);});
  const groups = [...people].filter(([id])=>!selected||id===selected).map(([id,name])=>({ id,name,...metrics(rows.filter(o=>person(o,peopleBasis).id===id)) })).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  function download() {
    const header=['ID OT','SAP','Ejecución','Ingreso','Última edición','Autor','Origen autoría','ID auditoría','Responsable','Equipo / sector','Patente','Estado','HH','HM','m³ registrados','Días hasta ingreso','Revisiones'];
    const records=rows.map(o=>[o.id,o.sapCode,o.executionDate||'',o.createdAt||'',o.updatedAt||'',person(o,'author').name,o.authorSource==='audit'?'Auditoría':o.createdById?'Registro directo':'Sin identificar',o.authorAuditId||'',person(o,'responsible').name,o.equipoCorrea,o.vehiclePatent||'',o.status,positive(o.headcount)*positive(o.realHours),positive(o.machineHours),positive(o.cubicMetersRemoved),delayDays(o)??'Sin fecha',reviewIssues(o).join(' | ')]);
    const escape=(v:unknown)=>{let s=String(v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    const url=URL.createObjectURL(new Blob(['\uFEFF'+[header,...records].map(r=>r.map(escape).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download=`Control_reportabilidad_${from}_${to}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <section className="reporting-control">
    <header><h2>Control de reportabilidad</h2><p>Registro por usuario y responsable. Fechas en horario de Chile.</p><button onClick={download} disabled={!rows.length}>Exportar detalle CSV</button></header>
    {(fromCache||pendingIds.size>0)&&<p className="rc-notice">{fromCache?'Mostrando datos en caché; no equivalen a una consulta actual de la nube. ':''}{pendingIds.size>0?`${pendingIds.size} OT pendientes de sincronizar.`:''}</p>}
    <div className="rc-filters">
      <label>Desde<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Hasta<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
      <label>Fecha del filtro<select value={basis} onChange={e=>setBasis(e.target.value as DateBasis)}><option value="execution">Ejecución</option><option value="creation">Ingreso</option><option value="update">Última modificación</option><option value="approval">Aprobación</option></select></label>
      <label>Agrupar por<select value={peopleBasis} onChange={e=>{setPeopleBasis(e.target.value as PersonBasis);setSelected('');}}><option value="author">Usuario que reportó</option><option value="responsible">Supervisor responsable</option></select></label>
      <label>Persona<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Todas</option>{[...people].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
      <label>Estado<select value={state} onChange={e=>setState(e.target.value)}><option value="">Todos</option>{[...new Set(orders.map(o=>o.status))].sort().map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Turno<select value={shift} onChange={e=>setShift(e.target.value)}><option value="">Todos</option>{[...new Map(orders.filter(o=>o.shiftId).map(o=>[o.shiftId,o.shiftName])).entries()].map(([id,name])=><option key={id} value={id}>{name||id}</option>)}</select></label>
      <label>Plazo de ingreso (días calendario)<input type="number" min="0" max="30" value={grace} onChange={e=>setGrace(Math.min(30,Math.max(0,Number(e.target.value)||0)))}/></label>
      <label>Buscar OT, equipo o patente<input value={query} onChange={e=>setQuery(e.target.value)} /></label>
      <label className="rc-check"><input type="checkbox" checked={issueOnly} onChange={e=>setIssueOnly(e.target.checked)}/>Solo OT que requieren revisión</label>
    </div>
    {invalid&&<p role="alert">Seleccione un rango válido (desde no puede ser posterior a hasta).</p>}
    <p className="rc-notice">{withoutDate} OT sin fecha utilizable para este filtro quedan fuera del rango. La autoría histórica se recupera cuando la auditoría y el usuario coinciden sin ambigüedad. Las fechas antiguas sin formato verificable quedan sin recuperar. El plazo es una referencia ajustable: días calendario desde ejecución hasta ingreso, no horas desde cierre de turno.</p>
    <div className="rc-metrics">{[['OT',total.count],['HH registradas',fmt(total.hh)],['HM registradas',fmt(total.hm)],['m³ registrados',fmt(total.m3)],['OT por revisar',total.review],['Ingreso tardío',total.late]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p>Los totales incluyen los estados seleccionados. Los m³ son valores registrados, sin certificación de medición. Evidencia indica campos presentes, no revisión de fotografías.</p>
    <h3>Resumen por {peopleBasis==='author'?'usuario que reportó':'responsable'}</h3>
    <div className="rc-scroll"><table><thead><tr>{['Persona','OT','HH','HM','m³','Días con OT','Tardías','Sin fecha de ingreso/ejecución','Por revisar','Antes y después','Pend. ITO','Rechazadas'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{groups.map(g=><tr key={g.id}><td><button onClick={()=>setSelected(g.id)}>{g.name}</button></td>{[g.count,fmt(g.hh),fmt(g.hm),fmt(g.m3),g.days,g.late,g.undated,g.review,g.evidence,g.pending,g.rejected].map((v,i)=><td key={i}>{v}</td>)}</tr>)}</tbody></table></div>
    <p>No se calculan turnos incumplidos ni cobertura esperada: aún no existe una programación que vincule cada supervisor con sus turnos, personal y máquinas. Cero OT no demuestra incumplimiento.</p>
    <h3>Detalle y seguimiento ({rows.length})</h3>
    {rows.length===0?<p>No hay OT para estos filtros.</p>:<div className="rc-scroll"><table><thead><tr>{['OT / equipo','Ejecución / ingreso','Autor / editor','Responsable','HH / HM','Estado','Revisiones','Acción'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(o=><tr key={o.id}>
      <td>{o.sapCode||o.id}<small>{o.equipoCorrea}</small><small>{o.vehiclePatent}</small></td>
      <td>{o.executionDate||'Sin fecha'}<small>Ingreso: {orderDate(o,'creation')||'No disponible'}</small></td>
      <td>{person(o,'author').name}{o.authorSource === 'audit' && <small>Recuperado de auditoría · {o.authorAuditId}</small>}<small>Editor: {o.updatedByName||'No disponible'}</small></td>
      <td><select aria-label={`Responsable de ${o.sapCode||o.id}`} value={o.responsibleSupervisorId||''} onChange={e=>{const u=users.find(u=>u.id===e.target.value);onUpdate(o.id,{responsibleSupervisorId:u?.id||'',responsibleSupervisorName:u?.name||''});}}><option value="">Sin responsable</option>{users.filter(u=>u.role==='SUPERVISOR_TERRENO'||u.id===o.responsibleSupervisorId).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}{o.responsibleSupervisorId&&!users.some(u=>u.id===o.responsibleSupervisorId)&&<option value={o.responsibleSupervisorId}>{o.responsibleSupervisorName||o.responsibleSupervisorId}</option>}</select></td>
      <td>{fmt(positive(o.headcount)*positive(o.realHours))} HH<small>{fmt(positive(o.machineHours))} HM</small></td><td>{o.status}{pendingIds.has(o.id)&&<small>Pendiente de sincronizar</small>}</td>
      <td>{reviewIssues(o).join(' · ')||'Sin alertas de campos'}{delayDays(o)!==null&&(delayDays(o) ?? 0) > grace&&o.status!=='PROGRAMADO'&&<small>Ingreso {delayDays(o)} días después de ejecución</small>}{person(o,'author').id===UNKNOWN&&<small>Autor no disponible</small>}</td>
      <td><button onClick={()=>onOpen(o)}>Abrir OT</button></td>
    </tr>)}</tbody></table></div>}
  </section>;
}

