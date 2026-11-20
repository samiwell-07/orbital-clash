import type { Emit, Unit, UnitKind, World } from '@/types';

/** Return true when the hook handled the arrival itself (the default base hit is then skipped). */
export type ArrivalHook = (w: World, unit: Unit, emit: Emit) => boolean;
/** Runs each tick for living units of the kind, before default movement. Return true to skip default movement. */
export type UnitBehavior = (w: World, unit: Unit, dt: number, emit: Emit) => boolean;

const arrivalHooks = new Map<UnitKind, ArrivalHook>();
const behaviors = new Map<UnitKind, UnitBehavior>();

/** One hook per kind (a later registration replaces the earlier). Returns an unregister fn. */
export function registerArrivalHook(kind: UnitKind, fn: ArrivalHook): () => void {
  arrivalHooks.set(kind, fn);
  return () => {
    if (arrivalHooks.get(kind) === fn) arrivalHooks.delete(kind);
  };
}

export function registerUnitBehavior(kind: UnitKind, fn: UnitBehavior): () => void {
  behaviors.set(kind, fn);
  return () => {
    if (behaviors.get(kind) === fn) behaviors.delete(kind);
  };
}

export function getArrivalHook(kind: UnitKind): ArrivalHook | undefined {
  return arrivalHooks.get(kind);
}

export function getUnitBehavior(kind: UnitKind): UnitBehavior | undefined {
  return behaviors.get(kind);
}

export function hasUnitBehaviors(): boolean {
  return behaviors.size > 0;
}

export function clearArmyHooks(): void {
  arrivalHooks.clear();
  behaviors.clear();
}
