import { describe, expect, it } from 'vitest';
import type { Difficulty, Mission } from '@/types';
import { pathExists } from '@/sim/core/flow';
import { createWorld } from '@/sim/core';
import { compile, startCampaign, applyMissionSetup } from '@/sim/modes/campaign';
import { ALL_MISSIONS, TEACH, getMission, missionSummaries, unlockedBefore } from '@/data/areas';
import { ALL_TECH_KEYS } from '@/data';

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
    expect(missionSummaries()).toHaveLength(32);
  });

  it.each(ALL_MISSIONS.map((m) => [m.id, m] as const))('%s compiles with zero errors on every difficulty', (_id, m) => {
    for (const d of DIFFS) expect(compile(m, d).errors).toEqual([]);
  });

  it.each(ALL_MISSIONS.map((m) => [m.id, m] as const))('%s: map, bases and structures are valid', (_id, m) => {
    expect(m.map.w).toBeLessThanOrEqual(48);
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
    let same = 0;
    for (let y = 0; y < m.map.h; y++) {
      for (let x = 0; x < m.map.w; x++) same += (rows[y][x] === '.') === (rows[m.map.h - 1 - y][m.map.w - 1 - x] === '.') ? 1 : 0;
    }
    expect(same / (m.map.w * m.map.h)).toBeGreaterThan(0.85);
    expect(rows.join('')).toContain('#');
    expect(rows.join('')).toContain('o');
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
