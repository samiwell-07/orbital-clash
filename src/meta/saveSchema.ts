import type { CometId, Difficulty } from '../types';
import type { Rank } from './rank';
import { RANKS } from './rank';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import type { Settings } from './settings';
import { sanitizeLeaderboards } from './leaderboard';
import type { Leaderboards } from './leaderboard';
import { newTrophyProgress, sanitizeTrophyProgress } from './trophies';
import type { TrophyProgress } from './trophies';

export const SAVE_VERSION = 1;
export const AREAS_PER_COMET = 7;
export const COMET_ORDER: readonly CometId[] = ['kreios', 'hathor', 'aether', 'helios'];
const DIFFICULTIES: readonly Difficulty[] = ['beginner', 'casual', 'normal', 'expert'];

export interface AreaRecord {
  completions: number;
  /** Best effective time (time + penalties) in seconds. */
  bestTimeSec: number;
  bestRank: Rank;
  bestScore: number;
  /** Difficulty and co-op player count of the most recent completed run. */
  lastDifficulty: Difficulty;
  coopPlayers: number;
}

export interface CometProgress {
  /** Areas 0..6 (null = not completed). */
  areas: (AreaRecord | null)[];
  /** Resurgence areas 0..6; playable once all seven areas are complete. */
  resurgence: (AreaRecord | null)[];
}

export interface LastPlayed {
  cometId: CometId;
  index: number;
  resurgence: boolean;
  difficulty: Difficulty;
  coopPlayers: number;
}

export interface SaveData {
  version: number;
  comets: Record<CometId, CometProgress>;
  lastPlayed: LastPlayed | null;
  settings: Settings;
  leaderboards: Leaderboards;
  trophies: TrophyProgress;
}

export const emptyAreas = (): (AreaRecord | null)[] => Array.from({ length: AREAS_PER_COMET }, () => null);

export function newSave(): SaveData {
  const comets = {} as Record<CometId, CometProgress>;
  for (const id of COMET_ORDER) comets[id] = { areas: emptyAreas(), resurgence: emptyAreas() };
  return { version: SAVE_VERSION, comets, lastPlayed: null, settings: DEFAULT_SETTINGS, leaderboards: {}, trophies: newTrophyProgress() };
}

/** Migration hook: MIGRATIONS[n] upgrades a version-n document to version n+1. */
export const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

export function migrate(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  let doc = raw as Record<string, unknown>;
  let v = typeof doc.version === 'number' ? doc.version : 0;
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    doc = step ? step(doc) : doc;
    v += 1;
    doc.version = v;
  }
  return doc;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeArea(raw: unknown): AreaRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!finite(r.bestTimeSec) || !finite(r.bestScore)) return null;
  return {
    completions: finite(r.completions) ? Math.max(1, Math.floor(r.completions)) : 1,
    bestTimeSec: Math.max(0, r.bestTimeSec),
    bestRank: RANKS.includes(r.bestRank as Rank) ? (r.bestRank as Rank) : 'D',
    bestScore: Math.max(0, r.bestScore),
    lastDifficulty: DIFFICULTIES.includes(r.lastDifficulty as Difficulty) ? (r.lastDifficulty as Difficulty) : 'normal',
    coopPlayers: finite(r.coopPlayers) ? Math.min(3, Math.max(1, Math.round(r.coopPlayers))) : 1,
  };
}

function sanitizeAreas(raw: unknown): (AreaRecord | null)[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: AREAS_PER_COMET }, (_, i) => sanitizeArea(list[i]));
}

function sanitizeLastPlayed(raw: unknown): LastPlayed | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!COMET_ORDER.includes(r.cometId as CometId) || !finite(r.index)) return null;
  return {
    cometId: r.cometId as CometId,
    index: Math.min(AREAS_PER_COMET - 1, Math.max(0, Math.floor(r.index))),
    resurgence: r.resurgence === true,
    difficulty: DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : 'normal',
    coopPlayers: finite(r.coopPlayers) ? Math.min(3, Math.max(1, Math.round(r.coopPlayers))) : 1,
  };
}

/** Builds a fully valid SaveData from arbitrary parsed JSON (null/garbage gives a fresh save). */
export function sanitizeSave(raw: unknown): SaveData {
  const doc = migrate(raw);
  if (!doc) return newSave();
  const comets = {} as Record<CometId, CometProgress>;
  const rawComets = typeof doc.comets === 'object' && doc.comets !== null ? (doc.comets as Record<string, Record<string, unknown>>) : {};
  for (const id of COMET_ORDER) {
    const c = rawComets[id] ?? {};
    comets[id] = { areas: sanitizeAreas(c.areas), resurgence: sanitizeAreas(c.resurgence) };
  }
  return {
    version: SAVE_VERSION,
    comets,
    lastPlayed: sanitizeLastPlayed(doc.lastPlayed),
    settings: sanitizeSettings(doc.settings),
    leaderboards: sanitizeLeaderboards(doc.leaderboards),
    trophies: sanitizeTrophyProgress(doc.trophies),
  };
}
