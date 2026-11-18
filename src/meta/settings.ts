import type { Difficulty, Profile } from '../types';

export type VideoLayout = '16:9' | '4:3';
export type ControlsDisplay = 'gamepad' | 'keyboard';
export type Language = 'en';

export interface BattleSetup {
  mapId: string;
  players: number;
  maxHits: number;
  thoriumRate: number;
  timeLimitSec: number;
  profile: Profile;
}

export interface Settings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  controlsDisplay: ControlsDisplay;
  /** Patch 1.02: choose between a 16:9 layout and a 4:3 safe-area layout. */
  videoLayout: VideoLayout;
  language: Language;
  defaultDifficulty: Difficulty;
  lastBattle: BattleSetup;
}

export const DEFAULT_BATTLE_SETUP: BattleSetup = {
  mapId: '', players: 2, maxHits: 10, thoriumRate: 1, timeLimitSec: 0, profile: 'base',
};

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  sfxVolume: 1,
  musicVolume: 0.6,
  controlsDisplay: 'gamepad',
  videoLayout: '16:9',
  language: 'en',
  defaultDifficulty: 'normal',
  lastBattle: DEFAULT_BATTLE_SETUP,
};

const DIFFICULTIES: readonly Difficulty[] = ['beginner', 'casual', 'normal', 'expert'];

const num = (v: unknown, min: number, max: number, fb: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fb;
const pick = <T extends string>(v: unknown, options: readonly T[], fb: T): T =>
  options.includes(v as T) ? (v as T) : fb;
const obj = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};

export function sanitizeBattleSetup(raw: unknown): BattleSetup {
  const r = obj(raw);
  const d = DEFAULT_BATTLE_SETUP;
  return {
    mapId: typeof r.mapId === 'string' ? r.mapId : d.mapId,
    players: Math.round(num(r.players, 2, 4, d.players)),
    maxHits: Math.round(num(r.maxHits, 1, 100, d.maxHits)),
    thoriumRate: num(r.thoriumRate, 0.5, 2, d.thoriumRate),
    timeLimitSec: Math.max(0, Math.round(num(r.timeLimitSec, 0, 86400, d.timeLimitSec))),
    profile: pick(r.profile, ['base', 'bionic'] as const, d.profile),
  };
}

/** Coerces any stored value into a valid Settings object (corrupt fields fall back to defaults). */
export function sanitizeSettings(raw: unknown): Settings {
  const r = obj(raw);
  const d = DEFAULT_SETTINGS;
  return {
    masterVolume: num(r.masterVolume, 0, 1, d.masterVolume),
    sfxVolume: num(r.sfxVolume, 0, 1, d.sfxVolume),
    musicVolume: num(r.musicVolume, 0, 1, d.musicVolume),
    controlsDisplay: pick(r.controlsDisplay, ['gamepad', 'keyboard'] as const, d.controlsDisplay),
    videoLayout: pick(r.videoLayout, ['16:9', '4:3'] as const, d.videoLayout),
    language: 'en',
    defaultDifficulty: pick(r.defaultDifficulty, DIFFICULTIES, d.defaultDifficulty),
    lastBattle: sanitizeBattleSetup(r.lastBattle),
  };
}

export function toggleVideoLayout(s: Settings): Settings {
  return { ...s, videoLayout: s.videoLayout === '16:9' ? '4:3' : '16:9' };
}

/** Tiny i18n table: English only, but UI code goes through t() so more languages can slot in. */
const STRINGS: Record<Language, Record<string, string>> = {
  en: {
    'menu.campaign': 'Campaign',
    'menu.battle': 'Battle',
    'menu.trophies': 'Trophies',
    'menu.leaderboards': 'Leaderboards',
    'menu.settings': 'Settings',
    'settings.master': 'Master Volume',
    'settings.sfx': 'Effects Volume',
    'settings.music': 'Music Volume',
    'settings.layout': 'Video Layout',
    'settings.controls': 'Controls',
    'settings.difficulty': 'Default Difficulty',
    'trophy.unlocked': 'Trophy unlocked: {name}',
    'rank.label': 'Rank',
  },
};

export function t(key: string, params: Record<string, string | number> = {}, lang: Language = 'en'): string {
  const raw = STRINGS[lang][key] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
