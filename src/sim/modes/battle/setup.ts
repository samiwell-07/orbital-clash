import type { Difficulty, NewGameOptions, PlayerId, PlayerSlot } from '@/types';
import { PLAYER_IDS } from '@/types';
import { DEFAULT_HITS, MAX_HITS, MAX_PLAYERS, MIN_HITS } from '@/config/constants';
import { findMap, registerMap } from '@/sim/core/defaultMap';
import { battleMapById } from '@/data/battle-maps';
import { BATTLE_CONFIG, clampStrength } from './config';

export type BattleController = 'human' | 'adaptive';

export interface BattlePlayerSetup {
  id: PlayerId;
  /** Equal team ids are allied (2v2, 3v1, 2v1...); all-different = free for all. */
  team: number;
  controller: BattleController;
  /** 0..1, scales this player's Max Hits and starting Thorium (default 1). */
  strength?: number;
  /** PLAYER_COLORS index (lobby choice); defaults to the player id. */
  colorIndex?: number;
}

export interface BattleSetup {
  players: readonly BattlePlayerSetup[];
  mapId: string;
  /** 1..100, default 10. */
  maxHits?: number;
  /** Seconds; 0 = untimed. At 0 left all spawning runs at 8x. */
  timeLimitSec?: number;
  /** 0.5..2.0, default 1. */
  thoriumRate?: number;
  /** Difficulty of the adaptive AI opponents. */
  difficulty?: Difficulty;
  seed?: number;
  /** Ignore the map's preset starts: every player picks a base tile with a buildBase intent. */
  freeBase?: boolean;
}

export class BattleSetupError extends Error {
  readonly errors: readonly string[];
  constructor(errors: readonly string[]) {
    super(`Invalid battle setup: ${errors.join('; ')}`);
    this.name = 'BattleSetupError';
    this.errors = errors;
  }
}

const DIFFICULTIES: readonly Difficulty[] = ['beginner', 'casual', 'normal', 'expert'];
export const FREE_BASE_SUFFIX = ':free';

/** Resolves a battle map id, accepting the `:free` variant that has no preset starts. */
function mapFor(mapId: string) {
  if (mapId.endsWith(FREE_BASE_SUFFIX)) {
    const base = battleMapById(mapId.slice(0, -FREE_BASE_SUFFIX.length));
    return base ? { ...base, id: mapId, baseTiles: base.baseTiles.map(() => null) } : undefined;
  }
  return battleMapById(mapId);
}

/** Returns every problem with a setup (empty array = valid). */
export function validateBattleSetup(s: BattleSetup): string[] {
  const errors: string[] = [];
  const { min, max } = BATTLE_CONFIG.playerCount;
  const map = mapFor(s.mapId);
  if (!map) errors.push(`unknown battle map "${s.mapId}"`);
  if (s.players.length < min) errors.push(`needs at least ${min} players (got ${s.players.length})`);
  if (s.players.length > max) errors.push(`at most ${max} players are allowed (got ${s.players.length})`);
  const ids = new Set<number>();
  for (const p of s.players) {
    if (!PLAYER_IDS.includes(p.id) || p.id >= MAX_PLAYERS) errors.push(`invalid player id ${String(p.id)}`);
    else if (ids.has(p.id)) errors.push(`duplicate player id ${p.id}`);
    ids.add(p.id);
    if (!Number.isInteger(p.team)) errors.push(`player ${p.id}: team must be an integer`);
    if (p.controller !== 'human' && p.controller !== 'adaptive') errors.push(`player ${p.id}: controller must be human or adaptive`);
    if (p.strength !== undefined && !(p.strength >= 0 && p.strength <= 1)) errors.push(`player ${p.id}: strength must be 0..1`);
    if (map && p.id >= map.baseTiles.length) errors.push(`map "${map.name}" has only ${map.baseTiles.length} start slots (player ${p.id})`);
  }
  if (new Set(s.players.map((p) => p.team)).size < 2) errors.push('needs at least 2 teams (everyone is allied)');
  const hits = s.maxHits ?? DEFAULT_HITS;
  if (!Number.isInteger(hits) || hits < MIN_HITS || hits > MAX_HITS) errors.push(`maxHits must be an integer ${MIN_HITS}..${MAX_HITS}`);
  const limit = s.timeLimitSec ?? 0;
  if (!Number.isFinite(limit) || limit < 0) errors.push('timeLimitSec must be >= 0 (0 = untimed)');
  const rate = s.thoriumRate ?? 1;
  const r = BATTLE_CONFIG.thoriumRate;
  if (!(rate >= r.min && rate <= r.max)) errors.push(`thoriumRate must be ${r.min}..${r.max}`);
  if (s.difficulty !== undefined && !DIFFICULTIES.includes(s.difficulty)) errors.push(`unknown difficulty "${String(s.difficulty)}"`);
  if (s.seed !== undefined && !Number.isFinite(s.seed)) errors.push('seed must be a finite number');
  return errors;
}

/** Validates a battle setup and builds the NewGameOptions for createSim. Throws BattleSetupError. */
export function startBattle(setup: BattleSetup): NewGameOptions {
  const errors = validateBattleSetup(setup);
  if (errors.length) throw new BattleSetupError(errors);
  const mapId = setup.freeBase && !setup.mapId.endsWith(FREE_BASE_SUFFIX) ? setup.mapId + FREE_BASE_SUFFIX : setup.mapId;
  const map = mapFor(mapId);
  if (map && !findMap(mapId)) registerMap(map);

  const strength = [1, 1, 1, 1];
  const slots: PlayerSlot[] = setup.players.map((p) => {
    strength[p.id] = clampStrength(p.strength);
    return { id: p.id, team: p.team, controller: p.controller, colorIndex: p.colorIndex };
  });
  return {
    settings: {
      mode: 'battle',
      profile: 'base',
      difficulty: setup.difficulty ?? 'normal',
      maxHits: setup.maxHits ?? DEFAULT_HITS,
      thoriumRate: setup.thoriumRate ?? 1,
      timeLimitSec: setup.timeLimitSec ?? 0,
      strength,
      mission: null,
      comet: map?.palette ?? null,
      seed: setup.seed ?? 1,
    },
    slots,
    mapId,
  };
}
