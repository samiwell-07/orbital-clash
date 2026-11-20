import { describe, expect, it } from 'vitest';
import type { MapDef } from '@/types';
import { BATTLE_MAPS, battleMapSummaries } from '@/data/battle-maps';
import { findMap } from '@/sim/core/defaultMap';
import { MAP_H, MAP_W } from '@/config/constants';

const at = (m: MapDef, x: number, y: number): string => m.rows[y][x];

function floodFrom(m: MapDef, sx: number, sy: number): Set<number> {
  const seen = new Set<number>([sy * m.w + sx]);
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop() as [number, number];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h || at(m, nx, ny) !== '.' || seen.has(ny * m.w + nx)) continue;
      seen.add(ny * m.w + nx);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

describe('battle map set', () => {
  it('ships 16 maps: 4 base + 4 from patch 1.03 (one per comet) + 8 expansion maps (two per comet)', () => {
    expect(BATTLE_MAPS).toHaveLength(16);
    const s = battleMapSummaries();
    for (const release of ['base', 'patch-1.03'] as const) {
      expect(s.filter((m) => m.release === release).map((m) => m.palette).sort()).toEqual(['aether', 'hathor', 'helios', 'kreios']);
    }
    expect(s.filter((m) => m.release === 'expansion').map((m) => m.palette).sort())
      .toEqual(['aether', 'aether', 'hathor', 'hathor', 'helios', 'helios', 'kreios', 'kreios']);
    expect(new Set(BATTLE_MAPS.map((m) => m.id)).size).toBe(16);
    expect(new Set(BATTLE_MAPS.map((m) => m.name)).size).toBe(16);
    expect(s.some((m) => m.freeBase)).toBe(true);
  });

  it('registers every map so createWorld can find it', () => {
    for (const m of BATTLE_MAPS) expect(findMap(m.id)).toBe(m);
  });

  it('summaries match the maps', () => {
    for (const sum of battleMapSummaries()) {
      const m = BATTLE_MAPS.find((x) => x.id === sum.id) as MapDef;
      expect(sum).toMatchObject({ w: m.w, h: m.h, thoriumLevel: m.thoriumLevel, maxPlayers: m.baseTiles.length, rockCount: m.rockCount });
      expect(sum.maxPlayers).toBeGreaterThanOrEqual(2);
    }
  });
});

describe.each(BATTLE_MAPS.map((m) => [m.id, m] as const))('map %s', (_id, m) => {
  it('has a valid size, glyphs, thorium level and rocks', () => {
    expect(m.w).toBe(m.h);
    expect(m.w).toBeLessThanOrEqual(MAP_W);
    expect(m.h).toBeLessThanOrEqual(MAP_H);
    expect(m.rows).toHaveLength(m.h);
    for (const r of m.rows) expect(r).toMatch(new RegExp(`^[.#o]{${m.w}}$`));
    expect([1, 2, 3]).toContain(m.thoriumLevel);
    expect(m.rockCount).toBeGreaterThan(0);
    expect(['kreios', 'hathor', 'aether', 'helios']).toContain(m.palette);
    expect(m.baseTiles.length).toBeGreaterThanOrEqual(2);
    expect(m.baseTiles.length).toBeLessThanOrEqual(4);
    let floor = 0;
    for (const r of m.rows) floor += r.split('').filter((c) => c === '.').length;
    expect(floor / (m.w * m.h)).toBeGreaterThan(0.55);
    expect(floor / (m.w * m.h)).toBeLessThan(0.92);
  });

  it('uses connected rock walls inside the rim, not scattered obstacles', () => {
    const walls = m.rows.flatMap((row, y) => Array.from(row, (c, x) =>
      c === '#' && x >= 2 && y >= 2 && x < m.w - 2 && y < m.h - 2 ? y * m.w + x : -1,
    )).filter((i) => i >= 0);
    const remaining = new Set(walls);
    let longest = 0;
    for (const i of walls) {
      if (!remaining.delete(i)) continue;
      const component = [i];
      for (const cell of component) {
        for (const n of [cell - 1, cell + 1, cell - m.w, cell + m.w]) {
          if (remaining.delete(n)) component.push(n);
        }
      }
      longest = Math.max(longest, component.length);
    }
    expect(longest).toBeGreaterThanOrEqual(7);
  });

  it('is rotationally symmetric so every player faces the same terrain', () => {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) expect(at(m, x, y)).toBe(at(m, m.w - 1 - x, m.h - 1 - y));
  });

  it('leaves every floor tile reachable and every start tile free with room around it', () => {
    const tiles = m.baseTiles.filter((t): t is { tx: number; ty: number } => t !== null);
    const seed: [number, number] = tiles.length ? [tiles[0].tx, tiles[0].ty] : [Math.floor(m.w / 2), Math.floor(m.h / 2)];
    const all = floodFrom(m, seed[0], seed[1]);
    let floor = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(m, x, y) === '.') floor++;
    if (tiles.length) expect(all.size).toBe(floor);
    for (const t of tiles) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) expect(at(m, t.tx + dx, t.ty + dy)).toBe('.');
      expect(all.has(t.ty * m.w + t.tx)).toBe(true);
    }
  });

  it('gives fair, symmetric starts: opposite players are 180 degree images; 4-start maps are mirror-symmetric too', () => {
    const t = m.baseTiles;
    if (t.every((b) => b === null)) return;
    const rot = (b: { tx: number; ty: number }) => ({ tx: m.w - 1 - b.tx, ty: m.h - 1 - b.ty });
    expect(t[1]).toEqual(rot(t[0] as { tx: number; ty: number }));
    if (t.length === 4) {
      expect(t[3]).toEqual(rot(t[2] as { tx: number; ty: number }));
      expect((t[2] as { tx: number }).tx).toBe(m.w - 1 - (t[0] as { tx: number }).tx);
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) expect(at(m, x, y)).toBe(at(m, m.w - 1 - x, y));
    }
  });

  it('links every pair of bases by ground; free-base maps have one floor region with room for every player', () => {
    const tiles = m.baseTiles.filter((b): b is { tx: number; ty: number } => b !== null);
    for (const a of tiles) {
      const reach = floodFrom(m, a.tx, a.ty);
      for (const b of tiles) expect(reach.has(b.ty * m.w + b.tx)).toBe(true);
    }
    if (tiles.length) return;
    const floor: [number, number][] = [];
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (at(m, x, y) === '.') floor.push([x, y]);
    expect(floodFrom(m, floor[0][0], floor[0][1]).size).toBe(floor.length);
    const roomy = ([x, y]: [number, number]): boolean => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (m.rows[y + dy]?.[x + dx] !== '.') return false;
      return true;
    };
    const sites = floor.filter(roomy);
    const far = sites.some((p) => sites.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) > 14));
    expect(far).toBe(true);
    if (m.baseTiles.length < 4) return;
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      expect(sites.some(([x, y]) => (x < m.w / 2 ? 0 : 1) === qx && (y < m.h / 2 ? 0 : 1) === qy)).toBe(true);
    }
  });

  it('keeps start tiles far apart', () => {
    const t = m.baseTiles.filter((b): b is { tx: number; ty: number } => b !== null);
    for (let i = 0; i < t.length; i++) {
      for (let j = i + 1; j < t.length; j++) expect(Math.hypot(t[i].tx - t[j].tx, t[i].ty - t[j].ty)).toBeGreaterThan(14);
    }
  });
});
