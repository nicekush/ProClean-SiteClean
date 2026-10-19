// Shared by the browser, the rules generator and the administrative backfill.
export const PHOTO_FIELDS = ['imageBeforeUrl', 'imageAfterUrl', 'beforePhotoUrl', 'afterPhotoUrl', 'itoSignatureDataUrl'];
export const METRIC_FIELDS = ['revision', 'sapCode', 'id', 'tenantId', 'contractId', 'areaId', 'areaName', 'sectorId', 'sectorName', 'equipmentId', 'equipmentName', 'equipoCorrea', 'subSectorId', 'subSectorName', 'selectedSubSectorIds', 'selectedSubSectorNames', 'executionDate', 'semana', 'dia', 'shiftId', 'shiftName', 'staffingType', 'taskType', 'status', 'headcount', 'estimatedHours', 'realHours', 'hasManualLabor', 'hasEquipment', 'vehiclePatent', 'machineHours', 'fleetTripsCount', 'bucketCapacityM3', 'cubicMetersRemoved', 'manualM3', 'machineryM3', 'waterVolumeM3'];
export const COVERAGE_FIELDS = ['id', 'tenantId', 'contractId', 'areaId', 'cargoReqId', 'cargoId', 'cargoName', 'slotIndex', 'fecha', 'grupo', 'shiftId'];
export function readModels(order) {
  const source = JSON.parse(JSON.stringify({ ...order, contractId: order.contractId || 'c1' }));
  const detail = Object.fromEntries(Object.entries(source).filter(([k]) => !PHOTO_FIELDS.includes(k)));
  const metrics = Object.fromEntries(Object.entries(source).filter(([k]) => METRIC_FIELDS.includes(k)));
  const flags = { hasBeforeEvidence: Boolean(source.imageBeforeUrl || source.beforePhotoUrl), hasAfterEvidence: Boolean(source.imageAfterUrl || source.afterPhotoUrl) };
  return { detail: { ...detail, ...flags }, metrics: { ...metrics, ...flags } };
}
export function publicCoverage(assignment) {
  return { ...Object.fromEntries(Object.entries(assignment).filter(([k]) => COVERAGE_FIELDS.includes(k))),
    personId: assignment.personId ? 'covered' : '', personName: '' };
}
