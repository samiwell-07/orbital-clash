import type { Palette } from './palettes';
import { type FloorColors, type FloorSample, type FloorSpec, addGlow, mixInto, resetSample, scaleRgb } from './floorCommon';
import { clamp01, hash2, hexCell, smoothstep, valueNoise } from './noise';

const SQ3 = Math.sqrt(3);
const HEX_N = 2;

/** Kronos-style hexagonal metal plates: seams, bevel, engraved inner line, cyan inlay strips and beacons. */
export function sampleHex(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const r = spec.w / (3 * HEX_N);
  const cell = hexCell(x / r, y / (spec.h / (HEX_N * SQ3)), HEX_N, HEX_N);
  const e = cell.edge * r;
  resetSample(s, p.floor.roughness);
  mixInto(s.rgb, c.base, c.alt, hash2(cell.id, 0, 1));
  scaleRgb(s.rgb, 0.94 + 0.12 * hash2(cell.id, 1, 2));
  const scratch = valueNoise((x / spec.w) * 48, (y / spec.h) * 400, 48, 400, 5);
  scaleRgb(s.rgb, 0.96 + 0.08 * scratch);
  const len = Math.hypot(cell.dx, cell.dy) + 1e-6;
  const facing = Math.max(0, (-cell.dx - cell.dy) / (len * 1.414));
  const bevel = smoothstep(4.5, 6, e) * (1 - smoothstep(7, 10, e));
  mixInto(s.rgb, s.rgb, c.bevel, bevel * facing * 0.7);
  const engrave = 1 - smoothstep(0, 1.6, Math.abs(e - 26));
  scaleRgb(s.rgb, 1 - 0.28 * engrave);
  mixInto(s.rgb, s.rgb, c.seam, 1 - smoothstep(2, 4.5, e));
  s.h = smoothstep(0, 5, e) * 0.8 - engrave * 0.2;
  s.rough += 0.12 * (scratch - 0.5) + 0.35 * (1 - smoothstep(2, 6, e));
  if (hash2(Math.min(cell.id, cell.neighbor), Math.max(cell.id, cell.neighbor), 9) < p.inlay.amount) {
    addGlow(s, c.inlay, 1 - smoothstep(1.5, 4, Math.abs(e - 13)));
  }
  if (hash2(cell.id, 3, 7) < 0.18) {
    const d = Math.hypot(cell.dx, cell.dy) * r;
    addGlow(s, c.inlay, Math.max(1 - smoothstep(1.5, 3.5, Math.abs(d - 20)), 1 - smoothstep(6, 9, d)));
  }
}

/** Kreios-style square slate slabs with amber rivets at some corners. */
export function samplePanels(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const n = 2;
  const size = spec.w / n;
  const ix = Math.floor(x / size);
  const iy = Math.floor(y / size);
  const lx = x - ix * size;
  const ly = y - iy * size;
  const id = iy * n + ix;
  const e = Math.min(lx, ly, size - lx, size - ly);
  resetSample(s, p.floor.roughness);
  mixInto(s.rgb, c.base, c.alt, hash2(id, 4, 11));
  const grit = valueNoise((x / spec.w) * 64, (y / spec.h) * 64, 64, 64, 3);
  const speck = hash2(Math.floor(x), Math.floor(y), 5);
  scaleRgb(s.rgb, 0.88 + 0.18 * grit + 0.06 * speck);
  const bevel = smoothstep(4, 5, e) * (1 - smoothstep(6, 9, e)) * (lx < ly ? 1 : 0.4);
  mixInto(s.rgb, s.rgb, c.bevel, bevel * 0.5);
  mixInto(s.rgb, s.rgb, c.seam, 1 - smoothstep(3, 6, e));
  s.h = smoothstep(0, 5, e) * 0.7 + grit * 0.3;
  s.rough += 0.15 * (grit - 0.5);
  const cx = Math.min(lx, size - lx);
  const cy = Math.min(ly, size - ly);
  if (hash2(id, 8, 21) < p.inlay.amount * 2) {
    const d = Math.hypot(cx - 22, cy - 22);
    addGlow(s, c.inlay, clamp01(1 - smoothstep(4, 6, d)));
    if (d < 7) s.h += 0.3;
  }
}
