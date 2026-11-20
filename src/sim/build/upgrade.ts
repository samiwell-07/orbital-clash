import type { Emit, Intent, World } from '@/types';
import { structureAt } from '@/sim/core';
import { spendThorium } from '@/sim/economy/thorium';
import { deny } from './place';
import { maxHpAt, structureInfo } from './info';

/** Level +1 for the structure at the tile. Research Labs fall through to the economy research handler. */
export function handleUpgrade(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'upgrade') return false;
  const s = structureAt(w, intent.tx, intent.ty);
  if (s && s.kind === 'researchLab') return false;
  const player = intent.player;
  const info = s ? structureInfo(s.kind) : null;
  if (!s || !info || s.owner !== player) {
    deny(emit, player, 'nothing to upgrade');
    return true;
  }
  if (s.level >= info.maxLevel) {
    deny(emit, player, 'max level');
    return true;
  }
  if (!spendThorium(w, player, info.upgradeCost[s.level])) {
    deny(emit, player, 'not enough thorium');
    return true;
  }
  const gain = maxHpAt(info, s.level + 1) - maxHpAt(info, s.level);
  s.level++;
  s.maxHp += gain;
  s.hp += gain;
  emit({ t: 'structureUpgraded', id: s.id, level: s.level });
  return true;
}
