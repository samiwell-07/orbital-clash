import { describe, expect, it } from 'vitest';
import { TICK_DT } from '@/config/constants';
import { createPipeline, rebuild, removeDeadUnits } from '@/sim/core';
import { registerCombatSystems } from '@/sim/combat';
import { arena, putUnit, putWeapon } from './helpers';

describe('stress', () => {
  it('1000 units vs 40 mixed weapons through the registered pipeline stays fast', () => {
    registerCombatSystems();
    const w = arena(false, 48, 30);
    const kinds = ['turret', 'laser', 'pulsar', 'bomber'] as const;
    for (let i = 0; i < 40; i++) putWeapon(w, kinds[i % 4], 0, 4 + (i % 10) * 4, 4 + Math.floor(i / 10) * 7, 2);
    for (let i = 0; i < 1000; i++) {
      const kind = i % 3 === 0 ? 'drone' : i % 3 === 1 ? 'scout' : 'tank';
      putUnit(w, kind, 1, 1 + ((i * 7) % 46), 1 + ((i * 13) % 28), 400);
    }
    const stages = createPipeline().filter((s) => s.name === 'combat' || s.name === 'projectiles');
    expect(stages.map((s) => s.name)).toEqual(['combat', 'projectiles']);
    const emit = (e: (typeof w.events)[number]) => w.events.push(e);
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) {
      rebuild(w);
      for (const s of stages) s.run(w, TICK_DT, emit);
      removeDeadUnits(w);
      w.events.length = 0;
    }
    const ms = performance.now() - t0;
    expect(ms).toBeLessThan(15000);
    expect(w.units.length).toBeLessThan(1000);
    expect(w.projectiles.length).toBeLessThan(500);
  });
});
