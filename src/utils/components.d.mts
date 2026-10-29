import type { PlantEquipment, Sector, SubSector } from '../types';
export function componentNameKey(name: string): string;
export function componentsForEquipment(components: SubSector[], equipment?: PlantEquipment, sector?: Sector): SubSector[];
export function selectedComponentIds(names: string[], available: SubSector[], previousIds?: string[], previousNames?: string[]): string[];
