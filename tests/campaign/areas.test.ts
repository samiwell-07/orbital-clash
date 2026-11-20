import { describe, expect, it } from 'vitest';
import type { Difficulty, Mission } from '@/types';
import { pathExists } from '@/sim/core/flow';
import { createGrid, createWorld } from '@/sim/core';
import { reachableFrom } from '@/sim/core/reach';
import { compile, startCampaign, applyMissionSetup } from '@/sim/modes/campaign';
import { ALL_MISSIONS, TEACH, getMission, missionSummaries, unlockedBefore } from '@/data/areas';
import { COMETS } from '@/data/areas/spec';
import { ROCK_GRIDS, placeBases } from '@/data/areas/rockGrids';

/** The original rock grid an area plays on, if any. */
const gridOf = (m: Mission) => (m.resurgence ? undefined : ROCK_GRIDS.get(COMETS.indexOf(m.comet) * 7 + m.index + 1));
import { ALL_TECH_KEYS } from '@/data';
import { BINDING_ROWS } from '@/input/bindings';

const DIFFS: Difficulty[] = ['beginner', 'casual', 'normal', 'expert'];

describe('authored areas', () => {
  it('has 28 regular areas and 4 Resurgence missions with unique ids', () => {
    expect(ALL_MISSIONS).toHaveLength(32);
    expect(new Set(ALL_MISSIONS.map((m) => m.id)).size).toBe(32);
    expect(ALL_MISSIONS.filter((m) => m.resurgence)).toHaveLength(4);
    for (const c of ['kreios', 'hathor', 'aether', 'helios'] as const) {
      for (let i = 0; i < 7; i++) expect(getMission(c, i)?.index).toBe(i);
      expect(getMission(c, 0, true)?.resurgence).toBe(true);
    }
    expect(missionSummaries().filter((s) => ALL_MISSIONS.some((m) => m.id === s.id))).toHaveLength(32);
  });

  it.each(ALL_MISSIONS.map((m) => [m.id, m] as const))('%s compiles with zero errors on every difficulty', (_id, m) => {
    for (const d of DIFFS) expect(compile(m, d).errors).toEqual([]);
  });

  it.each(ALL_MISSIONS.map((m) => [m.id, m] as const))('%s: map, bases and structures are valid', (_id, m) => {
    expect(m.map.w).toBe(m.map.h);
    expect(m.map.rows).toHaveLength(m.map.h);
    expect(m.map.h).toBeLessThanOrEqual(30);
    expect(m.map.palette).toBe(m.comet);
    expect(m.map.rows.every((r) => r.length === m.map.w)).toBe(true);
    const w = createWorld(startCampaign({ mission: m, difficulty: 'normal' }));
    expect(applyMissionSetup(w)).toEqual([]);
    const [human, enemy] = [m.map.baseTiles[0], m.map.baseTiles[1]];
    expect(human && enemy).toBeTruthy();
    expect(pathExists(w, human!, enemy!)).toBe(true);
    for (const s of w.structures.values()) {
      expect(w.grid.terrain[s.ty * w.grid.w + s.tx]).toBe(0);
      expect(pathExists(w, human!, { tx: s.tx, ty: s.ty })).toBe(true);
    }
    const rows = m.map.rows;
    if (gridOf(m)) return;
    let same = 0;
    for (let y = 0; y < m.map.h; y++) {
      for (let x = 0; x < m.map.w; x++) same += (rows[y][x] === '.') === (rows[m.map.h - 1 - y][m.map.w - 1 - x] === '.') ? 1 : 0;
    }
    expect(same / (m.map.w * m.map.h)).toBeGreaterThan(0.85);
    expect(rows.join('')).toContain('#');
    expect(rows.join('')).toContain('o');
  });

  it.each(ALL_MISSIONS)('$id has clear deployment pads and no sealed-off floor', (m) => {
    const { map } = m;
    const grid = createGrid(map);
    const start = map.baseTiles[0]!;
    const seen = reachableFrom(grid, start.tx, start.ty);
    expect(grid.terrain.every((t, i) => t !== 0 || seen[i] === 1)).toBe(true);
    map.baseTiles.forEach((base, i) => {
      const { tx, ty } = base!;
      const radius = i < 2 && !gridOf(m) ? 3 : 1;
      for (let dy = -radius; dy <= radius; dy++) {
        expect(map.rows[ty + dy].slice(tx - radius, tx + radius + 1)).toBe('.'.repeat(2 * radius + 1));
      }
    });
  });

  it('areas 1-40 play on their original rock grid (X = rock) and only Resurgences keep generated maps', () => {
    const numbered = missionSummaries().filter((s) => !s.resurgence);
    expect(ROCK_GRIDS.size).toBe(40);
    for (const [n, rows] of ROCK_GRIDS) {
      const s = numbered.find((a) => a.number === n)!;
      const m = getMission(s.comet, s.index)!;
      expect(m.map.rows, `area ${n}`).toEqual(rows);
      expect(rows.join('')).toMatch(/^[.#]+$/);
    }
    expect(gridOf(getMission('kreios', 0)!)?.[3]).toBe('......####.#####...###....####');
    for (const m of ALL_MISSIONS.filter((x) => x.resurgence)) expect(gridOf(m)).toBeUndefined();
  });

  it('places bases on clear pads far apart, keeping every route open', () => {
    for (const rows of ROCK_GRIDS.values()) {
      const [human, enemy, ...partners] = placeBases(rows);
      expect(partners).toHaveLength(2);
      for (const b of [human, enemy, ...partners]) {
        for (let dy = -1; dy <= 1; dy++) expect(rows[b.ty + dy].slice(b.tx - 1, b.tx + 2)).toBe('...');
      }
      expect(Math.abs(human.tx - enemy.tx) + Math.abs(human.ty - enemy.ty)).toBeGreaterThanOrEqual(9);
    }
  });

  it('retains the original build schedule sizes even on the more confined plateaus', () => {
    // Areas 1–7 followed by the Resurgence; Layout.pick can silently return too few sites.
    const builds = {
      kreios: [4, 4, 5, 5, 7, 7, 8, 14], hathor: [7, 8, 9, 9, 9, 11, 10, 15],
      aether: [10, 11, 12, 12, 12, 11, 13, 15], helios: [14, 14, 14, 15, 15, 15, 15, 16],
    };
    for (const m of ALL_MISSIONS) {
      if (m.comet === 'gaia' || m.comet === 'kronos') throw new Error(`unexpected expansion mission: ${m.id}`);
      expect(m.timeline.filter((e) => e.action.a === 'build'), m.id).toHaveLength(builds[m.comet][m.resurgence ? 7 : m.index]);
    }
  });

  it('every area has its own map and a rising difficulty ramp', () => {
    expect(new Set(ALL_MISSIONS.map((m) => m.map.rows.join('|'))).size).toBe(32);
    for (const c of ['kreios', 'hathor', 'aether', 'helios'] as const) {
      const areas = Array.from({ length: 7 }, (_, i) => getMission(c, i)!);
      for (let i = 1; i < 7; i++) {
        expect(areas[i].enemyHits.normal).toBeGreaterThanOrEqual(areas[i - 1].enemyHits.normal);
        expect(areas[i].parTimeSec).toBeGreaterThanOrEqual(areas[i - 1].parTimeSec);
      }
    }
    for (const m of ALL_MISSIONS) {
      const h = m.enemyHits;
      expect(h.beginner).toBeLessThan(h.casual);
      expect(h.casual).toBeLessThan(h.normal);
      expect(h.normal).toBeLessThanOrEqual(h.expert);
      if (m.resurgence) expect(m.hints).toHaveLength(0);
      else expect(m.hints.length).toBeGreaterThan(0);
    }
  });

  it('hints name controls as "(xbox · ps / key)" triples that match one BINDING_ROWS row', () => {
    const tokens = (s: string) => s.split(' / ').map((t) => t.replace(/\s*\(.*\)$/, '').replace(/^Hold /, '').trim());
    const rows = BINDING_ROWS.map((r) => ({ xbox: tokens(r.xbox), ps: tokens(r.ps), key: tokens(r.p1) }));
    const bare = /\b(RB|LB|RT|LT|RS|LS|R1|R2|R3|L1|L2|L3|Shift|Tab|Esc|Start|Square|Triangle|Cross|Circle)\b|\b[A-Z]\s*\/\s*[A-Z]\b/;
    let named = 0;
    for (const m of ALL_MISSIONS) {
      for (const h of m.hints) {
        for (const [, xbox, ps, key] of h.matchAll(/\(([^()]+?) · ([^()]+?) \/ ([^()]+?)\)/g)) {
          named++;
          const ok = rows.some((r) => r.xbox.includes(xbox) && r.ps.includes(ps) && r.key.includes(key));
          expect(ok, `${m.id}: "${xbox} · ${ps} / ${key}"`).toBe(true);
        }
        expect(h.replace(/\([^()]*\)/g, ''), `${m.id}: control named outside "(xbox · ps / key)"`).not.toMatch(bare);
      }
    }
    expect(named).toBeGreaterThan(0);
  });

  it('tech gating is consistent across areas', () => {
    const order = ALL_MISSIONS.filter((m) => !m.resurgence);
    let known = new Set<string>();
    for (const m of order) {
      expect([...m.unlocked].sort()).toEqual([...known].sort());
      expect(m.teaches).toBe(TEACH[m.comet][m.index]);
      expect(m.unlocked).not.toContain(m.teaches);
      if (m.teaches) {
        expect(ALL_TECH_KEYS).toContain(m.teaches);
        known = new Set([...known, m.teaches]);
      }
    }
    expect(['tank', 'laser', 'gateways', 'hammers']).toEqual(TEACH.kreios.filter(Boolean));
    expect(['pulsar', 'thief', 'bomber']).toEqual(TEACH.hathor.filter(Boolean));
    expect(['drone', 'switches', 'torpedoes', 'carrier']).toEqual(TEACH.aether.filter(Boolean));
    expect(TEACH.helios.filter(Boolean)).toContain('waypoint');
    for (const m of ALL_MISSIONS.filter((x) => x.resurgence)) {
      expect(m.unlocked).toEqual(unlockedBefore(m.comet, 0, true));
    }
  });

  it('the scripted enemy uses only authored events with escalating releases', () => {
    const m: Mission = getMission('helios', 6)!;
    const rel = m.timeline.filter((e) => e.action.a === 'release');
    expect(rel.length).toBeGreaterThan(8);
    const scouts = rel.flatMap((e) => (e.action.a === 'release' && e.action.kind === 'scout' ? [e.action.count] : []));
    for (let i = 1; i < scouts.length; i++) expect(scouts[i]).toBeGreaterThan(scouts[i - 1] as number);
    expect(m.timeline.every((e) => e.player === 1 && Number.isFinite(e.atSec) && e.atSec >= 0)).toBe(true);
  });
});
