import type { Emit, Unit, World } from '@/types';
import { UNIT_DEFS } from '@/data';
import { addUnit, isBlocked } from '@/sim/core';
import { consumeUnit, registerDeathHook } from '@/sim/combat/damage';
import { registerArrivalHook } from '@/sim/army/hooks';
import { CARGO_KIND, CARRIER_CAP } from './tuning';

const RING: readonly (readonly [number, number])[] = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 0], [-2, 0], [0, 2], [0, -2],
];

/** Drops the carrier's cargo (`aux` units, capped) as ground units on free tiles next to it. */
export function unloadCargo(w: World, carrier: Unit): number {
  const n = Math.max(0, Math.min(Math.floor(carrier.aux), CARRIER_CAP));
  carrier.aux = 0;
  const def = UNIT_DEFS[CARGO_KIND];
  const tx = Math.floor(carrier.x);
  const ty = Math.floor(carrier.y);
  const spots = RING.filter(([dx, dy]) => !isBlocked(w.grid, tx + dx, ty + dy));
  for (let i = 0; i < n; i++) {
    const [dx, dy] = spots.length > 0 ? spots[i % spots.length] : [0, 0];
    addUnit(w, {
      kind: CARGO_KIND, owner: carrier.owner, targetPlayer: carrier.targetPlayer,
      x: tx + dx + 0.3 + 0.4 * ((i * 0.618) % 1), y: ty + dy + 0.3 + 0.4 * ((i * 0.382) % 1),
      hp: def.hp, maxHp: def.hp, layer: def.layer, state: 'marching',
    });
  }
  return n;
}

/** Carrier reaching the enemy base unloads its cargo and is consumed (cargo applies its own base hits). */
export function carrierArrival(w: World, u: Unit, emit: Emit): boolean {
  unloadCargo(w, u);
  consumeUnit(u, emit);
  return true;
}

/** A shot-down Carrier drops its survivors where it fell. */
export function carrierDeath(w: World, u: Unit, _emit: Emit): void {
  if (u.kind === 'carrier' && u.aux > 0) unloadCargo(w, u);
}

export function registerCarrier(): void {
  registerArrivalHook('carrier', carrierArrival);
  registerDeathHook(carrierDeath);
}
