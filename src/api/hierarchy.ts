import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { PlantArea, Sector, PlantEquipment, SubSector } from '../types';
import { componentNameKey } from '../utils/components.mjs';

export type HierarchyKind = 'area' | 'sector' | 'equipment' | 'component';
export type HierarchyRecord = PlantArea | Sector | PlantEquipment | SubSector;
export interface HierarchyValues { name: string; code: string; description?: string; }
export interface HierarchyCatalogue {
  plantAreas: PlantArea[];
  sectors: Sector[];
  equipments: PlantEquipment[];
  subSectors: SubSector[];
}
export interface HierarchyEdit {
  collection: 'plant_areas' | 'sectors' | 'equipments' | 'sub_sectors';
  original: HierarchyRecord;
  changes: Record<string, string>;
}

// IDs take precedence over cached names. Legacy records may only have a name.
const belongsTo = (id: string | undefined, name: string | undefined, parent: HierarchyRecord) =>
  id ? id === parent.id : !!name && name === parent.name;

export function planHierarchyEdit(kind: HierarchyKind, original: HierarchyRecord, values: HierarchyValues, catalogue: HierarchyCatalogue): HierarchyEdit[] {
  const name = values.name.trim();
  const code = values.code.trim();
  if (!name || !code) throw new Error('Ingresa el nombre y el código.');
  if (kind === 'component' && !componentNameKey(name)) throw new Error('El nombre debe contener letras o números.');
  const collections = { area: 'plant_areas', sector: 'sectors', equipment: 'equipments', component: 'sub_sectors' } as const;
  const changes: Record<string, string> = { name, code };
  if (kind === 'sector') changes.description = values.description?.trim() ?? (original as Sector).description ?? '';
  if (kind === 'component') changes.nameKey = componentNameKey(name);
  const edits: HierarchyEdit[] = [{ collection: collections[kind], original, changes }];
  if (name === original.name) return edits;

  if (kind === 'area') {
    for (const sector of catalogue.sectors) {
      if (belongsTo(sector.areaId, sector.areaName, original)) edits.push({ collection: 'sectors', original: sector, changes: { areaName: name } });
    }
  }
  if (kind === 'sector') {
    for (const equipment of catalogue.equipments) {
      if (belongsTo(equipment.sectorId, equipment.sectorName, original)) edits.push({ collection: 'equipments', original: equipment, changes: { sectorName: name } });
    }
    for (const component of catalogue.subSectors) {
      if (belongsTo(component.sectorId, component.sectorName, original)) edits.push({ collection: 'sub_sectors', original: component, changes: { sectorName: name } });
    }
  }
  if (kind === 'equipment') {
    const equipment = original as PlantEquipment;
    for (const component of catalogue.subSectors) {
      // Name-only links must also belong to this sector when names repeat.
      const sameSector = component.sectorId && equipment.sectorId
        ? component.sectorId === equipment.sectorId
        : !component.sectorName || !equipment.sectorName || component.sectorName === equipment.sectorName;
      if (component.equipmentId ? component.equipmentId === original.id : component.equipmentName === original.name && sameSector) {
        edits.push({ collection: 'sub_sectors', original: component, changes: { equipmentName: name } });
      }
    }
  }
  return edits;
}

export async function saveHierarchyEdit(database: Firestore | null, tenantId: string, edits: HierarchyEdit[]): Promise<void> {
  if (!database) throw new Error('No hay conexión con la base de datos.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Conéctate a internet para guardar los cambios.');
  await runTransaction(database, async transaction => {
    // Read everything before writing, so a failed save cannot leave half a rename.
    const records = await Promise.all(edits.map(edit => transaction.get(doc(database, edit.collection, edit.original.id))));
    for (let index = 0; index < edits.length; index++) {
      const edit = edits[index];
      const snapshot = records[index];
      if (!snapshot.exists()) throw new Error('El registro ya no existe. Actualiza la página.');
      const raw = snapshot.data();
      const current = { ...raw.payload, ...raw };
      if (current.tenantId !== tenantId) throw new Error('El registro pertenece a otro contrato.');
      // Do not overwrite a correction or reassignment made by another user.
      for (const key of new Set([...Object.keys(edit.changes), 'areaId', 'areaName', 'sectorId', 'sectorName', 'equipmentId', 'equipmentName'])) {
        if (current[key] !== (edit.original as unknown as Record<string, unknown>)[key]) {
          throw new Error('Otro usuario modificó el registro. Cierra la edición y vuelve a abrirlo para revisar los datos actuales.');
        }
      }
      const update: Record<string, unknown> = { ...edit.changes, updatedAt: serverTimestamp() };
      // Keep both supported storage formats consistent, preserving all metadata.
      if (raw.payload) {
        for (const [key, value] of Object.entries(edit.changes)) update[`payload.${key}`] = value;
      }
      transaction.update(snapshot.ref, update);
    }
  });
}
