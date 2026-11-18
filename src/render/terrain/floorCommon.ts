import type { Palette } from './palettes';

/** One texel of the baked floor maps. Colours are sRGB 0..1; `em` is the emissive inlay (before intensity). */
export interface FloorSample {
  rgb: [number, number, number];
  rough: number;
  h: number;
  em: [number, number, number];
}

/** Texture size in pixels and the world area (in tiles) one repeat covers. */
export interface FloorSpec {
  w: number;
  h: number;
  tilesX: number;
  tilesY: number;
}

export type Rgb = [number, number, number];

export function hexToRgb(hex: number): Rgb {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export function mixInto(out: Rgb, a: Rgb, b: Rgb, t: number): void {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

export function scaleRgb(c: Rgb, k: number): void {
  c[0] *= k;
  c[1] *= k;
  c[2] *= k;
}

export interface FloorColors {
  base: Rgb;
  alt: Rgb;
  seam: Rgb;
  bevel: Rgb;
  inlay: Rgb;
}

export function floorColors(p: Palette): FloorColors {
  return {
    base: hexToRgb(p.floor.base),
    alt: hexToRgb(p.floor.alt),
    seam: hexToRgb(p.floor.seam),
    bevel: hexToRgb(p.floor.bevel),
    inlay: hexToRgb(p.inlay.color),
  };
}

export function resetSample(s: FloorSample, rough: number): void {
  s.rgb[0] = s.rgb[1] = s.rgb[2] = 0;
  s.em[0] = s.em[1] = s.em[2] = 0;
  s.rough = rough;
  s.h = 0;
}

export function addGlow(s: FloorSample, inlay: Rgb, amount: number): void {
  s.em[0] = Math.min(1, s.em[0] + inlay[0] * amount);
  s.em[1] = Math.min(1, s.em[1] + inlay[1] * amount);
  s.em[2] = Math.min(1, s.em[2] + inlay[2] * amount);
}
