import { describe, expect, it } from 'vitest';
import { ALL_PALETTE_IDS, PALETTES, getPalette } from '@/render/terrain/palettes';
import { fbm, hash2, hexCell, valueNoise, voronoi } from '@/render/terrain/noise';
import { bakeFloorMaps, floorSpec, heightToNormal } from '@/render/terrain/textures';
import type { PaletteId } from '@/types';

const EXPECTED: PaletteId[] = ['kreios', 'hathor', 'aether', 'helios', 'gaia', 'kronos'];

describe('palette tables', () => {
  it('cover every PaletteId', () => {
    expect([...ALL_PALETTE_IDS].sort()).toEqual([...EXPECTED].sort());
    for (const id of EXPECTED) {
      const p = getPalette(id);
      expect(p.id).toBe(id);
      expect(p.light.exposure).toBeGreaterThan(0.8);
      expect(p.skirt.top).toBeTypeOf('number');
      expect(p.space.a).toBeTypeOf('number');
    }
  });

  it('keeps glowing inlays above the bloom threshold and floors mid/dark', () => {
    for (const id of EXPECTED) {
      const p = PALETTES[id];
      if (p.inlay.style !== 'none') expect(p.inlay.intensity).toBeGreaterThanOrEqual(2);
      const lum = (((p.floor.base >> 16) & 255) * 0.2126 + ((p.floor.base >> 8) & 255) * 0.7152 + (p.floor.base & 255) * 0.0722) / 255;
      expect(lum).toBeLessThan(0.7);
    }
  });

  it('matches the style-guide Kronos and Gaia colours', () => {
    expect(PALETTES.kronos.floor.base).toBe(0x5a5896);
    expect(PALETTES.kronos.inlay.color).toBe(0x33e6ff);
    expect(PALETTES.gaia.floor.base).toBe(0x4f5a22);
    expect(PALETTES.kronos.pattern).toBe('hex');
  });
});

describe('noise', () => {
  it('hash2 is deterministic and in [0,1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = hash2(i, i * 7, 3);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(hash2(i, i * 7, 3)).toBe(v);
    }
    expect(hash2(1, 2, 3)).not.toBe(hash2(2, 1, 3));
  });

  it('valueNoise and fbm stay in range and repeat with their period', () => {
    for (let i = 0; i < 100; i++) {
      const x = i * 0.37;
      const y = i * 0.61;
      const a = valueNoise(x, y, 8, 6, 2);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(valueNoise(x + 8, y + 6, 8, 6, 2)).toBeCloseTo(a, 9);
      const f = fbm(x, y, 4, 4, 3, 1);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      expect(fbm(x + 4, y + 4, 4, 4, 3, 1)).toBeCloseTo(f, 9);
    }
  });

  it('voronoi is periodic and d1 <= d2', () => {
    for (let i = 0; i < 100; i++) {
      const x = i * 0.173;
      const y = i * 0.291;
      const a = voronoi(x, y, 5, 5, 3);
      expect(a.d1).toBeLessThanOrEqual(a.d2);
      const b = voronoi(x + 5, y + 5, 5, 5, 3);
      expect(b.id).toBe(a.id);
      expect(b.d1).toBeCloseTo(a.d1, 9);
    }
  });

  it('hexCell is periodic, has sane edge distances and consistent neighbours', () => {
    const w = 3 * 2;
    const h = Math.sqrt(3) * 2;
    for (let i = 0; i < 300; i++) {
      const x = (i * 0.731) % 9;
      const y = (i * 0.417) % 7;
      const c = hexCell(x, y, 2, 2);
      expect(c.edge).toBeGreaterThanOrEqual(-1e-9);
      expect(c.edge).toBeLessThanOrEqual(Math.sqrt(3) / 2 + 1e-9);
      const p = hexCell(x + w, y + h, 2, 2);
      expect(p.id).toBe(c.id);
      expect(p.edge).toBeCloseTo(c.edge, 9);
      expect(c.id).not.toBe(c.neighbor);
      expect(c.id).toBeLessThan(8);
      expect(c.neighbor).toBeLessThan(8);
    }
  });

  it('hexCell: a point just across a seam sees the neighbour as its own plate', () => {
    const c = hexCell(0, Math.sqrt(3) / 2 - 0.01, 2, 2);
    const across = hexCell(0, Math.sqrt(3) / 2 + 0.01, 2, 2);
    expect(across.id).toBe(c.neighbor);
    expect(across.neighbor).toBe(c.id);
  });
});

describe('floor texture bake', () => {
  it('uses a seamless hex period that is a whole number of plates', () => {
    const s = floorSpec('hex');
    expect(s.w / s.h).toBeCloseTo(Math.sqrt(3), 2);
    expect(s.tilesX).toBeCloseTo(12, 6);
  });

  it('bakes Kronos with cyan emissive inlays and flat-up normals on average', () => {
    const b = bakeFloorMaps(PALETTES.kronos);
    const n = b.spec.w * b.spec.h;
    let glow = 0;
    let nz = 0;
    for (let i = 0; i < n; i += 7) {
      if (b.emissive[i * 4 + 2] > 128) glow++;
      nz += b.normal[i * 4 + 2];
    }
    expect(glow).toBeGreaterThan(50);
    expect(nz / Math.ceil(n / 7)).toBeGreaterThan(200);
  });

  it('heightToNormal points up on a flat field and tilts on a ramp', () => {
    const flat = heightToNormal(new Float32Array(16), 4, 4, 2);
    expect(flat[2]).toBe(255);
    expect(flat[0]).toBe(128);
    const ramp = new Float32Array(16).map((_, i) => (i % 4) * 0.2);
    const out = heightToNormal(ramp, 4, 4, 2);
    expect(out[4 + 0]).toBeLessThan(128);
  });
});
