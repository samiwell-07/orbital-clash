import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '@/config/constants';
import { FLOW_INF, ensureFlow, flowDist } from '@/sim/core';
import { getArrivalHook, getUnitBehavior } from '@/sim/army/hooks';
import { registerUnitBehaviors } from '@/sim/units';
import { hammerBehavior } from '@/sim/units/hammer';
import { switchBehavior } from '@/sim/units/switch';
import { torpedoBehavior, tankBehavior } from '@/sim/units/basic';
import { carrierArrival } from '@/sim/units/carrier';
import { damageUnit } from '@/sim/combat';
import { arena, emitter, putStructure, putUnit, putWeapon, runCombat } from './helpers';
import { SWITCH_STUN, THIEF_LOOT } from '@/sim/units/tuning';

beforeAll(() => registerUnitBehaviors());

describe('unit behaviours', () => {
  it('registerUnitBehaviors wires hooks for every special', () => {
    registerUnitBehaviors();
    for (const k of ['scout', 'tank', 'drone', 'torpedo', 'hammer', 'switch', 'snake', 'dragon'] as const) {
      expect(getUnitBehavior(k)).toBeTypeOf('function');
    }
    expect(getArrivalHook('thief')).toBeTypeOf('function');
    expect(getArrivalHook('carrier')).toBeTypeOf('function');
  });

  it('hammer breaks a tower that walls off the base and the route opens', () => {
    const w = arena();
    w.players[1].baseBuilt = true;
    w.players[1].baseTx = 10;
    w.players[1].baseTy = 4;
    for (let y = 0; y < w.grid.h; y++) putStructure(w, 'turret', 1, 6, y, 120);
    const hammer = putUnit(w, 'hammer', 0, 2.5, 4.5);
    const emit = emitter(w);
    expect(flowDist(ensureFlow(w, 1), hammer.x, hammer.y)).toBe(FLOW_INF);
    let opened = false;
    for (let i = 0; i < 60 * 20 && !opened; i++) {
      opened = !hammerBehavior(w, hammer, TICK_DT, emit);
    }
    expect(opened).toBe(true);
    expect(w.grid.occupant[4 * w.grid.w + 6]).toBe(0);
    expect(w.events.some((e) => e.t === 'structureDestroyed')).toBe(true);
    expect(flowDist(ensureFlow(w, 1), hammer.x, hammer.y)).toBeLessThan(FLOW_INF);
  });

  it('hammer never smashes allied structures', () => {
    const w = arena(true);
    const s = putStructure(w, 'turret', 1, 3, 4, 50);
    const hammer = putUnit(w, 'hammer', 0, 2.8, 4.5);
    for (let i = 0; i < 200; i++) hammerBehavior(w, hammer, TICK_DT, emitter(w));
    expect(s.hp).toBe(50);
  });

  it('tank hits an area of structures on contact', () => {
    const w = arena();
    const a = putStructure(w, 'turret', 1, 5, 4, 100);
    const b = putStructure(w, 'turret', 1, 5, 5, 100);
    const far = putStructure(w, 'turret', 1, 9, 5, 100);
    const tank = putUnit(w, 'tank', 0, 4.4, 4.5);
    tankBehavior(w, tank, TICK_DT, emitter(w));
    expect(a.hp).toBeLessThan(100);
    expect(b.hp).toBeLessThan(100);
    expect(far.hp).toBe(100);
  });

  it('torpedo is consumed on impact and wrecks the structure', () => {
    const w = arena();
    const s = putStructure(w, 'turret', 1, 5, 4, 80);
    const t = putUnit(w, 'torpedo', 0, 4.5, 4.5);
    expect(torpedoBehavior(w, t, TICK_DT, emitter(w))).toBe(true);
    expect(t.state).toBe('dead');
    expect(w.structures.has(s.id)).toBe(false);
  });

  it('switch disables an enemy turret for the stun time, then it fires again', () => {
    const w = arena();
    const turret = putWeapon(w, 'turret', 1, 5, 4);
    const sw = putUnit(w, 'switch', 0, 4.5, 4.5);
    const victim = putUnit(w, 'tank', 0, 7.5, 4.5, 9999);
    switchBehavior(w, sw, TICK_DT, emitter(w));
    sw.x = 0.5;
    sw.y = 0.5;
    expect(turret.cooldown).toBe(SWITCH_STUN);
    runCombat(w, 60 * 7);
    expect(victim.hp).toBe(victim.maxHp);
    runCombat(w, 60 * 3);
    expect(victim.hp).toBeLessThan(victim.maxHp);
  });

  it('switch only affects enemies and is consumed after its uses', () => {
    const w = arena(true);
    const friendly = putWeapon(w, 'turret', 1, 5, 4);
    const sw = putUnit(w, 'switch', 0, 4.5, 4.5);
    switchBehavior(w, sw, TICK_DT, emitter(w));
    expect(friendly.cooldown).toBe(0);
    const w2 = arena();
    const sw2 = putUnit(w2, 'switch', 0, 4.5, 4.5);
    const t2 = putWeapon(w2, 'turret', 1, 5, 4);
    for (let i = 0; i < 400 && sw2.state !== 'dead'; i++) {
      switchBehavior(w2, sw2, TICK_DT, emitter(w2));
      t2.cooldown -= 0.5;
    }
    expect(sw2.state).toBe('dead');
  });

  it('thief steals thorium at the enemy base and credits its owner', () => {
    const w = arena();
    w.players[1].thorium = 100;
    const before = w.players[0].thorium;
    const thief = putUnit(w, 'thief', 0, 10.5, 4.5);
    expect(getArrivalHook('thief')!(w, thief, emitter(w))).toBe(true);
    expect(thief.state).toBe('dead');
    expect(w.players[1].thorium).toBe(100 - THIEF_LOOT);
    expect(w.players[0].thorium).toBe(before + THIEF_LOOT);
  });

  it('thief cannot steal from an ally', () => {
    const w = arena(true);
    const thief = putUnit(w, 'thief', 0, 10.5, 4.5);
    expect(getArrivalHook('thief')!(w, thief, emitter(w))).toBe(false);
  });

  it('carrier unloads its cargo as ground units on arrival and when shot down', () => {
    const w = arena();
    const c = putUnit(w, 'carrier', 0, 9.5, 4.5);
    c.aux = 6;
    expect(carrierArrival(w, c, emitter(w))).toBe(true);
    const cargo = w.units.filter((u) => u.kind === 'scout' && u.owner === 0);
    expect(cargo).toHaveLength(6);
    expect(cargo.every((u) => u.layer === 'ground' && u.state === 'marching' && u.targetPlayer === 1)).toBe(true);
    expect(c.state).toBe('dead');

    const c2 = putUnit(w, 'carrier', 0, 3.5, 4.5, 10);
    c2.aux = 4;
    damageUnit(w, c2, 50, 1, emitter(w));
    expect(w.units.filter((u) => u.kind === 'scout' && u.owner === 0)).toHaveLength(10);
  });
});
