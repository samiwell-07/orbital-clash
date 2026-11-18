import { describe, expect, it } from 'vitest';
import { addStructure, addUnit, removeStructure } from '@/sim/core/entities';
import { ensureFlow, flowDir, flowDist, FLOW_INF, pathExists, rebuildFlow, wouldBlockPath } from '@/sim/core/flow';
import { createGrid, gridVersion, isBlocked } from '@/sim/core/grid';
import { openWorld } from './helpers';

function setBase(w: ReturnType<typeof openWorld>, tx: number, ty: number) {
  const p = w.players[0];
  p.baseBuilt = true;
  p.baseTx = tx;
  p.baseTy = ty;
}

describe('grid', () => {
  it('parses rows and tracks occupancy with a version counter', () => {
    const g = createGrid({ w: 3, h: 2, rows: ['.#o', '...'] });
    expect([...g.terrain]).toEqual([0, 1, 2, 0, 0, 0]);
    expect(isBlocked(g, 1, 0)).toBe(true);
    expect(isBlocked(g, 2, 0)).toBe(true);
    expect(isBlocked(g, -1, 0)).toBe(true);
    expect(isBlocked(g, 0, 1)).toBe(false);
  });

  it('structures block tiles and bump the version', () => {
    const w = openWorld();
    const v = gridVersion(w.grid);
    const s = addStructure(w, { kind: 'turret', owner: 0, tx: 3, ty: 3, hp: 50 });
    expect(isBlocked(w.grid, 3, 3)).toBe(true);
    expect(gridVersion(w.grid)).toBeGreaterThan(v);
    removeStructure(w, s.id);
    expect(isBlocked(w.grid, 3, 3)).toBe(false);
  });
});

describe('flow field', () => {
  it('routes around obstacles and never through them', () => {
    const w = openWorld(9, 7);
    setBase(w, 8, 3);
    for (let y = 0; y < 6; y++) addStructure(w, { kind: 'turret', owner: 1, tx: 4, ty: y });
    const f = rebuildFlow(w, 0);
    expect(flowDist(f, 0.5, 3.5)).not.toBe(FLOW_INF);
    // follow the field from (0.5, 3.5) to the base
    let x = 0.5;
    let y = 3.5;
    let crossedRow6 = false;
    for (let i = 0; i < 200; i++) {
      const d = flowDir(f, x, y);
      if (d.x === 0 && d.y === 0) break;
      x += d.x * 0.25;
      y += d.y * 0.25;
      expect(isBlocked(w.grid, Math.floor(x), Math.floor(y))).toBe(false);
      if (Math.floor(x) === 4 && Math.floor(y) === 6) crossedRow6 = true;
    }
    expect(crossedRow6).toBe(true);
    expect(Math.floor(x)).toBe(8);
  });

  it('does not cut corners diagonally', () => {
    const w = openWorld(5, 5);
    setBase(w, 2, 2);
    addStructure(w, { kind: 'turret', owner: 1, tx: 1, ty: 2 });
    addStructure(w, { kind: 'turret', owner: 1, tx: 2, ty: 1 });
    const f = rebuildFlow(w, 0);
    // (1,1) touches the base only diagonally between two blocked tiles
    expect(flowDist(f, 1.5, 1.5)).toBeGreaterThan(14);
  });

  it('caches until occupancy changes, and reports unreachable tiles', () => {
    const w = openWorld(6, 5);
    setBase(w, 5, 2);
    const f1 = ensureFlow(w, 0);
    expect(ensureFlow(w, 0)).toBe(f1);
    const before = f1.version;
    for (let y = 0; y < 5; y++) addStructure(w, { kind: 'turret', owner: 1, tx: 3, ty: y });
    const f2 = ensureFlow(w, 0);
    expect(f2.version).toBeGreaterThan(before);
    expect(flowDist(f2, 0.5, 2.5)).toBe(FLOW_INF);
    expect(flowDir(f2, 0.5, 2.5)).toEqual({ x: 0, y: 0 });
  });
});

describe('pathExists / wouldBlockPath', () => {
  it('pathExists reflects walls', () => {
    const w = openWorld(7, 5);
    expect(pathExists(w, { tx: 0, ty: 0 }, { tx: 6, ty: 4 })).toBe(true);
    for (let y = 0; y < 5; y++) addStructure(w, { kind: 'turret', owner: 1, tx: 3, ty: y });
    expect(pathExists(w, { tx: 0, ty: 0 }, { tx: 6, ty: 4 })).toBe(false);
  });

  it('refuses a build that seals a hostile spawn tower off from the target base', () => {
    const w = openWorld(7, 3);
    setBase(w, 6, 1);
    w.players[1].team = 1;
    addStructure(w, { kind: 'basicOps', owner: 1, tx: 0, ty: 1 });
    addStructure(w, { kind: 'turret', owner: 1, tx: 3, ty: 0 });
    addStructure(w, { kind: 'turret', owner: 1, tx: 3, ty: 2 });
    expect(wouldBlockPath(w, 3, 1, 0)).toBe(true);
    expect(wouldBlockPath(w, 2, 1, 0)).toBe(true);
    expect(wouldBlockPath(w, 5, 0, 0)).toBe(false);
  });

  it('also protects live ground units, but ignores friendly towers', () => {
    const w = openWorld(7, 3);
    setBase(w, 6, 1);
    addStructure(w, { kind: 'turret', owner: 1, tx: 3, ty: 0 });
    addStructure(w, { kind: 'turret', owner: 1, tx: 3, ty: 2 });
    addStructure(w, { kind: 'basicOps', owner: 0, tx: 0, ty: 1 });
    expect(wouldBlockPath(w, 3, 1, 0)).toBe(false);
    addUnit(w, { kind: 'tank', owner: 1, x: 1.5, y: 1.5, targetPlayer: 0 });
    expect(wouldBlockPath(w, 3, 1, 0)).toBe(true);
  });
});
