import type { Emit, Intent, Structure, World } from '@/types';
import { DEFS } from '@/data';
import { structureAt } from '@/sim/core';
import { spendThorium } from '@/sim/economy/thorium';
import { deny } from './place';
import { structureInfo } from './info';

export function repairCostOf(s: Structure): number {
  const info = structureInfo(s.kind);
  if (!info) return 0;
  return Math.ceil(DEFS.repairCost(info.buildCost, s.hp, s.maxHp) - 1e-9);
}

export function handleRepair(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'repair') return false;
  const s = structureAt(w, intent.tx, intent.ty);
  if (!s || s.owner !== intent.player) {
    deny(emit, intent.player, 'nothing to repair');
    return true;
  }
  if (s.hp >= s.maxHp) {
    deny(emit, intent.player, 'already at full health');
    return true;
  }
  const cost = repairCostOf(s);
  if (!spendThorium(w, s.owner, cost)) {
    deny(emit, intent.player, 'not enough thorium');
    return true;
  }
  s.hp = s.maxHp;
  emit({ t: 'structureRepaired', id: s.id, cost });
  return true;
}
