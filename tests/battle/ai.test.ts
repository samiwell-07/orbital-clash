import { describe, expect, it } from 'vitest';
import type { Intent, World } from '@/types';
import { addRock, structuresOf } from '@/sim/core/entities';
import { AdaptiveAI, aiSystem } from '@/sim/modes/battle';
import { createSim } from '@/sim/core/index';
import { applyIntentsSystem, registerIntentHandler } from '@/sim/core/intents';
import { startBattle } from '@/sim/modes/battle/setup';
import { allPathsOpen, applyIntent, battleWorld, type Applied } from './harness';

const STEP = 0.25;

/** Runs both AIs against each other with a trickle of income, applying their intents under strict rules. */
function playOut(w: World, steps: number, income = 25): Applied {
  const ais = [new AdaptiveAI(), new AdaptiveAI()];
  const out: Applied = { violations: [], intents: [] };
  for (let i = 0; i < steps; i++) {
    w.timeSec += STEP;
    for (const p of w.players) if (p.controller === 'adaptive' && p.alive) p.thorium += income;
    for (const id of [0, 1] as const) {
      for (const it of ais[id].update(w, id, STEP)) {
        if (it.t === 'move') continue;
        applyIntent(w, it, out);
      }
      if (!allPathsOpen(w)) out.violations.push(`path sealed at step ${i}`);
    }
  }
  return out;
}

describe('AdaptiveAI legality', () => {
  it('builds a real base up with only legal intents (no overspending, no sealed paths, no locked tech)', () => {
    const { w } = battleWorld({ difficulty: 'expert' });
    const out = playOut(w, 320);
    expect(out.violations).toEqual([]);
    const kinds = new Set(structuresOf(w, 0).map((s) => s.kind));
    expect(kinds.has('turret')).toBe(true);
    expect(kinds.has('basicOps')).toBe(true);
    expect(structuresOf(w, 0).length).toBeGreaterThan(8);
    for (const p of w.players) expect(p.thorium).toBeGreaterThanOrEqual(0);
  });

  it('stays legal on every map including free-placement ones, for all difficulties', () => {
    for (const mapId of ['battle-hathor-oasis', 'battle-aether-drift', 'battle-helios-forge']) {
      for (const difficulty of ['beginner', 'normal'] as const) {
        const free = mapId === 'battle-hathor-oasis';
        const { w } = battleWorld({ mapId, difficulty, freeBase: free });
        const out = playOut(w, 160);
        expect(out.violations).toEqual([]);
        expect(w.players[0].baseBuilt && w.players[1].baseBuilt).toBe(true);
      }
    }
  });

  it('picks its own base tile when the map has none, away from the enemy', () => {
    const { w } = battleWorld({ freeBase: true });
    playOut(w, 8);
    const [a, b] = w.players;
    expect(Math.hypot(a.baseTx - b.baseTx, a.baseTy - b.baseTy)).toBeGreaterThan(12);
  });

  it('shapes paths: weapons form lines along the enemy approach', () => {
    const { w } = battleWorld({ difficulty: 'expert' });
    playOut(w, 400, 60);
    const weapons = structuresOf(w, 0).filter((s) => ['turret', 'laser', 'pulsar', 'bomber'].includes(s.kind));
    const touching = weapons.filter((s) => weapons.some((o) => o !== s && Math.abs(o.tx - s.tx) + Math.abs(o.ty - s.ty) === 1));
    expect(weapons.length).toBeGreaterThan(5);
    expect(touching.length).toBeGreaterThan(weapons.length / 3);
  });
});

describe('AdaptiveAI behaviour', () => {
  it('counters air units with anti-air weapons', () => {
    const { w } = battleWorld({ difficulty: 'expert' });
    playOut(w, 40);
    const mine = structuresOf(w, 0);
    for (let i = 0; i < 12; i++) {
      w.units.push({
        id: 9000 + i, kind: 'drone', owner: 1, targetPlayer: 0, x: w.players[0].baseTx + 10, y: w.players[0].baseTy + 5,
        z: 0, heading: 0, hp: 45, maxHp: 45, layer: 'air', state: 'marching', trainIndex: i, travelled: 0, aux: 0,
      });
    }
    const out: Applied = { violations: [], intents: [] };
    const ai = new AdaptiveAI();
    w.players[0].thorium = 900;
    for (let i = 0; i < 12; i++) {
      w.timeSec += STEP;
      for (const it of ai.update(w, 0, STEP)) if (it.t !== 'move') applyIntent(w, it, out);
    }
    const aa = structuresOf(w, 0).filter((s) => s.kind === 'laser' || s.kind === 'bomber');
    expect(structuresOf(w, 0).length).toBeGreaterThan(mine.length);
    expect(aa.length).toBeGreaterThan(0);
    expect(out.violations).toEqual([]);
  });

  it('stores an army, targets the weakest enemy, releases then locks, and stops when drained', () => {
    const { w } = battleWorld({
      players: [
        { id: 0, team: 0, controller: 'adaptive' },
        { id: 1, team: 1, controller: 'adaptive' },
        { id: 2, team: 2, controller: 'adaptive' },
      ],
      difficulty: 'normal',
    });
    w.players[2].hits = 6;
    w.timeSec = 500;
    w.players[0].stored = { scout: 40, tank: 50, drone: 10 };
    const ai = new AdaptiveAI();
    const out: Applied = { violations: [], intents: [] };
    for (let i = 0; i < 12; i++) {
      w.timeSec += STEP;
      for (const it of ai.update(w, 0, STEP)) applyIntent(w, it, out);
    }
    const a = w.players[0].attack;
    expect(a.targetPlayer).toBe(2);
    expect(a.locked).toBe(true);
    expect(a.selected).toBe('tank');
    w.players[0].stored = {};
    for (let i = 0; i < 6; i++) {
      w.timeSec += STEP;
      for (const it of ai.update(w, 0, STEP)) applyIntent(w, it, out);
    }
    expect(w.players[0].attack.locked).toBe(false);
  });

  it('holds its fire until the army is big enough, and rushes during overtime', () => {
    const { w } = battleWorld({ timeLimitSec: 100 });
    w.timeSec = 20;
    w.players[0].stored = { scout: 30 };
    const ai = new AdaptiveAI();
    const quiet = ai.update(w, 0, STEP).filter((i) => i.t.startsWith('attack'));
    expect(quiet).toEqual([]);
    w.timeSec = 101;
    const intents = [...ai.update(w, 0, STEP), ...ai.update(w, 0, 1)].filter((i) => i.t.startsWith('attack') || i.t === 'cycleTarget');
    expect(intents.length).toBeGreaterThan(0);
  });

  it('builds a harvester first, flies the ship to a rock, grabs it and drops it in the magnet', () => {
    const { w } = battleWorld();
    const p = w.players[0];
    p.thorium = 600;
    const ai = new AdaptiveAI();
    const out: Applied = { violations: [], intents: [] };
    for (let i = 0; i < 4; i++) {
      w.timeSec += STEP;
      for (const it of ai.update(w, 0, STEP)) applyIntent(w, it, out);
    }
    const harvester = structuresOf(w, 0).find((s) => s.kind === 'harvester');
    expect(harvester).toBeDefined();
    (harvester as { buildProgress: number }).buildProgress = 1;
    const hx = (harvester as { tx: number }).tx;
    p.ship.x = hx < w.grid.w / 2 ? hx + 10.5 : hx - 9.5;
    const rock = addRock(w, { x: p.ship.x + 0.3, y: p.ship.y, thorium: 20, size: 1 });
    expect(ai.update(w, 0, STEP).some((i) => i.t === 'grab')).toBe(true);
    p.ship.carrying = rock.id;
    p.ship.x = (harvester as { tx: number }).tx + 0.5;
    p.ship.y = (harvester as { ty: number }).ty + 0.5;
    rock.state = 'grabbed';
    rock.x = p.ship.x + 0.8;
    rock.y = p.ship.y;
    w.timeSec += 1;
    expect(ai.update(w, 0, 1).some((i) => i.t === 'drop')).toBe(true);
  });
});

describe('determinism', () => {
  const run = (): Intent[] => {
    const { w } = battleWorld({ difficulty: 'normal', seed: 4242 });
    return playOut(w, 200).intents;
  };

  it('same seed gives identical decisions; another seed differs', () => {
    expect(run()).toEqual(run());
    const { w } = battleWorld({ difficulty: 'normal', seed: 4243 });
    expect(playOut(w, 200).intents).not.toEqual(run());
  });

  it('queues intents only in battle worlds, never in the campaign', () => {
    const seen: Intent[] = [];
    const off = registerIntentHandler((_w, i) => {
      seen.push(i);
      return true;
    });
    const mk = () => createSim(startBattle({ mapId: 'battle-kreios-crater', players: [{ id: 0, team: 0, controller: 'adaptive' }, { id: 1, team: 1, controller: 'human' }] }));
    const campaign = mk();
    campaign.world.settings.mode = 'campaign';
    aiSystem(campaign.world, 1 / 60, () => {});
    applyIntentsSystem(campaign.world, 1 / 60, () => {});
    expect(seen).toEqual([]);
    const battle = mk();
    aiSystem(battle.world, 1 / 60, () => {});
    applyIntentsSystem(battle.world, 1 / 60, () => {});
    off();
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((i) => 'player' in i && i.player === 0)).toBe(true);
  });
});
