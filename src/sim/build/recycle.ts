import type { Emit, Intent, Structure, World } from '@/types';
import { DEFS } from '@/data';
import { removeStructure, structureAt } from '@/sim/core';
import { deny } from './place';
import { structureInfo, upgradeSpend } from './info';

/** Refund for recycling now: (build cost + upgrades paid) scaled by remaining health. */
export function recycleValue(s: Structure): number {
  const info = structureInfo(s.kind);
  if (!info) return 0;
  return Math.round((info.buildCost + upgradeSpend(info, s.level)) * DEFS.recycleRatio(s.hp, s.maxHp));
}

/** Refunds are not counted as thorium earned (stats), only credited. */
export function handleRecycle(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'recycle') return false;
  const s = structureAt(w, intent.tx, intent.ty);
  if (!s || s.owner !== intent.player) {
    deny(emit, intent.player, 'nothing to recycle');
    return true;
  }
  const refund = recycleValue(s);
  removeStructure(w, s.id);
  w.players[s.owner].thorium += refund;
  emit({ t: 'thorium', owner: s.owner, amount: refund });
  emit({ t: 'structureRecycled', id: s.id, refund, owner: s.owner });
  return true;
}
