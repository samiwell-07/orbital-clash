import type { UnitKind } from '@/types';

export type UnitStock = Partial<Record<UnitKind, number>>;

const seeds = new Map<string, UnitStock>();

/** Starting stored army of the scripted enemy, by mission id (units already waiting in its base). */
export function registerSeed(missionId: string, stock: UnitStock): void {
  seeds.set(missionId, stock);
}

export function seedFor(missionId: string): UnitStock {
  return seeds.get(missionId) ?? {};
}
