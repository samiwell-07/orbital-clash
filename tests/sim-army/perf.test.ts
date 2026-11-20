import { describe, expect, it } from 'vitest';
import { launchBatch } from '@/sim/army';
import { addStructure } from '@/sim/core';
import { arena, tick } from './helpers';

describe('performance', () => {
  it('runs 2000 train units at 60 Hz within a generous bound', () => {
    const w = arena(48, 30);
    for (let y = 4; y < 26; y++) addStructure(w, { kind: 'turret', owner: 1, tx: 24, ty: y, hp: 1e9 });
    w.players[0].stored.scout = 1000;
    w.players[0].stored.tank = 1000;
    expect(launchBatch(w, 0, 'scout', 1000)).toBe(1000);
    expect(launchBatch(w, 0, 'tank', 1000)).toBe(1000);
    const ticks = 60 * 10;
    const t0 = performance.now();
    for (let i = 0; i < ticks; i++) tick(w);
    const ms = performance.now() - t0;
    expect(w.units.length).toBe(2000);
    expect(w.units.every((u) => Number.isFinite(u.x) && Number.isFinite(u.y))).toBe(true);
    expect(w.units.some((u) => u.travelled > 5)).toBe(true);
    expect(ms).toBeLessThan(8000);
  });
});
