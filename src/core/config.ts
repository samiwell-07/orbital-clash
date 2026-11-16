import type { Team } from '../types';

/** Map tile size in pixels. */
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const MAP_W = COLS * TILE; // 1280
export const MAP_H = ROWS * TILE; // 720

/** Screen layout (logical pixels). The map is drawn at (0, HUD_TOP). */
export const HUD_TOP = 48;
export const HUD_BOTTOM = 72;
export const CANVAS_W = MAP_W;
export const CANVAS_H = HUD_TOP + MAP_H + HUD_BOTTOM; // 840

/** Fixed simulation step. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
/** Max real seconds processed per frame (avoids spiral of death after tab switch). */
export const MAX_FRAME_DT = 0.25;

/** Base placement (top-left cell, size in cells). */
export const BASE_W = 2;
export const BASE_H = 4;
export const BASE_ROW = 7;
export const BASE_COL: [number, number] = [0, COLS - BASE_W];
export const BASE_HP = 100;

export const START_MONEY = 300;
/** Passive income granted to each team when a wave launches. */
export const WAVE_INCOME = 25;
export const MAX_QUEUE = 24;
/** Seconds between staggered unit spawns within a wave. */
export const SPAWN_STAGGER = 0.4;

export const ROCK_VALUE = 25;
/** Max seconds a landed rock stays before fading (keeps the map tidy). */
export const ROCK_LIFETIME = 60;
/** Drone pickup radius in pixels. */
export const PICKUP_RADIUS = TILE * 0.7;
/** Keyboard cursor auto-repeat interval (seconds). */
export const CURSOR_REPEAT = 0.11;
/** Drone carrying a rock lerp speed (per second). */
export const DRONE_LERP = 14;

export const SELL_REFUND = 0.7;
/** Cells within this Chebyshev distance of a base cannot be built on (keeps spawns open). */
export const BASE_BUILD_MARGIN = 1;

export const MAX_PARTICLES = 1500;

export const SAVE_KEY = 'orbital-clash.unlockedLevel';

/** Neon palette. */
export const COLORS = {
  space: '#02030a',
  rockDark: '#141821',
  rockMid: '#1f2532',
  rockLight: '#2e3648',
  gridLine: 'rgba(120,160,220,0.07)',
  thorium: '#b6ff3b',
  thoriumCore: '#f4ff9a',
  thoriumGlow: 'rgba(170,255,60,0.55)',
  text: '#e6f1ff',
  textDim: '#7d8aa6',
  warning: '#ff3355',
  money: '#c8ff4d',
  cryo: '#7fe8ff',
  explosion: '#ffb347',
  white: '#ffffff',
} as const;

export interface TeamPalette {
  main: string;
  bright: string;
  dark: string;
  glow: string;
  name: string;
}

export const TEAM_COLORS: Record<Team, TeamPalette> = {
  0: { main: '#19d3ff', bright: '#9ff4ff', dark: '#0a3a52', glow: 'rgba(25,211,255,0.6)', name: 'BLUE' },
  1: { main: '#ff5a1f', bright: '#ffc09a', dark: '#4f1a08', glow: 'rgba(255,90,31,0.6)', name: 'RED' },
};

export function otherTeam(team: Team): Team {
  return team === 0 ? 1 : 0;
}
