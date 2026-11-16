import type { GridPos, PendingSpawn, Team, UnitKind, World } from '../types';
import { MAX_QUEUE, SPAWN_STAGGER } from '../core/config';
import { UNIT_DEFS } from '../data/units';
import { updateFlowFields } from './FlowField';
import { spawnUnit } from './MovementSystem';

/** Spawn cell chosen for each pending spawn's train. */
const trainCells = new WeakMap<PendingSpawn, GridPos>();

/** Buys ONE pack of `kind` into the wave buffer. Emits unitQueued (with count) or a failure event. */
export function queueUnit(world: World, team: Team, kind: UnitKind): boolean {
  const player = world.players[team];
  const def = UNIT_DEFS[kind];
  if (player.queue.length + def.packSize > MAX_QUEUE) {
    player.cursor.failFlash = 0.3;
    world.events.push({ type: 'buildFail', team, reason: 'QUEUE FULL', col: player.cursor.col, row: player.cursor.row });
    return false;
  }
  if (player.money < def.packCost) {
    player.cursor.failFlash = 0.3;
    world.events.push({ type: 'notEnoughMoney', team });
    return false;
  }
  player.money -= def.packCost;
  for (let i = 0; i < def.packSize; i++) player.queue.push(kind);
  world.events.push({ type: 'unitQueued', team, kind, count: def.packSize });
  return true;
}

/** The team's spawn cell with the smallest flow distance to the enemy base (any if none is reachable). */
export function bestSpawnCell(world: World, team: Team): GridPos {
  updateFlowFields(world);
  const cells = world.players[team].spawnCells;
  const dist = world.flow.dist[team];
  const cols = world.grid.cols;
  let best: GridPos | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const d = dist[c.row * cols + c.col] ?? -1;
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best) return { col: best.col, row: best.row };
  const fallback = cells[0];
  if (fallback) return { col: fallback.col, row: fallback.row };
  const base = world.bases[team];
  return { col: team === 0 ? base.col + base.w : base.col - 1, row: base.row };
}

/** Sends the whole wave buffer as one single-file train on one spawn cell. False if the buffer is empty. */
export function launchWave(world: World, team: Team): boolean {
  const player = world.players[team];
  const count = player.queue.length;
  if (count === 0) return false;
  const cell = bestSpawnCell(world, team);
  // A new train queues up behind any train of this team that is still emerging.
  let start = 0;
  for (const p of world.pendingSpawns) if (p.team === team) start = Math.max(start, p.delay + SPAWN_STAGGER);
  for (let i = 0; i < count; i++) {
    const spawn: PendingSpawn = { team, kind: player.queue[i]!, delay: start + i * SPAWN_STAGGER, trainIndex: i };
    trainCells.set(spawn, cell);
    world.pendingSpawns.push(spawn);
  }
  player.queue = [];
  world.waveNumber++;
  player.stats.launches++;
  world.events.push({ type: 'waveLaunched', team, count });
  return true;
}

/** Spawns pending train units whose delay has elapsed. */
export function updateWaves(world: World, dt: number): void {
  const list = world.pendingSpawns;
  if (list.length === 0) return;
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    p.delay -= dt;
    if (p.delay <= 0) {
      spawnUnit(world, p.team, p.kind, trainCells.get(p) ?? bestSpawnCell(world, p.team), p.trainIndex);
    } else {
      list[w++] = p;
    }
  }
  list.length = w;
}
