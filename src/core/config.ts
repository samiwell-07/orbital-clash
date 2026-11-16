import type { PaletteKey, PlayerState } from '../types';

/** Map tile size in pixels. */
export const TILE = 40;
export const COLS = 28;
export const ROWS = 18;
export const MAP_W = COLS * TILE; // 1120
export const MAP_H = ROWS * TILE; // 720

/** Screen layout (logical pixels): [sidebar | cliff frame | map | cliff frame]. */
export const SIDEBAR_W = 180;
/** Width of the rocky cliff rim drawn around the plateau. */
export const FRAME = 24;
/** Map origin in canvas logical space. Map-space (x,y) is drawn at (MAP_X + x, MAP_Y + y). */
export const MAP_X = SIDEBAR_W + FRAME; // 204
export const MAP_Y = FRAME; // 24
export const CANVAS_W = MAP_X + MAP_W + FRAME; // 1348
export const CANVAS_H = MAP_Y + MAP_H + FRAME; // 768

/** Fixed simulation step. */
export const SIM_HZ = 60;
export const SIM_DT = 1 / SIM_HZ;
export const MAX_FRAME_DT = 0.25;

/** Bases: 2x4 cells with an entry/exit portal, at the far left and far right of the plateau. */
export const BASE_W = 2;
export const BASE_H = 4;
export const BASE_ROW = 7;
export const BASE_COL: [number, number] = [0, COLS - BASE_W];
export const BASE_HP = 250;

export const START_MONEY = 450;
/** Small passive Thorium income per second (keeps games moving). */
export const PASSIVE_INCOME = 2;
/** Passive research energy per second, plus RESEARCH_PER_REFINE * rock value per refined rock. */
export const PASSIVE_RESEARCH = 1.5;
export const RESEARCH_PER_REFINE = 0.6;
/** Visual maximum of the cyan research bar. */
export const RESEARCH_BAR_MAX = 400;

/** Wave buffer capacity (units). */
export const MAX_QUEUE = 160;
/** Seconds between consecutive units of a launched train (forms the serpent). */
export const SPAWN_STAGGER = 0.07;
/** Speed multiplier from 'swarmSpeed' research. */
export const SWARM_SPEED_MULT = 1.3;

export const ROCK_VALUE = 15;
/** Seconds a landed rock stays before fading. */
export const ROCK_LIFETIME = 90;
/** Ship pickup radius in pixels. */
export const PICKUP_RADIUS = TILE * 0.7;
/** Harvester drone speed in tiles/second. */
export const HARVESTER_SPEED = 3.2;
/** Seconds a harvester spends mining a rock before lifting it. */
export const HARVEST_TIME = 0.6;
export const CURSOR_REPEAT = 0.1;
export const DRONE_LERP = 14;

export const SELL_REFUND = 0.75;
/** Cells within this Chebyshev distance of a base cannot be built on (keeps portals open). */
export const BASE_BUILD_MARGIN = 1;

export const MAX_PARTICLES = 2500;
/** Spatial index bucket size in pixels. */
export const SPATIAL_CELL = TILE;

export const SAVE_KEY = 'orbital-clash.unlockedLevel';

/** Plateau palette: dark purple/slate plating with glowing cyan circuit lines. */
export const COLORS = {
  space: '#03020a',
  plateDark: '#24203a',
  plateMid: '#2f2a4a',
  plateLight: '#3d3760',
  circuit: '#2fe6ff',
  cliffDark: '#0d0c14',
  cliffMid: '#1d1b26',
  cliffLight: '#34313f',
  gridLine: 'rgba(150,140,220,0.10)',
  thorium: '#b6ff3b',
  thoriumCore: '#f4ff9a',
  thoriumGlow: 'rgba(170,255,60,0.55)',
  text: '#ffffff',
  textDim: '#8a90b0',
  warning: '#ff3355',
  money: '#c8ff4d',
  health: '#38f26a',
  research: '#2fd8ff',
  laser: '#ff2a3a',
  plasma: '#fff3a0',
  plasmaCore: '#ffffff',
  cryo: '#6fd8ff',
  fireball: '#ff9a2a',
  explosion: '#ffb347',
  metalDark: '#3a3d46',
  metalMid: '#6b707c',
  metalLight: '#a9afbb',
  sidebar: '#0b0c12',
  white: '#ffffff',
} as const;

export interface TeamPalette {
  main: string;
  bright: string;
  dark: string;
  glow: string;
  name: string;
}

export const PALETTES: Record<PaletteKey, TeamPalette> = {
  blue: { main: '#2aa8ff', bright: '#a8e4ff', dark: '#0a2f52', glow: 'rgba(42,168,255,0.6)', name: 'BLUE' },
  purple: { main: '#b45cff', bright: '#f0d36b', dark: '#3a1257', glow: 'rgba(180,92,255,0.6)', name: 'PURPLE' },
  red: { main: '#ff3b3b', bright: '#ffb0a0', dark: '#4f0a0a', glow: 'rgba(255,59,59,0.6)', name: 'RED' },
};

export function paletteOf(player: PlayerState): TeamPalette {
  return PALETTES[player.palette];
}

export function otherTeam(team: 0 | 1): 0 | 1 {
  return team === 0 ? 1 : 0;
}
