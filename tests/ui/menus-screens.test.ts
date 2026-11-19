import { describe, expect, it } from 'vitest';
import { DEFS } from '../../src/data';
import { buildItemsFor, buildKindsFor, windowStart } from '../../src/ui/menus/buildItems';
import { attackKindsFor, attackSlotsFor, slotAngle, targetCandidates } from '../../src/ui/menus/attackUnits';
import { invested, structureAt, structureCard } from '../../src/ui/hud/card';
import { stickToIndex } from '../../src/input/gamepad';
import { DEFAULT_BATTLE_SETUP } from '../../src/meta/settings';
import { battleRows, clampValues, readValues, toConfig, valuesFromSetup } from '../../src/ui/screens/battleForm';
import { Form } from '../../src/ui/menus/form';
import { areaNumber, moveCursor, nodeAt, placeholderArea, resurgenceIndices, rowLengths } from '../../src/ui/screens/campaignNav';
import { createScreenManager } from '../../src/ui/screens/manager';
import { NO_NAV, type AreaSummary, type BattleMapSummary, type Screen, type UiData } from '../../src/ui/screens/types';
import { newSave } from '../../src/meta/saveSchema';
import { fakePlayer, fakeWorld, putStructure } from './fakeWorld';

describe('build menu data', () => {
  it('lists weapons, spawn towers and support, locking untaught tech with a reason', () => {
    const world = fakeWorld([fakePlayer(0, { thorium: 55, tech: { laser: false } })]);
    const items = buildItemsFor(world, 0);
    expect(items.map((i) => i.kind)).toEqual(buildKindsFor(world));
    expect(items.slice(0, 4).map((i) => i.kind)).toEqual(['turret', 'laser', 'pulsar', 'bomber']);
    const laser = items.find((i) => i.kind === 'laser');
    expect(laser?.locked).toBe(true);
    expect(laser?.lockReason).toBe('Requires Lasers');
    const turret = items.find((i) => i.kind === 'turret');
    expect(turret).toMatchObject({ locked: false, affordable: true, cost: DEFS.weapon('turret').buildCost });
    const ops = items.find((i) => i.kind === 'basicOps');
    expect(ops?.affordable).toBe(false);
    expect(ops?.shortBy).toBe(DEFS.support('basicOps').buildCost - 55);
  });

  it('hides Bionic-only structures in the base ruleset and shows them in Bionic', () => {
    const p = fakePlayer(0);
    expect(buildKindsFor(fakeWorld([p], 'base'))).not.toContain('missileSilo');
    expect(buildKindsFor(fakeWorld([p], 'base'))).not.toContain('researchLab');
    expect(buildKindsFor(fakeWorld([p], 'bionic'))).toContain('missileSilo');
    expect(buildKindsFor(fakeWorld([p], 'bionic'))).toContain('researchLab');
    const silo = buildItemsFor(fakeWorld([p], 'bionic'), 0).find((i) => i.kind === 'missileSilo');
    expect(silo).toMatchObject({ locked: true, lockReason: 'Requires Missile Silo' });
  });

  it('windows long lists around the selection', () => {
    expect(windowStart(0, 12, 8)).toBe(0);
    expect(windowStart(6, 12, 8)).toBe(2);
    expect(windowStart(11, 12, 8)).toBe(4);
    expect(windowStart(3, 5, 8)).toBe(0);
  });
});

describe('attack menu data', () => {
  it('orders units like the input sectors and exposes counts as pips', () => {
    const world = fakeWorld([fakePlayer(0, { tech: { tank: true }, stored: { scout: 538, tank: 12 }, attack: { selected: 'tank', locked: true, targetPlayer: 1 } }), fakePlayer(1, { team: 1 })]);
    expect(attackKindsFor(world)).toHaveLength(8);
    expect(attackKindsFor(fakeWorld([fakePlayer(0)], 'bionic'))).toHaveLength(10);
    const slots = attackSlotsFor(world, 0);
    expect(slots[0]).toMatchObject({ kind: 'scout', count: 538, locked: false, pips: { white: 8, blue: 3, red: 5 } });
    expect(slots[1]).toMatchObject({ kind: 'tank', selected: true, locked: false });
    expect(slots[2]).toMatchObject({ kind: 'drone', locked: true, lockReason: 'Requires Drones' });
    const n = slots.length;
    for (let i = 0; i < n; i++) {
      const a = slotAngle(i, n);
      expect(stickToIndex(Math.sin(a), -Math.cos(a), n, 0.5)).toBe(i);
    }
    expect(targetCandidates(world, 0)).toEqual([1]);
  });
});

describe('structure card', () => {
  it('reports costs from DEFS (recycle uses recycleRatio, repair uses the build cost)', () => {
    const world = fakeWorld([fakePlayer(0, { tech: { hammers: true } }), fakePlayer(1, { team: 1 })]);
    const s = putStructure(world, { kind: 'basicOps', tx: 2, ty: 3, level: 1, hp: 90, maxHp: 180, output: 'scout' });
    expect(structureAt(world, 2, 3)).toBe(s);
    expect(structureAt(world, 0, 0)).toBeNull();
    expect(structureAt(world, -1, 99)).toBeNull();
    const c = structureCard(world, s, 0);
    const def = DEFS.spawnTower('basicOps');
    expect(c.upgradeCost).toBe(def.upgradeCost[1]);
    expect(c.recycle).toBe(Math.round(invested('basicOps', 1) * DEFS.recycleRatio(90, 180)));
    expect(c.repair).toBe(Math.ceil(DEFS.repairCost(def.buildCost, 90, 180) - 1e-9));
    expect(c.nextOutput).toBe('drone');
    expect(c.output).toBe('scout');
  });

  it('shows weapon stats as text, no costs for enemies and nothing to upgrade at max level', () => {
    const world = fakeWorld([fakePlayer(0), fakePlayer(1, { team: 1 })]);
    const mine = putStructure(world, { kind: 'turret', tx: 1, ty: 1, level: DEFS.weapon('turret').maxLevel });
    const theirs = putStructure(world, { kind: 'turret', tx: 4, ty: 4, owner: 1 });
    expect(structureCard(world, mine, 0).upgradeCost).toBeNull();
    expect(structureCard(world, mine, 0).stats).toMatch(/Range/);
    const e = structureCard(world, theirs, 0);
    expect(e.recycle).toBeNull();
    expect(e.repair).toBeNull();
  });
});

describe('battle setup form', () => {
  const maps: BattleMapSummary[] = [
    { id: 'big', name: 'Big', thoriumLevel: 3, palette: 'kronos', maxPlayers: 4 },
    { id: 'duel', name: 'Duel', thoriumLevel: 1, palette: 'gaia', maxPlayers: 2 },
  ];

  it('builds rows from remembered settings and returns a typed config', () => {
    const v = valuesFromSetup({ ...DEFAULT_BATTLE_SETUP, mapId: 'big', players: 3, maxHits: 25, thoriumRate: 1.5, timeLimitSec: 600 }, maps);
    const cfg = toConfig(v, maps);
    expect(cfg).toMatchObject({ mapId: 'big', maxHits: 25, thoriumRate: 1.5, timeLimitSec: 600, profile: 'base' });
    expect(cfg.slots).toHaveLength(3);
    expect(cfg.slots.map((s) => s.human)).toEqual([true, false, false]);
    expect(cfg.slots.map((s) => s.team)).toEqual([0, 1, 2]);
    const form = new Form(battleRows(v, maps));
    expect(form.row('team2')).toBeDefined();
    expect(form.row('team3')).toBeUndefined();
    expect(form.row('timeLimit')).toBeDefined();
  });

  it('clamps players to the map capacity and humans to players, and reads changes back', () => {
    const v = clampValues({ ...valuesFromSetup(DEFAULT_BATTLE_SETUP, maps), map: 1, players: 4, humans: 4 }, maps);
    expect(v.players).toBe(2);
    expect(v.humans).toBe(2);
    const form = new Form(battleRows(valuesFromSetup({ ...DEFAULT_BATTLE_SETUP, mapId: 'big' }, maps), maps));
    form.index = form.rows.findIndex((r) => r.id === 'team1');
    form.adjust(1);
    form.index = form.rows.findIndex((r) => r.id === 'team0');
    form.adjust(1);
    const next = readValues(form, valuesFromSetup({ ...DEFAULT_BATTLE_SETUP, mapId: 'big' }, maps), maps);
    expect(toConfig(next, maps).slots.map((s) => s.team)).toEqual([1, 2]);
  });
});

describe('campaign map navigation', () => {
  const areas: AreaSummary[] = [
    { cometId: 'kreios', index: 0, resurgence: true, name: 'R', teaches: null, objectives: [], parTimeSec: 1 },
    { cometId: 'kreios', index: 1, resurgence: true, name: 'R2', teaches: null, objectives: [], parTimeSec: 1 },
  ];

  it('rows hold 7 areas plus the Resurgence nodes (at least one)', () => {
    expect(rowLengths([])).toEqual([8, 8, 8, 8]);
    expect(rowLengths(areas)).toEqual([9, 8, 8, 8]);
    expect(resurgenceIndices(areas, 'kreios')).toEqual([0, 1]);
  });

  it('moves with clamping and maps cursor positions to nodes', () => {
    const lens = rowLengths(areas);
    expect(moveCursor({ row: 0, col: 8 }, 0, 1, lens)).toEqual({ row: 1, col: 7 });
    expect(moveCursor({ row: 0, col: 0 }, -1, -1, lens)).toEqual({ row: 0, col: 0 });
    expect(moveCursor({ row: 3, col: 7 }, 1, 1, lens)).toEqual({ row: 3, col: 7 });
    expect(nodeAt({ row: 1, col: 3 }, areas)).toEqual({ cometId: 'hathor', index: 3, resurgence: false });
    expect(nodeAt({ row: 0, col: 8 }, areas)).toEqual({ cometId: 'kreios', index: 1, resurgence: true });
    expect(areaNumber({ cometId: 'aether', index: 3, resurgence: false })).toBe(18);
    expect(placeholderArea({ cometId: 'helios', index: 2, resurgence: false }).name).toBe('Helios 3');
  });
});

describe('ScreenManager', () => {
  const data: UiData = { save: newSave(), areas: [], maps: [] };
  const mk = (id: string, res: (n: number) => ReturnType<Screen['update']>): Screen => {
    let n = 0;
    return { id, update: () => res(n++), draw: () => undefined };
  };

  it('handles push/pop internally and surfaces only commands', () => {
    const child = mk('child', (n) => (n === 0 ? null : n === 1 ? { t: 'startBattle', setup: { mapId: 'x', slots: [], maxHits: 10, thoriumRate: 1, timeLimitSec: 0, profile: 'base' } } : { t: 'pop' }));
    const root = mk('root', () => ({ t: 'push', screen: child }));
    const m = createScreenManager(() => data, root);
    expect(m.update(NO_NAV, 0.016)).toBeNull();
    expect(m.top()?.id).toBe('child');
    expect(m.depth).toBe(2);
    expect(m.update(NO_NAV, 0.016)).toBeNull();
    expect(m.update(NO_NAV, 0.016)).toMatchObject({ t: 'startBattle' });
    expect(m.update(NO_NAV, 0.016)).toBeNull();
    expect(m.top()?.id).toBe('root');
  });

  it('never pops the last screen, replaces, and resets', () => {
    const a = mk('a', () => ({ t: 'pop' }));
    const m = createScreenManager(() => data, a);
    m.update(NO_NAV, 0);
    expect(m.depth).toBe(1);
    const b = mk('b', () => ({ t: 'replace', screen: mk('c', () => ({ t: 'resume' })) }));
    m.reset(b);
    m.update(NO_NAV, 0);
    expect(m.top()?.id).toBe('c');
    expect(m.update(NO_NAV, 0)).toEqual({ t: 'resume' });
    m.reset(null);
    expect(m.top()).toBeNull();
    expect(m.update(NO_NAV, 0)).toBeNull();
  });
});
