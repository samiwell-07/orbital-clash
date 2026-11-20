import type { PlayerId, StructureKind, Unit, World } from '@/types';
import { isUnlocked } from '@/data';
import { inBounds, isTerrainBlocked, occupantAt, wouldBlockPath } from '@/sim/core';
import { structureInfo } from './info';

export interface BuildCheck {
  ok: boolean;
  /** Empty when ok. */
  reason: string;
}

const OK: BuildCheck = { ok: true, reason: '' };
const no = (reason: string): BuildCheck => ({ ok: false, reason });

/** Why a tile cannot take anything (bounds, terrain, structure, a base), or null when it is free. */
export function tileProblem(w: World, tx: number, ty: number): string | null {
  if (!inBounds(w.grid, tx, ty)) return 'out of bounds';
  if (isTerrainBlocked(w.grid, tx, ty)) return 'terrain blocked';
  if (occupantAt(w.grid, tx, ty) !== 0) return 'tile occupied';
  for (const p of w.players) if (p.baseBuilt && p.baseTx === tx && p.baseTy === ty) return 'tile occupied';
  return null;
}

/** Friendly (same team) ground units standing on a tile; building there destroys them (patch 1.01). */
export function friendlyUnitsOn(w: World, player: PlayerId, tx: number, ty: number): Unit[] {
  const team = w.players[player].team;
  return w.units.filter(
    (u) =>
      u.state !== 'dead' && u.layer === 'ground' && w.players[u.owner].team === team &&
      Math.floor(u.x) === tx && Math.floor(u.y) === ty,
  );
}

export function canBuild(w: World, player: PlayerId, kind: StructureKind, tx: number, ty: number): BuildCheck {
  const p = w.players[player];
  if (!p || !p.alive) return no('player not active');
  const info = structureInfo(kind);
  if (!info) return no('unknown structure');
  const problem = tileProblem(w, tx, ty);
  if (problem) return no(problem);
  if (info.profile === 'bionic' && w.settings.profile !== 'bionic') return no('not available in this ruleset');
  if (!p.baseBuilt) return no('build your base first');
  if (!isUnlocked(p.tech, info.requires)) return no('not unlocked');
  if (p.thorium < info.buildCost) return no('not enough thorium');
  for (const target of w.players) {
    if (target.alive && target.baseBuilt && wouldBlockPath(w, tx, ty, target.id)) return no('would block the path');
  }
  return OK;
}

/** Can the player's base go on this tile? */
export function canBuildBase(w: World, player: PlayerId, tx: number, ty: number): BuildCheck {
  const p = w.players[player];
  if (!p || !p.alive) return no('player not active');
  if (p.baseBuilt) return no('base already built');
  const problem = tileProblem(w, tx, ty);
  return problem ? no(problem) : OK;
}
