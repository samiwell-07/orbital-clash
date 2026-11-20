import type { CometId, Difficulty } from '../types';
import { MAX_COOP_PLAYERS, SAVE_KEY } from '../config/constants';
import type { KeyValueStorage } from './storage';
import { browserStorage } from './storage';
import { computeRank, betterRank, effectiveTime } from './rank';
import type { Rank } from './rank';
import { evaluateTrophies } from './trophies';
import type { TrophyEvent } from './trophies';
import { AREAS_PER_COMET, COMET_ORDER, EXPANSION_ORDER, newSave, sanitizeSave } from './saveSchema';
import type { AreaRecord, SaveData } from './saveSchema';

export interface AreaCompleteInput {
  cometId: CometId;
  /** 0-based area index (0..6). */
  index: number;
  difficulty: Difficulty;
  timeSec: number;
  penaltySec: number;
  score: number;
  /** Used to rank the run; without it the run is ranked D. */
  parTimeSec?: number;
  resurgence?: boolean;
  coopPlayers?: number;
}

export interface AreaCompleteResult {
  save: SaveData;
  rank: Rank;
  newBestTime: boolean;
  newBestScore: boolean;
  cometCleared: boolean;
  resurgenceJustUnlocked: boolean;
  nextCometJustUnlocked: CometId | null;
  trophiesUnlocked: string[];
}

/** Loads the save; missing, unparsable or corrupt data yields a fresh (or repaired) save and never throws. */
export function loadSave(storage: KeyValueStorage = browserStorage()): SaveData {
  try {
    const text = storage.getItem(SAVE_KEY);
    return text === null ? newSave() : sanitizeSave(JSON.parse(text));
  } catch {
    return newSave();
  }
}

/** Returns false if storage rejected the write (quota, private mode). */
export function saveSave(save: SaveData, storage: KeyValueStorage = browserStorage()): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function resetSave(storage: KeyValueStorage = browserStorage()): SaveData {
  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
  return newSave();
}

export function isCometCleared(save: SaveData, cometId: CometId): boolean {
  return save.comets[cometId].areas.length === AREAS_PER_COMET && save.comets[cometId].areas.every((a) => a !== null);
}

/** Resurgence opens once all 7 areas of that comet are complete. */
export function isResurgenceUnlocked(save: SaveData, cometId: CometId): boolean {
  return isCometCleared(save, cometId);
}

const orderFor = (id: CometId) => EXPANSION_ORDER.includes(id) ? EXPANSION_ORDER : COMET_ORDER;

/** Each campaign starts unlocked and progresses independently. */
export function isCometUnlocked(save: SaveData, cometId: CometId): boolean {
  const order = orderFor(cometId);
  const i = order.indexOf(cometId);
  return i === 0 || (i > 0 && isCometCleared(save, order[i - 1]));
}

export function isAreaUnlocked(save: SaveData, cometId: CometId, index: number, resurgence = false): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= AREAS_PER_COMET) return false;
  if (!isCometUnlocked(save, cometId)) return false;
  if (resurgence && !isResurgenceUnlocked(save, cometId)) return false;
  const list = resurgence ? save.comets[cometId].resurgence : save.comets[cometId].areas;
  return index === 0 || list[index - 1] !== null;
}

export function getArea(save: SaveData, cometId: CometId, index: number, resurgence = false): AreaRecord | null {
  const c = save.comets[cometId];
  return (resurgence ? c.resurgence : c.areas)[index] ?? null;
}

export function recordAreaComplete(save: SaveData, input: AreaCompleteInput): AreaCompleteResult {
  const { cometId, index, difficulty, timeSec, penaltySec, score } = input;
  const resurgence = input.resurgence === true;
  const coopPlayers = Math.min(MAX_COOP_PLAYERS, Math.max(1, input.coopPlayers ?? 1));
  const rank = input.parTimeSec === undefined ? 'D' : computeRank(timeSec, penaltySec, input.parTimeSec, difficulty);
  const effective = effectiveTime(timeSec, penaltySec);
  const prev = getArea(save, cometId, index, resurgence);
  const wasCleared = isCometCleared(save, cometId);
  const order = orderFor(cometId);
  const nextComet = order[order.indexOf(cometId) + 1] ?? null;
  const nextWasUnlocked = nextComet !== null && isCometUnlocked(save, nextComet);

  const record: AreaRecord = {
    completions: (prev?.completions ?? 0) + 1,
    bestTimeSec: prev ? Math.min(prev.bestTimeSec, effective) : effective,
    bestRank: prev ? betterRank(prev.bestRank, rank) : rank,
    bestScore: prev ? Math.max(prev.bestScore, score) : Math.max(0, score),
    lastDifficulty: difficulty,
    coopPlayers,
  };
  const c = save.comets[cometId];
  const list = (resurgence ? c.resurgence : c.areas).slice();
  list[index] = record;
  let next: SaveData = {
    ...save,
    comets: { ...save.comets, [cometId]: resurgence ? { ...c, resurgence: list } : { ...c, areas: list } },
    lastPlayed: { cometId, index, resurgence, difficulty, coopPlayers },
  };

  const cleared = !resurgence && !wasCleared && isCometCleared(next, cometId);
  const fed = evaluateTrophies(next.trophies, { t: 'areaComplete', difficulty, cometCleared: cleared, coopPlayers });
  next = { ...next, trophies: fed.progress };
  return {
    save: next,
    rank,
    newBestTime: !prev || effective < prev.bestTimeSec,
    newBestScore: !prev || score > prev.bestScore,
    cometCleared: cleared,
    resurgenceJustUnlocked: cleared,
    nextCometJustUnlocked: nextComet !== null && !nextWasUnlocked && isCometUnlocked(next, nextComet) ? nextComet : null,
    trophiesUnlocked: fed.unlocked,
  };
}

/** Feeds a sim/meta event into the save's trophy progress; returns the new save and unlocked ids. */
export function applyTrophyEvent(save: SaveData, event: TrophyEvent, nowSec = 0): { save: SaveData; unlocked: string[] } {
  const r = evaluateTrophies(save.trophies, event, nowSec);
  return r.progress === save.trophies ? { save, unlocked: [] } : { save: { ...save, trophies: r.progress }, unlocked: r.unlocked };
}
