import { describe, expect, it } from 'vitest';
import { createSim } from '@/sim/core/index';
import { registerBuildSystems } from '@/sim/build';
import { registerEconomySystems } from '@/sim/economy';
import { registerArmySystems } from '@/sim/army';
import { registerCombatSystems } from '@/sim/combat';
import { registerUnitBehaviors } from '@/sim/units';
import { startBattle } from '@/sim/modes/battle';

describe('battle with the real systems', () => {
  it('two adaptive AIs play a timed match without a single denied action and attack each other', () => {
    registerBuildSystems();
    registerEconomySystems();
    registerArmySystems();
    registerCombatSystems();
    registerUnitBehaviors();
    const sim = createSim(
      startBattle({
        mapId: 'battle-kreios-crater',
        players: [
          { id: 0, team: 0, controller: 'adaptive' },
          { id: 1, team: 1, controller: 'adaptive' },
        ],
        maxHits: 20, difficulty: 'expert', timeLimitSec: 150, seed: 5,
      }),
    );
    const denied: string[] = [];
    let launched = 0;
    for (let i = 0; i < 60 * 200 && !sim.world.over; i++) {
      sim.step([]);
      for (const e of sim.drainEvents()) {
        if (e.t === 'denied') denied.push(e.reason);
        if (e.t === 'unitLaunched') launched += e.count;
      }
    }
    expect(denied).toEqual([]);
    for (const p of sim.world.players.slice(0, 2)) expect(p.stats.structuresBuilt).toBeGreaterThan(5);
    expect(launched).toBeGreaterThan(0);
  }, 120000);
});
