import type { Intent, NewGameOptions, PlayerId, StructureKind, World } from '@/types';
import { DEFS, UNIT_DEFS, isUnlocked } from '@/data';
import { structureInfo } from '@/sim/build/info';
import { addStructure, structureAt } from '@/sim/core/entities';
import { isBlocked } from '@/sim/core/grid';
import { pathExists, wouldBlockPath } from '@/sim/core/flow';
import { createWorld } from '@/sim/core/worldFactory';
import { battleInitSystem } from '@/sim/modes/battle/systems';
import { startBattle, type BattleSetup } from '@/sim/modes/battle/setup';

export function battleWorld(over: Partial<BattleSetup> = {}): { w: World; opts: NewGameOptions } {
  const opts = startBattle({
    mapId: 'battle-kreios-crater',
    players: [
      { id: 0, team: 0, controller: 'adaptive' },
      { id: 1, team: 1, controller: 'adaptive' },
    ],
    seed: 77,
    ...over,
  });
  const w = createWorld(opts);
  battleInitSystem(w, 0, () => {});
  return { w, opts };
}

export interface Applied {
  violations: string[];
  intents: Intent[];
}

function cost(kind: StructureKind): number {
  return DEFS.support(kind).buildCost;
}

/**
 * Minimal rule enforcement mirroring the build module: records a violation for any intent a human
 * could not legally issue (overspending, occupied tile, sealed path, locked tech), else applies it.
 */
export function applyIntent(w: World, it: Intent, out: Applied): void {
  out.intents.push(it);
  const bad = (m: string): void => {
    out.violations.push(`${it.t}: ${m}`);
  };
  if (it.t === 'buildBase') {
    if (w.players[it.player].baseBuilt || isBlocked(w.grid, it.tx, it.ty)) return bad('illegal base tile');
    const p = w.players[it.player];
    p.baseTx = it.tx;
    p.baseTy = it.ty;
    p.baseBuilt = true;
  } else if (it.t === 'build') {
    const p = w.players[it.player];
    const def = DEFS.support(it.kind);
    if (!p.baseBuilt) return bad('no base');
    if (isBlocked(w.grid, it.tx, it.ty)) return bad('tile blocked');
    if (p.thorium < def.buildCost) return bad(`overspend ${def.buildCost} > ${p.thorium}`);
    if (!isUnlocked(p.tech, def.requires)) return bad('locked tech');
    for (const q of w.players) if (q.alive && q.baseBuilt && wouldBlockPath(w, it.tx, it.ty, q.id)) return bad('blocks path');
    p.thorium -= cost(it.kind);
    const s = addStructure(w, { kind: it.kind, owner: it.player, tx: it.tx, ty: it.ty, hp: def.hp });
    s.output = it.kind === 'basicOps' ? 'scout' : it.kind === 'specialOps' ? 'hammer' : null;
  } else if (it.t === 'upgrade') {
    const s = structureAt(w, it.tx, it.ty);
    const p = w.players[it.player];
    if (!s || s.owner !== it.player) return bad('nothing to upgrade');
    const def = structureInfo(s.kind);
    if (!def || s.level >= def.maxLevel) return bad('max level');
    const c = def.upgradeCost[s.level];
    if (p.thorium < c) return bad(`overspend upgrade ${c} > ${p.thorium}`);
    p.thorium -= c;
    s.level++;
  } else if (it.t === 'repair') {
    const s = structureAt(w, it.tx, it.ty);
    if (!s || s.owner !== it.player) return bad('nothing to repair');
  } else if (it.t === 'cycleOutput') {
    const s = structureAt(w, it.tx, it.ty);
    if (!s || s.owner !== it.player || (s.kind !== 'basicOps' && s.kind !== 'specialOps')) return bad('not a tower');
    if (s.kind === 'basicOps') {
      const list = DEFS.basicOutputsFor(s.level).filter((k) => isUnlocked(w.players[it.player].tech, UNIT_DEFS[k].requires));
      s.output = list[(list.indexOf(s.output as 'scout') + 1) % list.length];
    }
  } else if (it.t === 'attackSelect') {
    w.players[it.player].attack.selected = it.kind;
  } else if (it.t === 'attackLock') {
    const a = w.players[it.player].attack;
    a.locked = it.locked;
    if (!it.locked) a.selected = null;
  } else if (it.t === 'cycleTarget') {
    const a = w.players[it.player].attack;
    const me = w.players[it.player];
    for (let i = 1; i <= 4; i++) {
      const t = ((a.targetPlayer + i) % 4) as PlayerId;
      if (w.players[t].alive && w.players[t].team !== me.team) {
        a.targetPlayer = t;
        break;
      }
    }
  }
}

/** Every pair of hostile bases must stay connected for ground units. */
export function allPathsOpen(w: World): boolean {
  for (const a of w.players) {
    for (const b of w.players) {
      if (a.id === b.id || !a.alive || !b.alive || !a.baseBuilt || !b.baseBuilt || a.team === b.team) continue;
      if (!pathExists(w, { tx: a.baseTx, ty: a.baseTy }, { tx: b.baseTx, ty: b.baseTy })) return false;
    }
  }
  return true;
}
