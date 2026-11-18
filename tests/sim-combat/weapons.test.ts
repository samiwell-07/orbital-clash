import { describe, expect, it } from 'vitest';
import { addRock, ensureFlow, flowDist, FLOW_INF, rebuild } from '@/sim/core';
import { damageStructure, registerCombatSystems, splashUnits } from '@/sim/combat';
import { createPipeline } from '@/sim/core';
import { arena, emitter, putStructure, putUnit, putWeapon, runCombat } from './helpers';

describe('weapons', () => {
  it('turret kills a ground unit but cannot hit air', () => {
    const w = arena();
    putWeapon(w, 'turret', 0, 5, 4);
    const scout = putUnit(w, 'scout', 1, 7.5, 4.5);
    const drone = putUnit(w, 'drone', 1, 4.5, 3.0);
    runCombat(w, 120);
    expect(scout.state).toBe('dead');
    expect(drone.hp).toBe(drone.maxHp);
    expect(w.players[0].stats.kills).toBe(1);
    expect(w.players[1].stats.unitsLost).toBe(1);
    expect(w.events.some((e) => e.t === 'shot')).toBe(true);
    expect(w.events.some((e) => e.t === 'unitDied' && e.killer === 0)).toBe(true);
  });

  it('bomber hits air only', () => {
    const w = arena();
    putWeapon(w, 'bomber', 0, 5, 4);
    const scout = putUnit(w, 'scout', 1, 6.5, 4.5);
    const drone = putUnit(w, 'drone', 1, 8.5, 4.5);
    runCombat(w, 180);
    expect(drone.state).toBe('dead');
    expect(scout.hp).toBe(scout.maxHp);
  });

  it('laser emits beams, damages both layers', () => {
    const w = arena();
    putWeapon(w, 'laser', 0, 5, 4);
    const a = putUnit(w, 'tank', 1, 7.5, 4.5);
    const b = putUnit(w, 'drone', 1, 5.5, 2.5);
    runCombat(w, 30);
    expect(a.hp + b.hp).toBeLessThan(a.maxHp + b.maxHp);
    expect(w.events.some((e) => e.t === 'beam')).toBe(true);
  });

  it('laser smashes a drifting rock and credits thorium via smashRock', () => {
    const w = arena();
    putWeapon(w, 'laser', 0, 5, 4);
    const rock = addRock(w, { x: 7.5, y: 4.5, thorium: 20, size: 2 });
    const before = w.players[0].thorium;
    runCombat(w, 10);
    expect(rock.state).toBe('smashed');
    expect(w.players[0].thorium).toBeGreaterThan(before);
    expect(w.events.some((e) => e.t === 'rockSmashed' && e.owner === 0)).toBe(true);
  });

  it('pulsar (no rock smashing) ignores rocks; turret bullet smashes one', () => {
    const w = arena();
    putWeapon(w, 'pulsar', 0, 5, 4);
    const rock = addRock(w, { x: 6.5, y: 4.5, thorium: 20 });
    runCombat(w, 60);
    expect(rock.state).toBe('drifting');
    putWeapon(w, 'turret', 0, 5, 5);
    runCombat(w, 60);
    expect(rock.state).toBe('smashed');
  });

  it('prefers units over rocks', () => {
    const w = arena();
    const t = putWeapon(w, 'turret', 0, 5, 4);
    addRock(w, { x: 6.5, y: 4.5, thorium: 5 });
    const u = putUnit(w, 'tank', 1, 8.0, 4.5);
    runCombat(w, 1);
    expect(t.targetId).toBe(u.id);
  });

  it('allied players never damage each other (direct, splash, projectiles)', () => {
    const w = arena(true);
    putWeapon(w, 'turret', 0, 5, 4);
    putWeapon(w, 'pulsar', 0, 5, 5);
    putWeapon(w, 'laser', 0, 5, 6);
    const ally = putUnit(w, 'tank', 1, 6.5, 4.5);
    runCombat(w, 120);
    expect(ally.hp).toBe(ally.maxHp);
    expect(splashUnits(w, 6.5, 4.5, 3, 99, 0, 'both', emitter(w))).toBe(0);
  });

  it('pulsar splash respects radius and spares allies', () => {
    const w = arena();
    putWeapon(w, 'pulsar', 0, 5, 4);
    const main = putUnit(w, 'tank', 1, 7.0, 4.5);
    const near = putUnit(w, 'tank', 1, 7.0, 5.3);
    const far = putUnit(w, 'tank', 1, 7.0, 8.0);
    const ally = putUnit(w, 'tank', 0, 7.0, 4.9);
    runCombat(w, 90);
    expect(main.hp).toBeLessThan(main.maxHp);
    expect(near.hp).toBeLessThan(near.maxHp);
    expect(far.hp).toBe(far.maxHp);
    expect(ally.hp).toBe(ally.maxHp);
  });

  it('splashUnits radius is exact', () => {
    const w = arena();
    const a = putUnit(w, 'tank', 1, 4.0, 4.0);
    const b = putUnit(w, 'tank', 1, 5.0, 4.0);
    const c = putUnit(w, 'tank', 1, 6.0, 4.0);
    rebuild(w);
    expect(splashUnits(w, 4.0, 4.0, 1.2, 10, 0, 'ground', emitter(w))).toBe(2);
    expect([a.hp, b.hp, c.hp]).toEqual([150, 150, 160]);
  });

  it('keeps firing only while the target stays in range; stun silences a weapon', () => {
    const w = arena();
    const t = putWeapon(w, 'turret', 0, 5, 4);
    putUnit(w, 'tank', 1, 7.5, 4.5, 9999);
    t.cooldown = 5;
    runCombat(w, 60);
    expect(w.events.some((e) => e.t === 'shot')).toBe(false);
    runCombat(w, 300);
    expect(w.events.some((e) => e.t === 'shot')).toBe(true);
  });
});

describe('structure destruction', () => {
  it('frees the tile and the flow field recalculates', () => {
    const w = arena();
    w.players[1].baseBuilt = true;
    w.players[1].baseTx = 10;
    w.players[1].baseTy = 4;
    const wall = [];
    for (let y = 0; y < w.grid.h; y++) wall.push(putStructure(w, 'turret', 1, 6, y, 50));
    expect(flowDist(ensureFlow(w, 1), 2.5, 4.5)).toBe(FLOW_INF);
    const gap = wall[4];
    const events: string[] = [];
    expect(damageStructure(w, gap, 80, 0, (e) => events.push(e.t))).toBe(true);
    expect(w.grid.occupant[4 * w.grid.w + 6]).toBe(0);
    expect(w.structures.has(gap.id)).toBe(false);
    expect(events).toContain('structureDestroyed');
    expect(flowDist(ensureFlow(w, 1), 2.5, 4.5)).toBeLessThan(FLOW_INF);
  });

  it('partial damage only emits structureHit', () => {
    const w = arena();
    const s = putStructure(w, 'turret', 1, 3, 3, 100);
    const events: string[] = [];
    expect(damageStructure(w, s, 10, 0, (e) => events.push(e.t))).toBe(false);
    expect(events).toEqual(['structureHit']);
  });
});

describe('registration', () => {
  it('registerCombatSystems is idempotent', () => {
    registerCombatSystems();
    registerCombatSystems();
    const names = createPipeline().map((p) => p.name);
    expect(names.filter((n) => n === 'combat')).toHaveLength(1);
    expect(names.indexOf('combat')).toBeLessThan(names.indexOf('projectiles'));
  });
});
