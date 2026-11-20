import { describe, expect, it } from 'vitest';
import { addUnit, removeDeadUnits } from '@/sim/core/entities';
import { nearest, queryRadius, rebuild } from '@/sim/core/spatial';
import { makeWorld } from './helpers';

describe('spatial hash', () => {
  it('queryRadius matches brute force', () => {
    const w = makeWorld();
    for (let i = 0; i < 400; i++) {
      addUnit(w, { kind: 'scout', owner: 0, x: (i * 7.31) % 48, y: (i * 3.77) % 30 });
    }
    rebuild(w);
    const found: number[] = [];
    queryRadius(w, 20, 12, 5, (u) => found.push(u.id));
    const expected = w.units.filter((u) => (u.x - 20) ** 2 + (u.y - 12) ** 2 <= 25).map((u) => u.id);
    expect(found.sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
    expect(found.length).toBeGreaterThan(0);
  });

  it('nearest respects filter, radius and ignores dead units', () => {
    const w = makeWorld();
    const a = addUnit(w, { kind: 'scout', owner: 0, x: 10, y: 10 });
    const b = addUnit(w, { kind: 'drone', owner: 1, x: 12, y: 10, layer: 'air' });
    const c = addUnit(w, { kind: 'tank', owner: 1, x: 10.5, y: 10 });
    c.state = 'dead';
    rebuild(w);
    expect(nearest(w, 10, 10, 5)?.id).toBe(a.id);
    expect(nearest(w, 10, 10, 5, (u) => u.layer === 'air')?.id).toBe(b.id);
    expect(nearest(w, 10, 10, 1)?.id).toBe(a.id);
    expect(nearest(w, 30, 20, 3)).toBeNull();
  });

  it('handles out-of-bounds units and 4000 units quickly', () => {
    const w = makeWorld();
    addUnit(w, { kind: 'scout', owner: 0, x: -3, y: -3 });
    for (let i = 0; i < 4000; i++) addUnit(w, { kind: 'scout', owner: 0, x: (i * 0.0119) % 48, y: (i * 0.0073) % 30 });
    rebuild(w);
    let n = 0;
    queryRadius(w, -3, -3, 1, () => n++);
    expect(n).toBe(1);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      rebuild(w);
      queryRadius(w, 24, 15, 3, () => n++);
    }
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  it('removeDeadUnits keeps order', () => {
    const w = makeWorld();
    const ids = [1, 2, 3, 4].map(() => addUnit(w, { kind: 'scout', owner: 0, x: 5, y: 5 }));
    ids[1].state = 'dead';
    expect(removeDeadUnits(w)).toBe(1);
    expect(w.units.map((u) => u.id)).toEqual([ids[0].id, ids[2].id, ids[3].id]);
  });
});
