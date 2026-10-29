// Keep this normalization in sync with componentNameKey() in the rules generator.
export function componentNameKey(name) {
  return name.toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function componentsForEquipment(components, equipment, sector) {
  if (!equipment) return [];
  const equipmentMatches = component => component.equipmentId
    ? component.equipmentId === equipment.id
    : Boolean(component.equipmentName && component.equipmentName === equipment.name);
  const sectorMatches = component => component.sectorId
    ? component.sectorId === sector?.id
    : Boolean(component.sectorName && component.sectorName === sector?.name);
  const candidates = components.filter(component => equipmentMatches(component))
    .concat(components.filter(component => !component.equipmentId && !component.equipmentName
      && (sectorMatches(component) || (!component.sectorId && !component.sectorName))));
  const unique = new Map();
  for (const component of candidates) {
    const key = componentNameKey(component.name || '');
    if (key && !unique.has(key)) unique.set(key, component);
  }
  return [...unique.values()];
}

// Resolve within the same visible scope, including sector-wide legacy components.
export function selectedComponentIds(names, available, previousIds = [], previousNames = []) {
  return names.flatMap(name => {
    // Preserve the exact IDs of historical selections, even if a newer
    // equipment-specific component now has the same display name.
    const previousIndex = previousNames.indexOf(name);
    if (previousIds.length === previousNames.length && previousIndex >= 0 && previousIds[previousIndex]) return [previousIds[previousIndex]];
    const match = available.find(component => component.name === name);
    if (match) return [match.id];
    return [];
  });
}
