import type { Emit, Intent, PlayerId, Structure, StructureKind, World } from '@/types';
import { addStructure, rebuildFlow } from '@/sim/core';
import { spendThorium } from '@/sim/economy/thorium';
import { canBuild, canBuildBase, friendlyUnitsOn } from './rules';
import { structureInfo } from './info';
import { defaultOutput } from './outputs';

export function deny(emit: Emit, player: PlayerId, reason: string): void {
  emit({ t: 'denied', owner: player, reason });
}

/** Validates, charges and places a structure. Emits 'denied' and returns null when refused. */
export function placeStructure(
  w: World, player: PlayerId, kind: StructureKind, tx: number, ty: number, emit: Emit,
): Structure | null {
  const check = canBuild(w, player, kind, tx, ty);
  const info = structureInfo(kind);
  if (!check.ok || !info) {
    deny(emit, player, check.reason);
    return null;
  }
  spendThorium(w, player, info.buildCost);
  for (const u of friendlyUnitsOn(w, player, tx, ty)) {
    u.state = 'dead';
    w.players[u.owner].stats.unitsLost++;
    emit({ t: 'unitDied', id: u.id, kind: u.kind, owner: u.owner, x: u.x, y: u.y, killer: -1 });
  }
  const p = w.players[player];
  const s = addStructure(w, {
    kind, owner: player, tx, ty, level: 0, hp: info.hp, maxHp: info.hp, buildProgress: 0,
    output: defaultOutput(p.tech, kind), scripted: p.controller === 'script',
  });
  p.stats.structuresBuilt++;
  emit({ t: 'structureBuilt', id: s.id, kind, owner: player, tx, ty });
  return s;
}

/** Places the player's base (no cost) and rebuilds the flow field that leads to it. */
export function placeBase(w: World, player: PlayerId, tx: number, ty: number, emit: Emit): boolean {
  const check = canBuildBase(w, player, tx, ty);
  if (!check.ok) {
    deny(emit, player, check.reason);
    return false;
  }
  const p = w.players[player];
  p.baseTx = tx;
  p.baseTy = ty;
  p.baseBuilt = true;
  rebuildFlow(w, player);
  emit({ t: 'baseBuilt', owner: player, tx, ty });
  return true;
}

export function handlePlace(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t === 'build') {
    placeStructure(w, intent.player, intent.kind, intent.tx, intent.ty, emit);
    return true;
  }
  if (intent.t === 'buildBase') {
    placeBase(w, intent.player, intent.tx, intent.ty, emit);
    return true;
  }
  return false;
}
