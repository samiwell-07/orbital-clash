import type { CometId, Difficulty } from '../types';

export const LEADERBOARD_SIZE = 10;
export const NAME_MIN = 3;
export const NAME_MAX = 8;

export interface LeaderboardEntry {
  name: string;
  score: number;
  timeSec: number;
  /** Country flag code (ISO region, e.g. 'US') or 'XX' when unknown. */
  flag: string;
}

export type Leaderboards = Record<string, LeaderboardEntry[]>;

export type SubmitResult =
  | { ok: true; position: number }
  | { ok: false; reason: 'badName' | 'notBetter' | 'tooLow' };

export function boardKey(cometId: CometId, index: number, difficulty: Difficulty, resurgence = false): string {
  return `${cometId}:${resurgence ? 'r' : 'a'}${index}:${difficulty}`;
}

/** Region from a BCP-47 tag ("en-GB" -> "GB"); defaults to navigator.language, else 'XX'. */
export function flagFromLocale(locale?: string): string {
  const tag = locale ?? (globalThis as { navigator?: { language?: string } }).navigator?.language ?? '';
  const m = /[-_]([A-Za-z]{2})(?:$|[-_])/.exec(tag);
  return m ? m[1].toUpperCase() : 'XX';
}

export function normalizeName(raw: string): string | null {
  const name = raw.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  return name.length >= NAME_MIN && name.length <= NAME_MAX ? name : null;
}

function compare(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score || a.timeSec - b.timeSec;
}

/**
 * Submits a run. Names are unique per board (case-insensitive); per patch notes a
 * repeat entry (and its flag) only registers when its score beats the existing one.
 * Mutates and returns via `boards`; the board is kept sorted and trimmed to the top 10.
 */
export function submitScore(
  boards: Leaderboards,
  key: string,
  rawName: string,
  score: number,
  timeSec: number,
  flag: string = flagFromLocale(),
): SubmitResult {
  const name = normalizeName(rawName);
  if (!name) return { ok: false, reason: 'badName' };
  const board = boards[key] ?? [];
  const existing = board.findIndex((e) => e.name.toLowerCase() === name.toLowerCase());
  if (existing >= 0 && score <= board[existing].score) return { ok: false, reason: 'notBetter' };
  const entry: LeaderboardEntry = { name, score, timeSec, flag: /^[A-Za-z]{2}$/.test(flag) ? flag.toUpperCase() : 'XX' };
  const next = board.filter((_, i) => i !== existing);
  next.push(entry);
  next.sort(compare);
  const position = next.indexOf(entry);
  if (position >= LEADERBOARD_SIZE) return { ok: false, reason: 'tooLow' };
  boards[key] = next.slice(0, LEADERBOARD_SIZE);
  return { ok: true, position };
}

export function getBoard(boards: Leaderboards, key: string): readonly LeaderboardEntry[] {
  return boards[key] ?? [];
}

/** Whether a score would place on the board (used to prompt for a name). */
export function qualifies(boards: Leaderboards, key: string, score: number): boolean {
  const board = getBoard(boards, key);
  return board.length < LEADERBOARD_SIZE || score > board[board.length - 1].score;
}

export function sanitizeLeaderboards(raw: unknown): Leaderboards {
  const out: Leaderboards = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [key, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const entries: LeaderboardEntry[] = [];
    for (const e of list) {
      const r = (e ?? {}) as Record<string, unknown>;
      const name = typeof r.name === 'string' ? normalizeName(r.name) : null;
      if (!name || typeof r.score !== 'number' || !Number.isFinite(r.score)) continue;
      entries.push({
        name,
        score: r.score,
        timeSec: typeof r.timeSec === 'number' && Number.isFinite(r.timeSec) ? r.timeSec : 0,
        flag: typeof r.flag === 'string' && /^[A-Za-z]{2}$/.test(r.flag) ? r.flag.toUpperCase() : 'XX',
      });
    }
    out[key] = entries.sort(compare).slice(0, LEADERBOARD_SIZE);
  }
  return out;
}
