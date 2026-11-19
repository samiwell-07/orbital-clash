import { PLAYER_COLORS } from '@/types';
import type { UnitKind } from '@/types';
import { PALETTE_SIZE, colorIndexFor } from '@/config/playerColors';

/** Crowd body colour per palette index (style-guide section 6): blue, red, purple, orange, green, cyan, pink, white. */
export const TEAM_BODY: readonly number[] = [0x2a9fd8, 0xc0222b, 0x9b44e6, 0xffc21a, 0x24b85a, 0x1fb8c4, 0xd8409e, 0xc8ccd4];
/** Highlight / spike-tip colour per palette index. */
export const TEAM_GLINT: readonly number[] = [0x8fe8ff, 0xf0f0f0, 0xe9d6ff, 0xff7a1a, 0xc8ffd8, 0xd0ffff, 0xffd0ee, 0x9fe0ff];
/** Emissive accent colour per palette index (== PLAYER_COLORS). */
export const TEAM_GLOW: readonly number[] = PLAYER_COLORS;

export const UNIT_ICON_COLORS: Readonly<Record<UnitKind, number>> = {
  scout: 0xf2f4ff, tank: 0xff4a4a, drone: 0x4dd8ff, torpedo: 0xff8a2a,
  hammer: 0xffa33a, switch: 0xffe14a, thief: 0x66ff9a, carrier: 0x66b8ff,
  snake: 0xb4ff4a, dragon: 0xff4dd2,
};
export const NO_OUTPUT_COLOR = 0x9aa0aa;

/** Per-kind multiplier applied on top of the team body colour (thief reads green-tinted). */
const NEUTRAL: readonly [number, number, number] = [1, 1, 1];
export const UNIT_TINT: Readonly<Partial<Record<UnitKind, readonly [number, number, number]>>> = {
  thief: [0.7, 1.0, 0.78],
  tank: [0.72, 0.72, 0.76],
  hammer: [0.8, 0.8, 0.84],
};

export const LASER_COLOR_LO = 0x4dd8ff;
export const LASER_COLOR_HI = 0xff4dd2;

/** Palette index (0..PALETTE_SIZE-1) of an owner's chosen colour; out-of-range owners give 0. */
export function teamIndex(owner: number): number {
  return colorIndexFor(owner);
}

/** Clamps an already-resolved palette index into the tables (does NOT go through the owner map). */
export function paletteIndex(index: number): number {
  return index >= 0 && index < PALETTE_SIZE ? index | 0 : 0;
}

export function unitTint(kind: UnitKind): readonly [number, number, number] {
  return UNIT_TINT[kind] ?? NEUTRAL;
}

export function unitIconColor(kind: UnitKind | null | undefined): number {
  return kind ? UNIT_ICON_COLORS[kind] : NO_OUTPUT_COLOR;
}

/** Deterministic integer hash mapped to [0,1). */
export function hash01(n: number): number {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Per-instance lightness jitter, +-8 %. */
export function jitterFactor(id: number): number {
  return 0.92 + 0.16 * hash01(id);
}

/** Writes 0xRRGGBB (sRGB) into out[o..o+2] as linear-ish 0..1 floats (plain gamma 2.2, three-free). */
export function hexToRgb(hex: number, out: number[] | Float32Array, o = 0): void {
  out[o] = Math.pow(((hex >> 16) & 255) / 255, 2.2);
  out[o + 1] = Math.pow(((hex >> 8) & 255) / 255, 2.2);
  out[o + 2] = Math.pow((hex & 255) / 255, 2.2);
}

export function lerpHex(a: number, b: number, t: number): number {
  const k = Math.min(1, Math.max(0, t));
  const r = Math.round(((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k);
  const g = Math.round(((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k);
  const bl = Math.round((a & 255) * (1 - k) + (b & 255) * k);
  return (r << 16) | (g << 8) | bl;
}

/** Laser beam / crystal colour: cyan at level 0, pink at max level. */
export function laserColor(level: number, maxLevel: number): number {
  return lerpHex(LASER_COLOR_LO, LASER_COLOR_HI, maxLevel > 0 ? level / maxLevel : 0);
}
