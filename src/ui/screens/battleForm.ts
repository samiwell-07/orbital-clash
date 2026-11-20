import type { Profile } from '../../types';
import type { BattleSetup } from '../../meta/settings';
import type { Row } from '../menus/form';
import type { Form } from '../menus/form';
import type { BattleConfig, BattleMapSummary } from './types';

export const STRENGTHS = [0.25, 0.5, 0.75, 1] as const;
export const THORIUM_RATES = [0.5, 0.75, 1, 1.5, 2] as const;
export const TIME_LIMITS_MIN = [3, 5, 10, 15, 20, 30] as const;
export const TEAM_NAMES = ['Team A', 'Team B', 'Team C', 'Team D'] as const;
const PROFILES: readonly Profile[] = ['base', 'bionic'];

/** Raw option indices behind the battle form; the form rows are always rebuilt from this. */
export interface BattleValues {
  map: number;
  players: number;
  humans: number;
  teams: number[];
  strengths: number[];
  hits: number;
  thorium: number;
  timed: boolean;
  timeLimit: number;
  profile: number;
}

const nearest = (list: readonly number[], v: number): number =>
  list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0);

export function valuesFromSetup(s: BattleSetup, maps: readonly BattleMapSummary[]): BattleValues {
  return clampValues({
    map: Math.max(0, maps.findIndex((m) => m.id === s.mapId)), players: s.players, humans: 1,
    teams: [0, 1, 2, 3], strengths: [3, 3, 3, 3], hits: s.maxHits,
    thorium: nearest(THORIUM_RATES, s.thoriumRate), timed: s.timeLimitSec > 0,
    timeLimit: s.timeLimitSec > 0 ? nearest(TIME_LIMITS_MIN.map((m) => m * 60), s.timeLimitSec) : 2,
    profile: Math.max(0, PROFILES.indexOf(s.profile)),
  }, maps);
}

/** Keeps values consistent: players within the map's capacity, humans within players. */
export function clampValues(v: BattleValues, maps: readonly BattleMapSummary[]): BattleValues {
  const cap = Math.max(2, Math.min(4, maps[v.map]?.maxPlayers ?? 4));
  const players = Math.min(Math.max(2, v.players), cap);
  return { ...v, players, humans: Math.min(Math.max(1, v.humans), players) };
}

export function battleRows(v: BattleValues, maps: readonly BattleMapSummary[]): Row[] {
  const cap = Math.max(2, Math.min(4, maps[v.map]?.maxPlayers ?? 4));
  const rows: Row[] = [
    { k: 'label', id: 'l-match', label: 'Match' },
    { k: 'choice', id: 'map', label: 'Map', options: maps.length ? maps.map((m) => m.name) : ['Default'], index: v.map },
    { k: 'choice', id: 'players', label: 'Players', options: ['2', '3', '4'].slice(0, cap - 1), index: v.players - 2 },
    { k: 'choice', id: 'humans', label: 'Human players', options: Array.from({ length: v.players }, (_, i) => String(i + 1)), index: v.humans - 1 },
    { k: 'slider', id: 'hits', label: 'Max Hits', min: 1, max: 100, step: 1, value: v.hits },
    { k: 'choice', id: 'thorium', label: 'Thorium Rate', options: THORIUM_RATES.map((r) => `${Math.round(r * 100)}%`), index: v.thorium },
    { k: 'choice', id: 'timed', label: 'Timed Battle', options: ['Off', 'On'], index: v.timed ? 1 : 0 },
  ];
  if (v.timed) rows.push({ k: 'choice', id: 'timeLimit', label: 'Time Limit', options: TIME_LIMITS_MIN.map((m) => `${m} min`), index: v.timeLimit });
  rows.push({ k: 'choice', id: 'profile', label: 'Ruleset', options: ['Original', 'Bionic Swarm'], index: v.profile });
  rows.push({ k: 'label', id: 'l-players', label: 'Teams & Strength' });
  for (let i = 0; i < v.players; i++) {
    const kind = i < v.humans ? 'Player' : 'CPU';
    rows.push({ k: 'choice', id: `team${i}`, label: `${kind} ${i + 1} · Team`, options: TEAM_NAMES, index: v.teams[i] });
    rows.push({ k: 'choice', id: `str${i}`, label: `${kind} ${i + 1} · Strength`, options: STRENGTHS.map((s) => `${Math.round(s * 100)}%`), index: v.strengths[i] });
  }
  rows.push({ k: 'button', id: 'start', label: 'Start Battle', icon: 'arrow' }, { k: 'button', id: 'back', label: 'Back' });
  return rows;
}

export function readValues(form: Form, prev: BattleValues, maps: readonly BattleMapSummary[]): BattleValues {
  const next: BattleValues = {
    ...prev, map: form.value('map'), players: form.value('players') + 2, humans: form.value('humans') + 1,
    hits: form.value('hits'), thorium: form.value('thorium'), timed: form.value('timed') === 1,
    timeLimit: form.row('timeLimit') ? form.value('timeLimit') : prev.timeLimit, profile: form.value('profile'),
    teams: prev.teams.map((t, i) => (form.row(`team${i}`) ? form.value(`team${i}`) : t)),
    strengths: prev.strengths.map((s, i) => (form.row(`str${i}`) ? form.value(`str${i}`) : s)),
  };
  return clampValues(next, maps);
}

export function toConfig(v: BattleValues, maps: readonly BattleMapSummary[]): BattleConfig {
  const c = clampValues(v, maps);
  return {
    mapId: maps[c.map]?.id ?? '',
    slots: Array.from({ length: c.players }, (_, i) => ({ human: i < c.humans, team: c.teams[i], strength: STRENGTHS[c.strengths[i]] })),
    maxHits: c.hits,
    thoriumRate: THORIUM_RATES[c.thorium],
    timeLimitSec: c.timed ? TIME_LIMITS_MIN[c.timeLimit] * 60 : 0,
    profile: PROFILES[c.profile] ?? 'base',
  };
}
