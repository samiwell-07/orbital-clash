import type { Difficulty, PlayerId, SimEvent, UnitKind, WeaponKind } from '../types';
import { BASIC_UNITS, SPECIAL_UNITS, WEAPONS } from '../types';

/** Events the shell feeds in on top of raw SimEvents (the sim does not know campaign/battle context). */
export type MetaEvent =
  | { t: 'runStart'; localPlayers: readonly PlayerId[] }
  | { t: 'areaComplete'; difficulty: Difficulty; cometCleared: boolean; coopPlayers: number }
  | { t: 'battleEnd'; won: boolean; players: number };
export type TrophyEvent = SimEvent | MetaEvent;

export interface TrophyProgress {
  localPlayers: PlayerId[];
  areasCompleted: number;
  unitsLaunched: number;
  runLaunched: number;
  launchedKinds: UnitKind[];
  weaponsBuilt: WeaponKind[];
  runBaseHitsTaken: number;
  smashStreak: number;
  lastSmashSec: number;
  flags: string[];
  unlocked: string[];
  /** Newly unlocked ids waiting to be shown as notifications. */
  pending: string[];
}

export interface TrophyDef {
  id: string;
  name: string;
  description: string;
}

export const LAUNCH_GOAL = 100;
export const ARMY_GOAL = 1000;
export const SMASH_STREAK_GOAL = 8;
export const SMASH_STREAK_GAP_SEC = 6;

const hasAll = <T>(have: readonly T[], need: readonly T[]) => need.every((n) => have.includes(n));
const KNOWN_FLAGS = ['flawlessBase', 'cometCleared', 'expertArea', 'battleWon', 'fourPlayer', 'coopArea'];

interface Rule extends TrophyDef {
  test: (p: TrophyProgress) => boolean;
}

const RULES: readonly Rule[] = [
  { id: 'firstContact', name: 'First Contact', description: 'Complete your first campaign area.', test: (p) => p.areasCompleted >= 1 },
  { id: 'hundredStrong', name: 'Hundred Strong', description: `Launch ${LAUNCH_GOAL} units.`, test: (p) => p.unitsLaunched >= LAUNCH_GOAL },
  { id: 'thousandFleet', name: 'Thousand Fleet', description: `Launch ${ARMY_GOAL} units in a single run.`, test: (p) => p.runLaunched >= ARMY_GOAL },
  { id: 'untouched', name: 'Untouched', description: 'Destroy an enemy base without your base taking a hit.', test: (p) => p.flags.includes('flawlessBase') },
  { id: 'fullArsenal', name: 'Full Arsenal', description: 'Build all four defensive weapons.', test: (p) => hasAll(p.weaponsBuilt, WEAPONS) },
  { id: 'fullRoster', name: 'Full Roster', description: 'Launch all eight basic and special units.', test: (p) => hasAll(p.launchedKinds, [...BASIC_UNITS, ...SPECIAL_UNITS]) },
  { id: 'cometClear', name: 'Comet Cleared', description: 'Complete all seven areas of a comet.', test: (p) => p.flags.includes('cometCleared') },
  { id: 'veteran', name: 'Veteran Pilot', description: 'Complete an area on Expert difficulty.', test: (p) => p.flags.includes('expertArea') },
  { id: 'victor', name: 'Victor', description: 'Win a Battle.', test: (p) => p.flags.includes('battleWon') },
  { id: 'fourCorners', name: 'Four Corners', description: 'Finish a four-player Battle.', test: (p) => p.flags.includes('fourPlayer') },
  { id: 'wingmates', name: 'Wingmates', description: 'Complete a campaign area in co-op.', test: (p) => p.flags.includes('coopArea') },
  { id: 'rockBreaker', name: 'Rock Breaker', description: `Smash ${SMASH_STREAK_GOAL} rocks in a quick streak.`, test: (p) => p.smashStreak >= SMASH_STREAK_GOAL },
];

export const TROPHIES: readonly TrophyDef[] = RULES.map(({ id, name, description }) => ({ id, name, description }));

export function newTrophyProgress(): TrophyProgress {
  return {
    localPlayers: [0], areasCompleted: 0, unitsLaunched: 0, runLaunched: 0, launchedKinds: [],
    weaponsBuilt: [], runBaseHitsTaken: 0, smashStreak: 0, lastSmashSec: 0, flags: [], unlocked: [], pending: [],
  };
}

/** Returns a new progress (input is never mutated) plus the trophy ids this event unlocked. */
export function evaluateTrophies(
  progress: TrophyProgress,
  event: TrophyEvent,
  nowSec = 0,
): { progress: TrophyProgress; unlocked: string[] } {
  const next = applyEvent(progress, event, nowSec);
  if (next === progress) return { progress, unlocked: [] };
  const unlocked = RULES.filter((r) => !next.unlocked.includes(r.id) && r.test(next)).map((r) => r.id);
  if (unlocked.length === 0) return { progress: next, unlocked };
  return { progress: { ...next, unlocked: [...next.unlocked, ...unlocked], pending: [...next.pending, ...unlocked] }, unlocked };
}

function applyEvent(p: TrophyProgress, e: TrophyEvent, nowSec: number): TrophyProgress {
  const local = (id: PlayerId) => p.localPlayers.includes(id);
  switch (e.t) {
    case 'runStart':
      return { ...p, localPlayers: [...e.localPlayers], runLaunched: 0, runBaseHitsTaken: 0, smashStreak: 0 };
    case 'unitLaunched':
      if (!local(e.owner)) return p;
      return {
        ...p,
        unitsLaunched: p.unitsLaunched + e.count,
        runLaunched: p.runLaunched + e.count,
        launchedKinds: p.launchedKinds.includes(e.kind) ? p.launchedKinds : [...p.launchedKinds, e.kind],
      };
    case 'structureBuilt':
      if (!local(e.owner) || !(WEAPONS as readonly string[]).includes(e.kind) || p.weaponsBuilt.includes(e.kind as WeaponKind)) return p;
      return { ...p, weaponsBuilt: [...p.weaponsBuilt, e.kind as WeaponKind] };
    case 'baseHit':
      return local(e.target) ? { ...p, runBaseHitsTaken: p.runBaseHitsTaken + 1 } : p;
    case 'baseDestroyed':
      if (e.attacker === -1 || !local(e.attacker) || local(e.target) || p.runBaseHitsTaken > 0) return p;
      return withFlag(p, 'flawlessBase');
    case 'rockSmashed': {
      if (!local(e.owner)) return p;
      const chained = p.smashStreak > 0 && nowSec - p.lastSmashSec <= SMASH_STREAK_GAP_SEC;
      return { ...p, smashStreak: chained ? p.smashStreak + 1 : 1, lastSmashSec: nowSec };
    }
    case 'areaComplete': {
      let n = { ...p, areasCompleted: p.areasCompleted + 1 };
      if (e.cometCleared) n = withFlag(n, 'cometCleared');
      if (e.difficulty === 'expert') n = withFlag(n, 'expertArea');
      return e.coopPlayers >= 2 ? withFlag(n, 'coopArea') : n;
    }
    case 'battleEnd': {
      let n = e.won ? withFlag(p, 'battleWon') : p;
      if (e.players >= 4) n = withFlag(n, 'fourPlayer');
      return n;
    }
    default:
      return p;
  }
}

function withFlag(p: TrophyProgress, flag: string): TrophyProgress {
  return p.flags.includes(flag) ? p : { ...p, flags: [...p.flags, flag] };
}

export function drainTrophyNotifications(p: TrophyProgress): { progress: TrophyProgress; notifications: TrophyDef[] } {
  const notifications = p.pending.map((id) => TROPHIES.find((t) => t.id === id)).filter((t): t is TrophyDef => !!t);
  return { progress: { ...p, pending: [] }, notifications };
}

export function sanitizeTrophyProgress(raw: unknown): TrophyProgress {
  const base = newTrophyProgress();
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
  const ids = new Set(TROPHIES.map((t) => t.id));
  return {
    ...base,
    areasCompleted: n(r.areasCompleted),
    unitsLaunched: n(r.unitsLaunched),
    launchedKinds: strs(r.launchedKinds) as UnitKind[],
    weaponsBuilt: strs(r.weaponsBuilt).filter((w): w is WeaponKind => (WEAPONS as readonly string[]).includes(w)),
    flags: strs(r.flags).filter((f) => KNOWN_FLAGS.includes(f)),
    unlocked: strs(r.unlocked).filter((id) => ids.has(id)),
    pending: strs(r.pending).filter((id) => ids.has(id)),
  };
}
