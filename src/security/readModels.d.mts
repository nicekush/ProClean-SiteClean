import type { WorkOrder, DailyPersonnelAssignment } from '../types';
export const PHOTO_FIELDS: string[];
export const METRIC_FIELDS: string[];
export const COVERAGE_FIELDS: string[];
export function readModels(order: WorkOrder): { detail: WorkOrder; metrics: WorkOrder };
export function publicCoverage(assignment: DailyPersonnelAssignment): DailyPersonnelAssignment;
