import type { Difficulty, Emit, Mission, ScriptAction, World } from '@/types';
import { PLAYER_IDS, ALL_UNITS } from '@/types';
import { SPAWN_TOWER_DEFS, UNIT_DEFS, ALL_TECH_KEYS } from '@/data';
import { MAX_COOP_PLAYERS, STORAGE_CAP, TICK_HZ } from '@/config/constants';
import { createWorld, pathExists } from '@/sim/core';
import { executeAction } from './actions';
import { applyMissionSetup, startCampaign, ENEMY_ID, HUMAN_SLOT_IDS, scaleCount } from './setup';
import type { CompiledEvent } from './state';

export interface CompileResult {
  events: CompiledEvent[];
  errors: string[];
}

/** Dry runs credit this share of nominal tower production, so scripts never depend on a perfect rate. */
export const PRODUCTION_CREDIT = 0.5;

function checkMission(m: Mission, difficulty: Difficulty): string[] {
  const errs: string[] = [];
  const { map } = m;
  if (map.rows.length !== map.h || map.rows.some((r) => r.length !== map.w)) errs.push('map rows do not match w x h');
  const bases: [number, string][] = [[0, 'human'], [ENEMY_ID, 'enemy'], ...HUMAN_SLOT_IDS.slice(1).map((id): [number, string] => [id, `co-op player ${id}`])];
  for (const [i, who] of bases) {
    const b = map.baseTiles[i];
    if (!b || b.tx < 0 || b.ty < 0 || b.tx >= map.w || b.ty >= map.h) errs.push(`${who} base tile missing or out of bounds`);
    else if (map.rows[b.ty]?.[b.tx] !== '.') errs.push(`${who} base tile is not floor`);
  }
  const tiles = bases.map(([i]) => map.baseTiles[i]).filter((t): t is { tx: number; ty: number } => !!t);
  if (new Set(tiles.map((t) => `${t.tx},${t.ty}`)).size !== tiles.length) errs.push('base tiles must be distinct');
  const hits = m.enemyHits[difficulty];
  if (!Number.isInteger(hits) || hits < 1 || hits > 100) errs.push(`enemyHits.${difficulty} must be an integer 1..100`);
  if (!(m.parTimeSec > 0)) errs.push('parTimeSec must be positive');
  if (m.objectives.length === 0) errs.push('mission has no objectives');
  if (m.resurgence && m.hints.length > 0) errs.push('resurgence areas have no hints');
  for (const k of [...m.unlocked, ...(m.teaches ? [m.teaches] : [])]) {
    if (!ALL_TECH_KEYS.includes(k)) errs.push(`unknown tech key "${k}"`);
  }
  return errs;
}

function creditProduction(w: World, acc: Map<number, number>, dtSec: number): void {
  if (dtSec <= 0) return;
  for (const s of w.structures.values()) {
    if (!s.output || (s.kind !== 'basicOps' && s.kind !== 'specialOps')) continue;
    const mults = SPAWN_TOWER_DEFS[s.kind].spawnMult;
    const rate = mults[Math.min(mults.length - 1, s.level)] / UNIT_DEFS[s.output].spawnSeconds;
    const p = w.players[s.owner];
    // A full base pauses production, as in the real production stage.
    const room = Math.max(0, STORAGE_CAP - ALL_UNITS.reduce((n, k) => n + (p.stored[k] ?? 0), 0));
    const a = (acc.get(s.id) ?? 0) + PRODUCTION_CREDIT * dtSec * rate;
    const n = Math.min(room, Math.floor(a));
    if (n > 0) p.stored[s.output] = (p.stored[s.output] ?? 0) + n;
    acc.set(s.id, room > 0 ? a - Math.floor(a) : 0);
  }
}

function convert(m: Mission, difficulty: Difficulty, errors: string[]): CompiledEvent[] {
  const out: CompiledEvent[] = [];
  m.timeline.forEach((e, index) => {
    if (typeof e.atSec !== 'number' || !Number.isFinite(e.atSec) || e.atSec < 0) {
      errors.push(`event #${index}: invalid time ${String(e.atSec)}`);
      return;
    }
    if (!PLAYER_IDS.includes(e.player)) {
      errors.push(`event #${index}: invalid player ${String(e.player)}`);
      return;
    }
    let action: ScriptAction = e.action;
    if (action.a === 'release' && typeof action.count === 'number') {
      action = { ...action, count: scaleCount(action.count, difficulty) };
    }
    out.push({ index, atSec: e.atSec, tick: Math.round(e.atSec * TICK_HZ), player: e.player, action });
  });
  return out.sort((a, b) => a.tick - b.tick || a.index - b.index);
}

/**
 * Converts atSec to ticks once and validates the whole script by replaying it on a scratch world:
 * bad times/tiles/tech, unaffordable builds, sealed paths (to any co-op base) and impossible releases become explicit errors.
 */
export function compile(mission: Mission, difficulty: Difficulty = 'normal'): CompileResult {
  const errors = checkMission(mission, difficulty).map((e) => `${mission.id}: ${e}`);
  const events = convert(mission, difficulty, errors);
  if (errors.length > 0) return { events, errors };
  // Full co-op roster, so placements are checked against every human base a real run can have.
  const scratch = createWorld(startCampaign({ mission, difficulty, humanPlayers: MAX_COOP_PLAYERS }));
  const noop: Emit = () => undefined;
  for (const e of applyMissionSetup(scratch, noop)) errors.push(`${mission.id}: ${e}`);
  const acc = new Map<number, number>();
  let lastSec = 0;
  for (const e of events) {
    creditProduction(scratch, acc, e.atSec - lastSec);
    lastSec = e.atSec;
    scratch.timeSec = e.atSec;
    const err = executeAction(scratch, e.player, e.action, { dry: true }, noop);
    if (err) errors.push(`${mission.id}: event #${e.index} @${e.atSec}s: ${err}`);
  }
  const enemy = scratch.players[ENEMY_ID];
  for (const id of HUMAN_SLOT_IDS) {
    const h = scratch.players[id];
    if (!pathExists(scratch, { tx: h.baseTx, ty: h.baseTy }, { tx: enemy.baseTx, ty: enemy.baseTy })) {
      errors.push(`${mission.id}: player ${id} base is sealed off from the enemy base`);
    }
  }
  return { events, errors };
}
