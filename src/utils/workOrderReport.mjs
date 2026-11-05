// Operational dates belong to the day each shift starts, in Chile.
const chileDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function getReportCalendar(now = new Date()) {
  const parts = chileDateFormatter.formatToParts(now);
  const part = type => parts.find(value => value.type === type).value;
  const today = `${part('year')}-${part('month')}-${part('day')}`;
  const date = new Date(`${today}T12:00:00Z`);
  const offset = days => {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
  };
  const shiftStart = -((date.getUTCDay() - 3 + 7) % 7);
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return {
    today, yesterday: offset(-1),
    weekStart: offset(1 - (date.getUTCDay() || 7)),
    monthStart: `${today.slice(0, 7)}-01`, monthEnd: monthEnd.toISOString().slice(0, 10),
    shiftStart: offset(shiftStart), shiftEnd: offset(shiftStart + 6),
  };
}

export function getReportDateRange(preset, startDate, endDate, calendar) {
  switch (preset) {
    case 'TODAY': return { start: calendar.today, end: calendar.today };
    case 'YESTERDAY': return { start: calendar.yesterday, end: calendar.yesterday };
    case 'THIS_WEEK': return { start: calendar.weekStart, end: calendar.today };
    case 'THIS_MONTH': return { start: calendar.monthStart, end: calendar.monthEnd };
    case 'CUSTOM': return { start: startDate, end: endDate };
    default: return { start: '', end: '' };
  }
}

export function intersectReportDateRanges(first, second) {
  return {
    start: [first.start, second.start].filter(Boolean).sort().at(-1) || '',
    end: [first.end, second.end].filter(Boolean).sort().at(0) || '',
  };
}

export function formatReportDate(date) {
  return date.split('-').reverse().join('.');
}

export function getReportFilename({ start, end }) {
  if (!start || !end || start > end) return null;
  const period = start === end ? formatReportDate(start) : `${formatReportDate(start)}_al_${formatReportDate(end)}`;
  return `Reporte_ProCleanMG_${period}.xlsx`;
}
