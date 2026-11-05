export interface ReportDateRange { start: string; end: string }
export interface ReportCalendar {
  today: string; yesterday: string; weekStart: string;
  monthStart: string; monthEnd: string; shiftStart: string; shiftEnd: string;
}
export function getReportCalendar(now?: Date): ReportCalendar;
export function getReportDateRange(preset: string, startDate: string, endDate: string, calendar: ReportCalendar): ReportDateRange;
export function intersectReportDateRanges(first: ReportDateRange, second: ReportDateRange): ReportDateRange;
export function formatReportDate(date: string): string;
export function getReportFilename(range: ReportDateRange): string | null;
