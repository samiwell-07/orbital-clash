import type { PlayerId, UnitKind, World } from '../../types';
import { BASIC_UNITS, BIONIC_UNITS, SPECIAL_UNITS } from '../../types';
import { UNIT_DEFS, isUnlocked, researchDef } from '../../data';
import { pipsFor, sumStored, type Pips } from '../format';

export interface AttackSlot {
  kind: UnitKind;
  name: string;
  count: number;
  pips: Pips;
  locked: boolean;
  lockReason: string | null;
  /** The sim is releasing this unit type right now. */
  selected: boolean;
}

/** Radial order, clockwise from the top: basic units, then specials, then Bionic units. Wire into `getAttackUnits`. */
export function attackKindsFor(world: World): UnitKind[] {
  return [...BASIC_UNITS, ...SPECIAL_UNITS, ...(world.settings.profile === 'bionic' ? BIONIC_UNITS : [])];
}

export function attackSlotsFor(world: World, player: PlayerId): AttackSlot[] {
  const p = world.players[player];
  return attackKindsFor(world).map((kind) => {
    const d = UNIT_DEFS[kind];
    const locked = !isUnlocked(p?.tech ?? {}, d.requires);
    const count = p?.stored[kind] ?? 0;
    return {
      kind,
      name: d.name,
      count,
      pips: pipsFor(count),
      locked,
      lockReason: locked && d.requires ? `Requires ${researchDef(d.requires)?.name ?? d.requires}` : null,
      selected: p?.attack.selected === kind,
    };
  });
}

/** Enemy players this player can target (alive, other team); target cycling order starts after `current`. */
export function targetCandidates(world: World, player: PlayerId): PlayerId[] {
  const me = world.players[player];
  return world.players.filter((q) => q.id !== player && q.alive && q.team !== me?.team).map((q) => q.id);
}

export function totalStored(world: World, player: PlayerId): number {
  return sumStored(world.players[player]?.stored ?? {});
}

/** Angle (radians, 0 = up, clockwise) of slot i of n; matches the input layer's stick sectors. */
export function slotAngle(i: number, n: number): number {
  return (i / Math.max(1, n)) * Math.PI * 2;
}
