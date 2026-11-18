import { afterEach, describe, expect, it } from 'vitest';
import type { SimEvent, Unit } from '@/types';
import { UNIT_DEFS } from '@/data';
import { AIR_HEIGHT, clearArmyHooks, registerArrivalHook, registerUnitBehavior, spacingFor } from '@/sim/army';
import { addUnit, addStructure } from '@/sim/core';
import { arena, run, tick, wallTerrain } from './helpers';

afterEach(() => clearArmyHooks());

function distToPolyline(p: { x: number; y: number }, line: { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t)));
  }
  return best;
}

describe('launch and train spacing', () => {
  it('releases stored units one by one in order at fixed spacing', () => {
    const w = arena(40, 6);
    w.players[0].stored.scout = 10;
    const events: SimEvent[] = [];
    tick(w, events, [{ t: 'attackSelect', player: 0, kind: 'scout' }]);
    run(w, 1.5, events);
    expect(w.players[0].stored.scout).toBe(0);
    expect(w.units).toHaveLength(10);
    expect(w.units.map((u) => u.trainIndex)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(w.players[0].stats.unitsLaunched).toBe(10);
    const launched = events.filter((e) => e.t === 'unitLaunched').reduce((n, e) => n + (e.t === 'unitLaunched' ? e.count : 0), 0);
    expect(launched).toBe(10);
    const gap = spacingFor('scout');
    for (let i = 1; i < w.units.length; i++) {
      const d = w.units[i - 1].x - w.units[i].x;
      expect(d).toBeGreaterThanOrEqual(gap - 1e-6);
      expect(d).toBeLessThan(gap + 0.12);
    }
  });

  it('followers trail the head around a wall', () => {
    const w = arena(20, 10);
    for (let y = 0; y <= 6; y++) wallTerrain(w, 10, y);
    w.players[0].stored.scout = 6;
    w.players[0].attack.selected = 'scout';
    const path: { x: number; y: number }[] = [];
    let maxY = 0;
    for (let i = 0; i < 60 * 3; i++) {
      tick(w);
      const head = w.units.find((u) => u.trainIndex === 0);
      if (head) {
        path.push({ x: head.x, y: head.y });
        maxY = Math.max(maxY, head.y);
      }
      for (const u of w.units) {
        expect(w.grid.terrain[Math.floor(u.y) * 20 + Math.floor(u.x)]).toBe(0);
      }
    }
    expect(maxY).toBeGreaterThan(7);
    expect(w.units).toHaveLength(6);
    for (const u of w.units) expect(distToPolyline(u, path)).toBeLessThan(0.15);
    const followers = w.units.filter((u) => u.trainIndex > 0);
    expect(followers.some((u) => u.y > 7)).toBe(true);
  });

  it('air units fly straight to the base ignoring walls', () => {
    const slots = [
      { id: 0 as const, team: 0, controller: 'human' as const },
      { id: 3 as const, team: 1, controller: 'adaptive' as const },
    ];
    const w = arena(24, 10, {}, slots);
    for (let y = 0; y < 10; y++) wallTerrain(w, 10, y);
    const p0 = w.players[0];
    const p3 = w.players[3];
    expect(p0.attack.targetPlayer).toBe(3);
    p0.stored.drone = 3;
    p0.attack.selected = 'drone';
    const a = { x: p0.baseTx + 0.5, y: p0.baseTy + 0.5 };
    const b = { x: p3.baseTx + 0.5, y: p3.baseTy + 0.5 };
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let seen = 0;
    for (let i = 0; i < 60 * 12; i++) {
      tick(w);
      for (const u of w.units) {
        seen++;
        const cross = Math.abs((u.x - a.x) * (b.y - a.y) - (u.y - a.y) * (b.x - a.x)) / len;
        expect(cross).toBeLessThan(1e-6);
        expect(u.z).toBe(AIR_HEIGHT);
        expect(u.layer).toBe('air');
      }
    }
    expect(seen).toBeGreaterThan(30);
    expect(w.units).toHaveLength(0);
    expect(p3.hits).toBe(3 * UNIT_DEFS.drone.baseHits);
  });
});

describe('structure chewing', () => {
  it('chews the blocking structure nearest the target base, then arrives', () => {
    const w = arena(20, 10);
    for (let y = 0; y < 10; y++) addStructure(w, { kind: 'turret', owner: 1, tx: 10, ty: y, hp: 4 });
    const u = addUnit(w, { kind: 'scout', owner: 0, x: 8.5, y: 6.5, hp: 25 });
    expect(u.targetPlayer).toBe(1);
    const events: SimEvent[] = [];
    let sawAttacking = false;
    for (let i = 0; i < 60 * 12 && w.units.length > 0; i++) {
      tick(w, events);
      if (u.state === 'attacking') sawAttacking = true;
    }
    const destroyed = events.filter((e) => e.t === 'structureDestroyed');
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toMatchObject({ x: 10.5, y: 2.5, owner: 1 });
    expect(sawAttacking).toBe(true);
    expect(w.structures.size).toBe(9);
    expect(w.players[1].hits).toBe(1);
    expect(w.units).toHaveLength(0);
  });
});

describe('arrival and hooks', () => {
  it('consumes the unit, adds baseHits and emits no unitDied', () => {
    const w = arena(24, 10);
    addUnit(w, { kind: 'torpedo', owner: 0, x: 19.5, y: 2.5, hp: 60, targetPlayer: 1 });
    const events: SimEvent[] = [];
    run(w, 2, events);
    expect(w.units).toHaveLength(0);
    expect(w.players[1].hits).toBe(UNIT_DEFS.torpedo.baseHits);
    const hit = events.find((e) => e.t === 'baseHit');
    expect(hit).toMatchObject({ target: 1, attacker: 0, hitsLeft: w.players[1].maxHits - 2 });
    expect(events.some((e) => e.t === 'unitDied')).toBe(false);
  });

  it('arrival hook can take over; behavior can skip default movement', () => {
    const w = arena(24, 10);
    const seen: Unit[] = [];
    registerArrivalHook('thief', (_w, u) => {
      seen.push(u);
      return true;
    });
    registerUnitBehavior('hammer', () => true);
    addUnit(w, { kind: 'thief', owner: 0, x: 20.5, y: 2.5, hp: 40 });
    const hammer = addUnit(w, { kind: 'hammer', owner: 0, x: 8.5, y: 2.5, hp: 300 });
    run(w, 1);
    expect(seen.length).toBeGreaterThan(0);
    expect(w.players[1].hits).toBe(0);
    expect(w.units.some((u) => u.kind === 'thief')).toBe(true);
    expect(hammer.x).toBe(8.5);
  });

  it('kills units at 0 hp with unitDied and stats', () => {
    const w = arena();
    const u = addUnit(w, { kind: 'tank', owner: 0, x: 8.5, y: 2.5, hp: 10 });
    u.hp = 0;
    const events: SimEvent[] = [];
    tick(w, events);
    expect(events.filter((e) => e.t === 'unitDied')).toHaveLength(1);
    expect(w.players[0].stats.unitsLost).toBe(1);
    expect(w.units).toHaveLength(0);
  });
});
