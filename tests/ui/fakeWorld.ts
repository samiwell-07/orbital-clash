import type { Player, PlayerId, Structure, World } from '../../src/types';

export function fakePlayer(id: PlayerId, over: Partial<Player> = {}): Player {
  return {
    id, team: id, controller: 'human', colorIndex: id, alive: true, thorium: 100, tech: {}, baseTx: 0, baseTy: 0, baseBuilt: true,
    hits: 10, maxHits: 10, stored: {}, attack: { selected: null, locked: false, targetPlayer: id },
    ship: { x: 1.5, y: 1.5, vx: 0, vy: 0, cursorTx: 1, cursorTy: 1, carrying: 0 },
    stats: { kills: 0, unitsLost: 0, unitsLaunched: 0, thoriumEarned: 0, structuresBuilt: 0, basesDestroyed: 0, penaltySec: 0 },
    ...over,
  };
}

/** Minimal World for pure UI logic; only the fields the UI reads are meaningful. */
export function fakeWorld(players: Player[], profile: 'base' | 'bionic' = 'base'): World {
  const w = 8, h = 8;
  return {
    tick: 0, timeSec: 0, nextId: 1, paused: false, over: false, winnerTeam: -1,
    settings: { mode: 'battle', profile, difficulty: 'normal', maxHits: 10, thoriumRate: 1, timeLimitSec: 0, strength: [1, 1, 1, 1], mission: null, comet: null, seed: 1 },
    grid: { w, h, terrain: new Uint8Array(w * h), occupant: new Int32Array(w * h) },
    flows: [null, null, null, null], players, structures: new Map(), units: [], projectiles: [], rocks: [], events: [], rng: 0, timelineCursor: 0,
  };
}

export function putStructure(world: World, s: Partial<Structure> & Pick<Structure, 'kind' | 'tx' | 'ty'>): Structure {
  const st: Structure = {
    id: world.nextId++, owner: 0, level: 0, hp: 100, maxHp: 100, cooldown: 0, targetId: 0, output: null, buildProgress: 1, scripted: false, ...s,
  };
  world.structures.set(st.id, st);
  world.grid.occupant[st.ty * world.grid.w + st.tx] = st.id;
  return st;
}
