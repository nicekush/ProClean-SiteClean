import { collection, doc, getDocsFromServer, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import type { PlantArea, PlantEquipment, Sector, SubSector, UserAccount } from '../types';
import { can } from '../security/permissions';
import { componentNameKey, componentsForEquipment } from '../utils/components.mjs';

export interface ComponentCreationInput {
  areaId: string;
  sectorId: string;
  equipmentId: string;
  name: string;
}
export interface ComponentCreationResult { component: SubSector; created: boolean; }

export async function createEquipmentComponent(database: Firestore | null, actor: UserAccount, input: ComponentCreationInput): Promise<ComponentCreationResult> {
  if (!database) throw new Error('No hay conexión con la base de datos.');
  if (!can(actor, 'components.create')) throw new Error('No tienes permiso para crear componentes desde el wizard.');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Conéctate a internet para crear el componente. El nombre se conservará para reintentar.');
  }
  const name = input.name.trim().replace(/\s+/g, ' ');
  const nameKey = componentNameKey(name);
  if (!nameKey || name.length > 120) throw new Error('Ingresa un nombre de hasta 120 caracteres que contenga letras o números.');
  if (!input.areaId || !input.sectorId || !input.equipmentId) throw new Error('Selecciona el área, sector y equipo antes de agregar un componente.');
  if (actor.allowedAreaIds?.length && !actor.allowedAreaIds.includes(input.areaId)) throw new Error('No tienes acceso a esta área.');
  const tenantId = actor.tenantId || 'tenant_cmz';

  // Include legacy records with random IDs and components shared by a sector.
  // Server reads avoid deciding from a stale/offline catalogue.
  const catalogue = await getDocsFromServer(query(collection(database, 'sub_sectors'), where('tenantId', '==', tenantId)));
  const existingComponents = catalogue.docs.map(snapshot => ({ ...(snapshot.data().payload || snapshot.data()), id: snapshot.id }) as SubSector);
  const componentRef = doc(database, 'sub_sectors', `${input.equipmentId}::${nameKey}`);
  const auditRef = doc(collection(database, 'audit_logs'));

  return runTransaction(database, async transaction => {
    const equipmentSnapshot = await transaction.get(doc(database, 'equipments', input.equipmentId));
    const sectorSnapshot = await transaction.get(doc(database, 'sectors', input.sectorId));
    const areaSnapshot = await transaction.get(doc(database, 'plant_areas', input.areaId));
    const componentSnapshot = await transaction.get(componentRef);
    if (!equipmentSnapshot.exists() || !sectorSnapshot.exists() || !areaSnapshot.exists()) throw new Error('El área, sector o equipo ya no existe. Actualiza la selección.');
    const equipment = { ...(equipmentSnapshot.data().payload || equipmentSnapshot.data()), id: equipmentSnapshot.id } as PlantEquipment;
    const sector = { ...(sectorSnapshot.data().payload || sectorSnapshot.data()), id: sectorSnapshot.id } as Sector;
    const area = { ...(areaSnapshot.data().payload || areaSnapshot.data()), id: areaSnapshot.id } as PlantArea;
    if ([equipmentSnapshot, sectorSnapshot, areaSnapshot].some(snapshot => snapshot.data()?.tenantId !== tenantId)
      || !(equipment.sectorId ? equipment.sectorId === sector.id : equipment.sectorName === sector.name)
      || !(sector.areaId ? sector.areaId === area.id : sector.areaName === area.name)) {
      throw new Error('El equipo no pertenece al área y sector seleccionados. Revisa la selección.');
    }
    if (componentSnapshot.exists()) {
      const component = { ...(componentSnapshot.data().payload || componentSnapshot.data()), id: componentSnapshot.id } as SubSector;
      // A renamed or moved deterministic record must never be silently reused.
      if (component.equipmentId !== equipment.id || componentNameKey(component.name) !== nameKey) throw new Error('El catálogo cambió. Actualiza la página antes de crear este componente.');
      return { component, created: false };
    }
    const duplicate = componentsForEquipment(existingComponents, equipment, sector).find(component => componentNameKey(component.name) === nameKey);
    if (duplicate) {
      const snapshot = await transaction.get(doc(database, 'sub_sectors', duplicate.id));
      if (snapshot.exists()) {
        const current = { ...(snapshot.data().payload || snapshot.data()), id: snapshot.id } as SubSector;
        if (componentsForEquipment([current], equipment, sector).some(component => componentNameKey(component.name) === nameKey)) {
          return { component: current, created: false };
        }
      }
    }
    const component: SubSector = {
      id: componentRef.id, tenantId, areaId: area.id,
      sectorId: sector.id, sectorName: sector.name,
      equipmentId: equipment.id, equipmentName: equipment.name,
      name, nameKey, code: `CMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      createdById: actor.id, createdByName: actor.name, creationSource: 'wizard', auditId: auditRef.id,
    };
    transaction.set(componentRef, { ...component, createdAt: serverTimestamp() });
    transaction.set(auditRef, {
      id: auditRef.id, tenantId, contractId: actor.contractId || 'c1', areaId: area.id,
      userId: actor.id, userName: actor.name, userRole: actor.role,
      action: 'CREACION', entityName: 'Componente de equipo', entityId: component.id,
      timestamp: new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' }),
      recordedAt: new Date().toISOString(), serverRecordedAt: serverTimestamp(),
      details: `Componente «${name}» creado desde el wizard en ${area.name} / ${sector.name} / ${equipment.name}.`,
    });
    return { component, created: true };
  });
}
