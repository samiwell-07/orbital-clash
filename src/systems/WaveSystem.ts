import type { Team, UnitKind, World } from '../types';
import { MAX_QUEUE, SPAWN_STAGGER, WAVE_INCOME } from '../core/config';
import { UNIT_DEFS } from '../data/units';
import { addMoney } from './EconomySystem';
import { spawnUnit } from './MovementSystem';

/** Buys a unit into the team's queue (checks money & MAX_QUEUE). Emits unitQueued / notEnoughMoney. */
export function queueUnit(world: World, team: Team, kind: UnitKind): boolean {
  const player = world.players[team];
  const cost = UNIT_DEFS[kind].cost;
  if (player.queue.length >= MAX_QUEUE) {
    player.cursor.failFlash = 0.3;
    world.events.push({ type: 'buildFail', team, reason: 'QUEUE FULL', col: player.cursor.col, row: player.cursor.row });
    return false;
  }
  if (player.money < cost) {
    player.cursor.failFlash = 0.3;
    world.events.push({ type: 'notEnoughMoney', team });
    return false;
  }
  player.money -= cost;
  player.queue.push(kind);
  world.events.push({ type: 'unitQueued', team, kind });
  return true;
}

/** Wave countdown; on 0 moves queues into pendingSpawns (staggered), pays WAVE_INCOME*incomeMult; spawns pending units. */
export function updateWaves(world: World, dt: number): void {
  world.waveTimer -= dt;
  if (world.waveTimer <= 0) launchWave(world);

  if (world.pendingSpawns.length === 0) return;
  let spawned = false;
  for (const p of world.pendingSpawns) {
    p.delay -= dt;
    if (p.delay <= 0) {
      spawnUnit(world, p.team, p.kind);
      spawned = true;
    }
  }
  if (spawned) world.pendingSpawns = world.pendingSpawns.filter((p) => p.delay > 0);
}

function launchWave(world: World): void {
  world.waveNumber++;
  const counts: [number, number] = [0, 0];
  for (const player of world.players) {
    counts[player.team] = player.queue.length;
    player.queue.forEach((kind, i) => {
      world.pendingSpawns.push({ team: player.team, kind, delay: i * SPAWN_STAGGER });
    });
    player.queue = [];
    addMoney(world, player.team, Math.round(WAVE_INCOME * player.incomeMult));
  }
  world.events.push({ type: 'waveLaunched', wave: world.waveNumber, counts });
  world.waveTimer = world.level.waveInterval;
}
