import type { Emit, PlayerId, ScriptAction, StructureGroup, StructureKind, UnitKind, World } from '@/types';
import { ALL_UNITS, WEAPONS } from '@/types';
import { ALL_TECH_KEYS, SPAWN_TOWER_DEFS, SUPPORT_DEFS, UNIT_DEFS, WEAPON_DEFS, isUnlocked } from '@/data';
import { addStructure, isTerrainBlocked, occupantAt, structureAt, wouldBlockPath } from '@/sim/core';
import { HP_PER_LEVEL } from '@/sim/build/info';
import { campaignState, humanIds } from './state';

/** Launches `count` units already drained from the owner's stored counts (bound to the army-snake API). */
export type ReleaseHandler = (w: World, owner: PlayerId, kind: UnitKind, count: number, emit: Emit) => void;

let releaseHandler: ReleaseHandler | null = null;

export function setReleaseHandler(fn: ReleaseHandler | null): void {
  releaseHandler = fn;
}

export interface StructureRules {
  buildCost: number;
  hp: number;
  requires: string | null;
  maxLevel: number;
  upgradeCost: readonly number[];
  tower: boolean;
  bionicOnly: boolean;
}

export function structureRules(kind: StructureKind): StructureRules {
  if (kind === 'basicOps' || kind === 'specialOps') {
    const d = SPAWN_TOWER_DEFS[kind];
    return { ...d, tower: true, bionicOnly: false };
  }
  if (kind in WEAPON_DEFS) {
    const d = WEAPON_DEFS[kind as keyof typeof WEAPON_DEFS];
    return { ...d, tower: false, bionicOnly: false };
  }
  const d = SUPPORT_DEFS[kind as keyof typeof SUPPORT_DEFS];
  return {
    ...d, maxLevel: d.maxLevel ?? 0, upgradeCost: d.upgradeCost ?? [], tower: false, bionicOnly: d.profile === 'bionic',
  };
}

/** Build cost plus every upgrade paid to reach `level`. */
export function costAtLevel(r: StructureRules, level: number): number {
  return r.buildCost + r.upgradeCost.slice(0, level).reduce((a, b) => a + b, 0);
}

export function allowedOutputs(kind: StructureKind, level: number): readonly UnitKind[] {
  if (kind !== 'basicOps' && kind !== 'specialOps') return [];
  const lv = SPAWN_TOWER_DEFS[kind].outputsByLevel;
  return lv[Math.min(lv.length - 1, Math.max(0, level))];
}

export interface PlaceSpec {
  kind: StructureKind;
  tx: number;
  ty: number;
  level?: number;
  output?: UnitKind;
}

/** Preplaced structures skip tech and cost checks; scripted builds enforce them. Both never seal a human base. */
export interface PlaceOpts {
  strict: boolean;
}

/** Places a structure directly (no ship, no build animation). Returns an error text or null. */
export function placeStructure(w: World, owner: PlayerId, spec: PlaceSpec, opts: PlaceOpts, emit: Emit): string | null {
  const { kind, tx, ty } = spec;
  const where = `${kind} at (${tx},${ty})`;
  if (isTerrainBlocked(w.grid, tx, ty)) return `${where}: tile is rock, crater or out of bounds`;
  if (occupantAt(w.grid, tx, ty) !== 0) return `${where}: tile is occupied`;
  const r = structureRules(kind);
  const level = spec.level ?? 0;
  if (!Number.isInteger(level) || level < 0 || level > r.maxLevel) return `${where}: invalid level ${level}`;
  const p = w.players[owner];
  const output = spec.output ?? (kind === 'basicOps' ? 'scout' : kind === 'specialOps' ? 'hammer' : undefined);
  if (output !== undefined) {
    if (!allowedOutputs(kind, level).includes(output)) return `${where}: output ${output} not available at level ${level}`;
    if (opts.strict && !isUnlocked(p.tech, UNIT_DEFS[output].requires)) {
      return `${where}: output ${output} needs tech ${UNIT_DEFS[output].requires}`;
    }
  }
  if (opts.strict) {
    if (!isUnlocked(p.tech, r.requires)) return `${where}: needs tech ${r.requires}`;
    if (r.bionicOnly && w.settings.profile === 'base') return `${where}: bionic-profile structure`;
    const cost = costAtLevel(r, level);
    if (p.thorium < cost) return `${where}: costs ${cost} thorium but ${p.thorium} available`;
  }
  for (const h of humanIds(w)) {
    if (w.players[h].baseBuilt && wouldBlockPath(w, tx, ty, h)) return `${where}: would seal a path to a base`;
  }
  if (opts.strict) p.thorium -= costAtLevel(r, level);
  const s = addStructure(w, {
    kind, owner, tx, ty, level, hp: r.hp, maxHp: r.hp, output: output ?? null, scripted: p.controller === 'script',
  });
  p.stats.structuresBuilt++;
  if (s.scripted) campaignState(w).enemyPlaced++;
  emit({ t: 'structureBuilt', id: s.id, kind, owner, tx, ty });
  return null;
}

export interface ExecCtx {
  /** Dry runs (compile) validate and mutate a scratch world but never launch units. */
  dry: boolean;
}

function release(w: World, owner: PlayerId, a: Extract<ScriptAction, { a: 'release' }>, ctx: ExecCtx, emit: Emit): string | null {
  const p = w.players[owner];
  if (!ctx.dry && !releaseHandler) return 'release: no release handler bound (setReleaseHandler)';
  if (a.kind === 'all' && a.count !== 'all') return 'release: kind "all" requires count "all"';
  const kinds = a.kind === 'all' ? ALL_UNITS.filter((k) => (p.stored[k] ?? 0) > 0) : [a.kind];
  if (kinds.length === 0) return 'release: no stored units to release';
  const taken: [UnitKind, number][] = [];
  for (const k of kinds) {
    const have = p.stored[k] ?? 0;
    const n = a.count === 'all' ? have : a.count;
    if (!Number.isInteger(n) || n <= 0) return `release ${k}: invalid count ${String(a.count)}`;
    if (n > have) return `release ${k}: wants ${n} but only ${have} stored`;
    taken.push([k, n]);
  }
  if (!ctx.dry) aimRelease(w, owner);
  for (const [k, n] of taken) {
    p.stored[k] = (p.stored[k] ?? 0) - n;
    if (!ctx.dry && releaseHandler) releaseHandler(w, owner, k, n, emit);
  }
  return null;
}

/**
 * Co-op: scripted releases take turns between the living hostile bases (ascending player id), one
 * release event each, so every human base faces waves. With a single human this is always that base.
 */
function aimRelease(w: World, owner: PlayerId): void {
  const p = w.players[owner];
  const targets = w.players.filter((q) => q.id !== owner && q.alive && q.baseBuilt && q.team !== p.team);
  if (targets.length === 0) return;
  const st = campaignState(w);
  p.attack.targetPlayer = targets[st.releaseCursor % targets.length].id;
  st.releaseCursor++;
}

/**
 * Runs one scripted action. Returns an error text (a missing prerequisite) or null. Never skips silently,
 * except the burst actions (upgradeAll, rebuildAll, setOutputAll), which by design act on whatever the
 * humans left standing and cannot fail on well-formed input.
 */
export function executeAction(w: World, owner: PlayerId, a: ScriptAction, ctx: ExecCtx, emit: Emit): string | null {
  const p = w.players[owner];
  if (!p) return `player ${owner} does not exist`;
  if (a.a === 'unlock') {
    if (!ALL_TECH_KEYS.includes(a.key)) return `unlock: unknown tech key "${a.key}"`;
    p.tech[a.key] = true;
    emit({ t: 'techUnlocked', owner, key: a.key });
    return null;
  }
  if (a.a === 'message') {
    emit({ t: 'message', text: a.text, owner });
    return null;
  }
  if (a.a === 'objective') {
    campaignState(w).objectives.push({ id: a.id, text: a.text, atSec: w.timeSec });
    emit({ t: 'message', text: a.text, owner: -1 });
    return null;
  }
  if (p.controller !== 'script') return `${a.a}: player ${owner} is not script-controlled`;
  switch (a.a) {
    case 'build':
      return placeStructure(w, owner, a, { strict: true }, emit);
    case 'grantThorium':
      if (!Number.isFinite(a.amount) || a.amount <= 0) return `grantThorium: invalid amount ${a.amount}`;
      p.thorium += a.amount;
      emit({ t: 'thorium', owner, amount: a.amount });
      return null;
    case 'release':
      return release(w, owner, a, ctx, emit);
    case 'upgradeAll':
      return upgradeAll(w, owner, a, emit);
    case 'rebuildAll':
      return rebuildAll(w, owner, a, emit);
    case 'setOutputAll':
      return setOutputAll(w, owner, a, emit);
    default:
      return upgradeOrOutput(w, owner, a, emit);
  }
}

function upgradeOrOutput(
  w: World, owner: PlayerId, a: Extract<ScriptAction, { a: 'upgrade' | 'setOutput' }>, emit: Emit,
): string | null {
  const p = w.players[owner];
  const s = structureAt(w, a.tx, a.ty);
  const where = `${a.a} at (${a.tx},${a.ty})`;
  if (!s || s.owner !== owner) return `${where}: no structure of player ${owner} there`;
  const r = structureRules(s.kind);
  if (a.a === 'upgrade') {
    if (s.level >= r.maxLevel) return `${where}: ${s.kind} is already at max level`;
    const cost = r.upgradeCost[s.level];
    if (p.thorium < cost) return `${where}: costs ${cost} thorium but ${p.thorium} available`;
    p.thorium -= cost;
    s.level++;
    emit({ t: 'structureUpgraded', id: s.id, level: s.level });
    return null;
  }
  if (!r.tower) return `${where}: ${s.kind} has no output`;
  if (!allowedOutputs(s.kind, s.level).includes(a.output)) return `${where}: output ${a.output} not available at level ${s.level}`;
  if (!isUnlocked(p.tech, UNIT_DEFS[a.output].requires)) return `${where}: output ${a.output} needs tech ${UNIT_DEFS[a.output].requires}`;
  s.output = a.output;
  return null;
}
function inGroup(kind: StructureKind, group: StructureGroup): boolean {
  if (group === 'weapons') return (WEAPONS as readonly string[]).includes(kind);
  if (group === 'towers') return kind === 'basicOps' || kind === 'specialOps';
  return kind === group;
}

function knownGroup(group: string): boolean {
  return group === 'weapons' || group === 'towers' || group === 'basicOps' || group === 'specialOps' ||
    group in WEAPON_DEFS || group in SUPPORT_DEFS;
}

/** Burst upgrade: self-funded (exact grant first), tolerant of structures the humans destroyed. */
function upgradeAll(w: World, owner: PlayerId, a: Extract<ScriptAction, { a: 'upgradeAll' }>, emit: Emit): string | null {
  if (!knownGroup(a.kind)) return `upgradeAll: unknown structure kind "${String(a.kind)}"`;
  if (a.max !== undefined && (!Number.isInteger(a.max) || a.max < 0)) return `upgradeAll: invalid max ${a.max}`;
  if (a.cap !== undefined && (!Number.isInteger(a.cap) || a.cap < 0)) return `upgradeAll: invalid cap ${a.cap}`;
  const cap = a.cap ?? Infinity;
  const picked = [...w.structures.values()]
    .filter((s) => s.owner === owner && inGroup(s.kind, a.kind) && s.level < Math.min(cap, structureRules(s.kind).maxLevel))
    .sort((x, y) => x.level - y.level || x.id - y.id)
    .slice(0, a.max ?? Infinity);
  if (picked.length === 0) return null;
  const p = w.players[owner];
  const amount = picked.reduce((n, s) => n + structureRules(s.kind).upgradeCost[s.level], 0);
  if (amount > 0) {
    p.thorium += amount;
    emit({ t: 'thorium', owner, amount });
  }
  for (const s of picked) {
    const r = structureRules(s.kind);
    p.thorium -= r.upgradeCost[s.level];
    const gain = Math.round(r.hp * (1 + HP_PER_LEVEL * (s.level + 1))) - Math.round(r.hp * (1 + HP_PER_LEVEL * s.level));
    s.level++;
    s.maxHp += gain;
    s.hp += gain;
    emit({ t: 'structureUpgraded', id: s.id, level: s.level });
  }
  if (a.text) emit({ t: 'message', text: a.text, owner });
  return null;
}

/** Burst rebuild: free re-placement of the owner's original structures on tiles that are free and safe again. */
function rebuildAll(w: World, owner: PlayerId, a: Extract<ScriptAction, { a: 'rebuildAll' }>, emit: Emit): string | null {
  const originals = (w.settings.mission?.preplaced ?? []).filter((s) => s.owner === owner);
  let rebuilt = 0;
  for (const s of originals) {
    if (isTerrainBlocked(w.grid, s.tx, s.ty) || occupantAt(w.grid, s.tx, s.ty) !== 0) continue;
    if (w.players.some((q) => q.baseBuilt && q.baseTx === s.tx && q.baseTy === s.ty)) continue;
    if (w.units.some((u) => u.state !== 'dead' && u.layer === 'ground' && Math.floor(u.x) === s.tx && Math.floor(u.y) === s.ty)) continue;
    if (wouldBlockPath(w, s.tx, s.ty, owner)) continue;
    // placeStructure re-checks every human base path; a refusal there is a silent skip, not an error.
    if (placeStructure(w, owner, s, { strict: false }, emit) === null) rebuilt++;
  }
  if (rebuilt > 0 && a.text) emit({ t: 'message', text: a.text, owner });
  return null;
}

function setOutputAll(w: World, owner: PlayerId, a: Extract<ScriptAction, { a: 'setOutputAll' }>, emit: Emit): string | null {
  if (a.kind !== 'basicOps' && a.kind !== 'specialOps') return `setOutputAll: ${String(a.kind)} has no output`;
  if (!UNIT_DEFS[a.output]) return `setOutputAll: unknown unit "${String(a.output)}"`;
  const p = w.players[owner];
  if (!isUnlocked(p.tech, UNIT_DEFS[a.output].requires)) return `setOutputAll: output ${a.output} needs tech ${UNIT_DEFS[a.output].requires}`;
  let changed = 0;
  for (const s of w.structures.values()) {
    if (s.owner !== owner || s.kind !== a.kind || s.output === a.output) continue;
    if (!allowedOutputs(s.kind, s.level).includes(a.output)) continue;
    s.output = a.output;
    changed++;
  }
  if (changed > 0 && a.text) emit({ t: 'message', text: a.text, owner });
  return null;
}
