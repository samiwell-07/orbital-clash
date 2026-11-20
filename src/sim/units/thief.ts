import type { Emit, Unit, World } from '@/types';
import { consumeUnit } from '@/sim/combat/damage';
import { hostile } from '@/sim/combat/targeting';
import { registerArrivalHook } from '@/sim/army/hooks';
import { addThorium } from '@/sim/economy/thorium';
import { THIEF_LOOT } from './tuning';

/**
 * Thief: on reaching an enemy base it lifts up to THIEF_LOOT thorium (kept in `aux` for the
 * record) and delivers it straight to its owner, then is consumed. No base hit.
 */
export function thiefArrival(w: World, u: Unit, emit: Emit): boolean {
  const victim = w.players[u.targetPlayer];
  if (!victim || !hostile(w, u.owner, u.targetPlayer)) return false;
  const loot = Math.max(0, Math.min(victim.thorium, THIEF_LOOT));
  victim.thorium -= loot;
  u.aux = loot;
  if (loot > 0) addThorium(w, u.owner, loot, emit);
  consumeUnit(u, emit);
  return true;
}

export function registerThief(): void {
  registerArrivalHook('thief', thiefArrival);
}
