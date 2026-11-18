import type { Palette } from './palettes';
import { type FloorColors, type FloorSample, type FloorSpec, addGlow, mixInto, resetSample, scaleRgb } from './floorCommon';
import { fbm, hash2, smoothstep, valueNoise, voronoi } from './noise';

/** Gaia: mossy olive floor with dirt patches, lighter grass tufts and pebble bumps. */
export function sampleOrganic(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const u = x / spec.w;
  const v = y / spec.h;
  resetSample(s, p.floor.roughness);
  const macro = fbm(u * 4, v * 4, 4, 4, 3, 1);
  mixInto(s.rgb, c.base, c.alt, smoothstep(0.35, 0.7, macro));
  const dirt = smoothstep(0.56, 0.66, fbm(u * 3, v * 3, 3, 3, 3, 7));
  mixInto(s.rgb, s.rgb, c.seam, dirt * 0.6);
  const fine = fbm(u * 64, v * 64, 64, 64, 2, 3);
  scaleRgb(s.rgb, 0.8 + 0.4 * fine);
  const peb = voronoi(u * 28, v * 28, 28, 28, 5);
  const pebble = smoothstep(0.0, 0.35, peb.d2 - peb.d1) * (hash2(peb.id, 0, 6) < 0.5 ? 1 : 0.4);
  s.h = fine * 0.5 + pebble * 0.5 + dirt * 0.1;
  mixInto(s.rgb, s.rgb, c.bevel, (1 - pebble) * 0.12);
  s.rough += 0.06 * (fine - 0.5) + 0.04 * dirt;
}

/** Hathor: sand ripples with sparse turquoise glints. */
export function sampleDunes(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const u = x / spec.w;
  const v = y / spec.h;
  resetSample(s, p.floor.roughness);
  const warp = fbm(u * 3, v * 3, 3, 3, 3, 2);
  const ripple = 0.5 + 0.5 * Math.sin((v * 6 + warp * 3 + 0.3 * Math.sin(u * Math.PI * 4)) * Math.PI * 2);
  const patch = fbm(u * 5, v * 5, 5, 5, 3, 9);
  mixInto(s.rgb, c.alt, c.base, smoothstep(0.25, 0.75, ripple * 0.6 + patch * 0.5));
  const grain = hash2(Math.floor(x), Math.floor(y), 12);
  scaleRgb(s.rgb, 0.9 + 0.1 * grain);
  s.h = ripple * 0.7 + warp * 0.3;
  const cell = 14;
  const gx = Math.floor(u * cell);
  const gy = Math.floor(v * cell);
  if (hash2(gx, gy, 31) < p.inlay.amount * 0.5) {
    const cx = (gx + 0.2 + 0.6 * hash2(gx, gy, 32)) / cell;
    const cy = (gy + 0.2 + 0.6 * hash2(gx, gy, 33)) / cell;
    const d = Math.hypot((u - cx) * spec.w, (v - cy) * spec.h);
    addGlow(s, c.inlay, 1 - smoothstep(2.5, 5, d));
    s.h += (1 - smoothstep(2.5, 6, d)) * 0.4;
  }
}

function crackField(u: number, v: number, cells: number, seed: number) {
  const vor = voronoi(u * cells, v * cells, cells, cells, seed);
  return { vor, edge: vor.d2 - vor.d1 };
}

/** Aether: frosted ice slabs split by deep blue cracks with glowing veins. */
export function sampleIce(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const u = x / spec.w;
  const v = y / spec.h;
  resetSample(s, p.floor.roughness);
  const { vor, edge } = crackField(u, v, 4, 3);
  const cloud = fbm(u * 6, v * 6, 6, 6, 4, 4);
  mixInto(s.rgb, c.base, c.alt, smoothstep(0.3, 0.7, cloud * 0.7 + hash2(vor.id, 2, 2) * 0.4));
  const frost = valueNoise(u * 96, v * 96, 96, 96, 6);
  scaleRgb(s.rgb, 0.92 + 0.12 * frost);
  const crack = 1 - smoothstep(0.015, 0.05, edge);
  mixInto(s.rgb, s.rgb, c.seam, crack * 0.85);
  s.h = smoothstep(0, 0.08, edge) * 0.8 + cloud * 0.2;
  s.rough += 0.3 * (1 - cloud) * frost + crack * 0.4;
  if (hash2(vor.id, 5, 5) < p.inlay.amount) addGlow(s, c.inlay, (1 - smoothstep(0.004, 0.02, edge)) * 0.8);
}

/** Helios: black basalt plates with glowing lava veins in the cracks. */
export function sampleLava(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const u = x / spec.w;
  const v = y / spec.h;
  resetSample(s, p.floor.roughness);
  const { vor, edge } = crackField(u, v, 3, 8);
  const grit = fbm(u * 48, v * 48, 48, 48, 3, 2);
  mixInto(s.rgb, c.base, c.alt, hash2(vor.id, 3, 3) * 0.6 + grit * 0.4);
  scaleRgb(s.rgb, 0.8 + 0.4 * grit);
  const bevel = smoothstep(0.03, 0.05, edge) * (1 - smoothstep(0.05, 0.09, edge));
  mixInto(s.rgb, s.rgb, c.bevel, bevel * 0.35);
  const vein = 1 - smoothstep(0.012, 0.04, edge);
  mixInto(s.rgb, s.rgb, c.seam, vein);
  s.h = smoothstep(0.01, 0.1, edge);
  const heat = 0.55 + 0.9 * fbm(u * 10, v * 10, 10, 10, 3, 5);
  const branch = hash2(vor.id, 7, 7) < p.inlay.amount + 0.35 ? 1 : 0.3;
  addGlow(s, c.inlay, vein * Math.min(1, heat) * branch);
  s.rough -= 0.25 * vein;
}
