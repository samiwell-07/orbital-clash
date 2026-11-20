import type { Emit, MapDef, Rock, System, World } from '@/types';
import { addRock, rand, randInt, randRange, isTerrainBlocked, occupantAt } from '@/sim/core';
import { ECON } from './tuning';

type Level = 1 | 2 | 3;
interface EconState {
  timer: number;
  level: Level;
}

const states = new WeakMap<World, EconState>();

function defaultEmit(w: World): Emit {
  return (e) => {
    w.events.push(e);
  };
}

function stateOf(w: World): EconState {
  let s = states.get(w);
  if (!s) {
    s = { timer: -1, level: w.settings.mission?.map.thoriumLevel ?? 2 };
    states.set(w, s);
  }
  return s;
}

/** Tell the economy which map the world plays on (the World itself does not carry its MapDef). */
export function setWorldMap(w: World, map: Pick<MapDef, 'thoriumLevel'>): void {
  const s = stateOf(w);
  s.level = map.thoriumLevel;
  s.timer = -1;
}

export function thoriumLevelOf(w: World): Level {
  return stateOf(w).level;
}

/** Harvest payout multiplier from the map's thorium abundance. */
export function mapThoriumFactor(w: World): number {
  return ECON.levelFactor[thoriumLevelOf(w)];
}

export function meteorInterval(w: World): number {
  return ECON.meteorBaseSeconds / (thoriumLevelOf(w) * Math.max(0.1, w.settings.thoriumRate));
}

function liveRockCount(w: World): number {
  return w.rocks.reduce((n, r) => (r.state === 'smashed' ? n : n + 1), 0);
}

/** Spawns one meteoroid just outside a random map edge, aimed across the plateau. */
export function spawnMeteor(w: World, emit: Emit): Rock {
  const gw = w.grid.w;
  const gh = w.grid.h;
  const edge = randInt(w, 0, 3);
  const along = rand(w);
  let x = -1;
  let y = along * gh;
  if (edge === 1) { x = gw + 1; }
  else if (edge === 2) { x = along * gw; y = -1; }
  else if (edge === 3) { x = along * gw; y = gh + 1; }
  const tx = randRange(w, gw * 0.25, gw * 0.75);
  const ty = randRange(w, gh * 0.25, gh * 0.75);
  const speed = randRange(w, ECON.meteorSpeed[0], ECON.meteorSpeed[1]);
  const len = Math.hypot(tx - x, ty - y) || 1;
  const size = randInt(w, 1, 3) as 1 | 2 | 3;
  const rock = addRock(w, {
    x, y, vx: ((tx - x) / len) * speed, vy: ((ty - y) / len) * speed,
    size, thorium: ECON.rockThorium[size], spin: rand(w) * Math.PI * 2,
  });
  emit({ t: 'rockSpawned', id: rock.id, x, y });
  return rock;
}

/** Cadence follows thoriumLevel and thoriumRate; deterministic through the world rng. */
export const meteorSystem: System = (w, dt, emit) => {
  const s = stateOf(w);
  if (s.timer < 0) s.timer = meteorInterval(w);
  s.timer -= dt;
  if (s.timer > 0) return;
  if (liveRockCount(w) < ECON.maxRocks) spawnMeteor(w, emit);
  s.timer = meteorInterval(w) * randRange(w, 0.75, 1.25);
};

/** Scatters map.rockCount landed rocks over free floor tiles and binds the map's thorium level. */
export function spawnInitialRocks(w: World, map: MapDef, emit: Emit = defaultEmit(w)): void {
  setWorldMap(w, map);
  for (let i = 0; i < map.rockCount; i++) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const tx = randInt(w, 0, w.grid.w - 1);
      const ty = randInt(w, 0, w.grid.h - 1);
      if (isTerrainBlocked(w.grid, tx, ty) || occupantAt(w.grid, tx, ty) !== 0) continue;
      const size = randInt(w, 1, 3) as 1 | 2 | 3;
      const rock = addRock(w, {
        x: tx + 0.5, y: ty + 0.5, size, thorium: ECON.rockThorium[size], state: 'landed', spin: rand(w) * Math.PI * 2,
      });
      emit({ t: 'rockSpawned', id: rock.id, x: rock.x, y: rock.y });
      break;
    }
  }
}
