import type { WorkOrder, ShiftType } from '../types';
import { shiftHoursBreakdown } from '../utils/kpiMetrics';
import { formatReportDate } from '../utils/workOrderReport.mjs';

interface WorkOrderHoursSummaryProps {
  orders: WorkOrder[];
  shifts: ShiftType[];
  dateRange: { start: string; end: string };
}

const formatHours = (value: number) => value.toLocaleString('es-CL', { maximumFractionDigits: 2 });

export function WorkOrderHoursSummary({ orders, shifts, dateRange }: WorkOrderHoursSummaryProps) {
  const totals = shiftHoursBreakdown(orders, shifts);
  const period = dateRange.start && dateRange.end
    ? dateRange.start === dateRange.end
      ? formatReportDate(dateRange.start)
      : `${formatReportDate(dateRange.start)} al ${formatReportDate(dateRange.end)}`
    : dateRange.start ? `Desde ${formatReportDate(dateRange.start)}`
      : dateRange.end ? `Hasta ${formatReportDate(dateRange.end)}` : 'Todas las fechas';
  const cards = [
    { label: 'HH día', value: totals.day.hh, count: totals.day.orders, period: 'day' },
    { label: 'HH noche', value: totals.night.hh, count: totals.night.orders, period: 'night' },
    { label: 'HM día', value: totals.day.hm, count: totals.day.orders, period: 'day' },
    { label: 'HM noche', value: totals.night.hm, count: totals.night.orders, period: 'night' },
  ];

  return (
    <section className="ot-hours-summary" aria-label="Horas reportadas por turno">
      <div className="ot-hours-heading">
        <div><h3>Horas reportadas</h3><p>{period} · {totals.total.orders} OT según los filtros aplicados</p></div>
        <p>Fecha de inicio del turno: día 07:00–19:00 · noche 19:00–07:00 del día siguiente.</p>
      </div>
      <div className="ot-hours-grid" aria-live="polite" aria-atomic="true">
        {cards.map(card => (
          <div className={`ot-hours-card ot-hours-card--${card.period}`} key={card.label}>
            <span>{card.label}</span><strong>{formatHours(card.value)}</strong><small>{card.count} OT</small>
          </div>
        ))}
      </div>
      <div className="ot-hours-footer">
        <span><strong>Total HH: {formatHours(totals.total.hh)}</strong> · <strong>Total HM: {formatHours(totals.total.hm)}</strong></span>
        <span>HH = personas × duración real · HM = horas máquina registradas</span>
      </div>
      {totals.unclassified.orders > 0 && (
        <p className="ot-hours-unclassified">Sin turno identificado: {totals.unclassified.orders} OT · {formatHours(totals.unclassified.hh)} HH · {formatHours(totals.unclassified.hm)} HM. Incluidas en los totales generales.</p>
      )}
    </section>
  );
}
