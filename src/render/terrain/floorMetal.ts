import type { Palette } from './palettes';
import { type FloorColors, type FloorSample, type FloorSpec, addGlow, mixInto, resetSample, scaleRgb } from './floorCommon';
import { clamp01, hash2, smoothstep, valueNoise } from './noise';

/** Tile-sized slabs: amber rivets on slate, inset hex sockets and cyan strips on armour. */
export function samplePanels(s: FloorSample, p: Palette, c: FloorColors, spec: FloorSpec, x: number, y: number): void {
  const n = spec.tilesX;
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
  if (p.pattern === 'hex') {
    const dx = Math.abs(lx - 16), dy = Math.abs(ly - 16);
    const socket = Math.max(dx, dx * 0.5 + dy * Math.sqrt(3) / 2);
    scaleRgb(s.rgb, 0.68 + 0.32 * smoothstep(5, 7, socket));
    if (hash2(ix, iy, 21) < p.inlay.amount) {
      const strip = Math.max(Math.abs(ly - 16) - 1, Math.abs(lx - 36) - 10);
      addGlow(s, c.inlay, 1 - smoothstep(0, 2, strip));
    }
  } else if (hash2(ix, iy, 21) < p.inlay.amount) {
    const d = Math.hypot(cx - 11, cy - 11);
    addGlow(s, c.inlay, clamp01(1 - smoothstep(2, 3, d)));
    if (d < 3.5) s.h += 0.3;
  }
}
