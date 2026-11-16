import type { Team, ThoriumRock, Tower, World } from '../types';
import { COLORS, DRONE_LERP, PICKUP_RADIUS, TEAM_COLORS, TILE } from '../core/config';
import { towerStats } from '../data/towers';
import { addRing, addText, emitBurst, emitParticle } from './ParticleSystem';

/** Max rocks a single refinery magnet pulls at the same time. */
export const MAX_MAGNET_ROCKS = 3;

/** Adds money + stats.moneyEarned; optional floating "+$N" text at (x,y). */
export function addMoney(world: World, team: Team, amount: number, x?: number, y?: number): void {
  if (amount <= 0) return;
  const player = world.players[team];
  player.money += amount;
  player.stats.moneyEarned += amount;
  if (x !== undefined && y !== undefined) addText(world, x, y, `+$${amount}`, COLORS.money);
}

/** Nearest 'landed' rock within radius (pixels) of (x,y), or null. */
export function findRockNear(world: World, x: number, y: number, radius: number): ThoriumRock | null {
  let best: ThoriumRock | null = null;
  let bestD = radius * radius;
  for (const r of world.rocks) {
    if (!r.alive || r.state !== 'landed') continue;
    const dx = r.x - x;
    const dy = r.y - y;
    const d = dx * dx + dy * dy;
    if (d <= bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

function findRockById(world: World, id: number): ThoriumRock | null {
  for (const r of world.rocks) if (r.id === id) return r;
  return null;
}

function findTowerById(world: World, id: number): Tower | null {
  for (const t of world.towers) if (t.id === id) return t;
  return null;
}

/** Team's drone picks up the nearest landed rock (PICKUP_RADIUS). Returns success. */
export function tryPickUpRock(world: World, team: Team): boolean {
  const cursor = world.players[team].cursor;
  if (cursor.carryingRockId !== null) {
    const held = findRockById(world, cursor.carryingRockId);
    if (held && held.alive && held.state === 'carried' && held.carriedBy === team) return false;
    cursor.carryingRockId = null;
  }
  const rock = findRockNear(world, cursor.x, cursor.y, PICKUP_RADIUS);
  if (!rock) return false;
  rock.state = 'carried';
  rock.carriedBy = team;
  rock.magnetTowerId = null;
  cursor.carryingRockId = rock.id;
  world.events.push({ type: 'rockPickup', team });
  return true;
}

/** Drops the carried rock at the drone position (lands it). Returns false if not carrying. */
export function dropRock(world: World, team: Team): boolean {
  const cursor = world.players[team].cursor;
  if (cursor.carryingRockId === null) return false;
  const rock = findRockById(world, cursor.carryingRockId);
  cursor.carryingRockId = null;
  if (!rock || !rock.alive || rock.state !== 'carried') return false;
  rock.state = 'landed';
  rock.carriedBy = null;
  rock.x = cursor.x;
  rock.y = cursor.y;
  rock.targetX = cursor.x;
  rock.targetY = cursor.y;
  world.events.push({ type: 'rockDrop', team });
  return true;
}

/** Carried rocks follow drones; refinery magnets pull rocks; refineries convert rocks to money. */
export function updateEconomy(world: World, dt: number): void {
  // Drones: carried rocks follow, stale carry ids get cleared.
  for (const player of world.players) {
    const cursor = player.cursor;
    if (cursor.carryingRockId === null) continue;
    const rock = findRockById(world, cursor.carryingRockId);
    if (!rock || !rock.alive || rock.state !== 'carried' || rock.carriedBy !== player.team) {
      cursor.carryingRockId = null;
      continue;
    }
    const k = Math.min(1, DRONE_LERP * dt);
    rock.x += (cursor.x - rock.x) * k;
    rock.y += (cursor.y - rock.y) * k;
  }

  // Rocks whose refinery disappeared fall back to the ground.
  for (const rock of world.rocks) {
    if (!rock.alive || (rock.state !== 'magnet' && rock.state !== 'refining')) continue;
    const tower = rock.magnetTowerId === null ? null : findTowerById(world, rock.magnetTowerId);
    if (!tower || tower.kind !== 'refinery') {
      rock.state = 'landed';
      rock.magnetTowerId = null;
      rock.carriedBy = null;
    }
  }

  for (const tower of world.towers) {
    if (tower.kind !== 'refinery') continue;
    updateRefinery(world, tower, dt);
  }

  if (world.rocks.some((r) => !r.alive)) world.rocks = world.rocks.filter((r) => r.alive);
}

function updateRefinery(world: World, tower: Tower, dt: number): void {
  const stats = towerStats(tower.kind, tower.level);
  const radius = stats.magnetRadius * TILE;
  const strength = stats.magnetStrength * TILE;

  // Capture: count rocks currently being pulled, then grab the nearest eligible one.
  let pulling = 0;
  for (const r of world.rocks) if (r.alive && r.state === 'magnet' && r.magnetTowerId === tower.id) pulling++;
  if (pulling < MAX_MAGNET_ROCKS) {
    let best: ThoriumRock | null = null;
    let bestD = radius * radius;
    for (const r of world.rocks) {
      if (!r.alive) continue;
      const eligible = r.state === 'landed' || (r.state === 'carried' && r.carriedBy === tower.team);
      if (!eligible) continue;
      const dx = r.x - tower.x;
      const dy = r.y - tower.y;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = r;
      }
    }
    if (best) {
      if (best.state === 'carried' && best.carriedBy !== null) {
        const cursor = world.players[best.carriedBy].cursor;
        if (cursor.carryingRockId === best.id) cursor.carryingRockId = null;
      }
      best.state = 'magnet';
      best.carriedBy = null;
      best.magnetTowerId = tower.id;
    }
  }

  // Pull captured rocks in, accelerating as they approach.
  for (const r of world.rocks) {
    if (!r.alive || r.state !== 'magnet' || r.magnetTowerId !== tower.id) continue;
    const dx = tower.x - r.x;
    const dy = tower.y - r.y;
    const dist = Math.hypot(dx, dy);
    const closeness = radius > 0 ? Math.max(0, 1 - dist / radius) : 1;
    const step = strength * (1 + 2 * closeness) * dt;
    if (dist <= step || dist < 4) {
      r.x = tower.x;
      r.y = tower.y;
      r.state = 'refining';
      tower.refineQueue.push(r.id);
      continue;
    }
    r.x += (dx / dist) * step;
    r.y += (dy / dist) * step;
    if (Math.random() < 0.5) {
      const t = Math.random();
      emitParticle(
        world,
        r.x + dx * t,
        r.y + dy * t,
        (dx / dist) * strength * 0.5,
        (dy / dist) * strength * 0.5,
        0.35,
        1.8,
        Math.random() < 0.5 ? COLORS.thorium : COLORS.thoriumCore,
        0.5,
      );
    }
  }

  // Refine queue.
  while (tower.refineQueue.length > 0) {
    const id = tower.refineQueue[0]!;
    const rock = findRockById(world, id);
    if (!rock || !rock.alive || rock.state !== 'refining' || rock.magnetTowerId !== tower.id) {
      tower.refineQueue.shift();
      tower.refineProgress = 0;
      continue;
    }
    break;
  }
  if (tower.refineQueue.length === 0) {
    tower.refineProgress = 0;
    return;
  }
  tower.refineProgress += stats.refineTime > 0 ? dt / stats.refineTime : 1;
  if (tower.refineProgress < 1) return;

  const rock = findRockById(world, tower.refineQueue.shift()!)!;
  tower.refineProgress = 0;
  const value = Math.round(rock.value * stats.valueMultiplier);
  addMoney(world, tower.team, value, tower.x, tower.y - TILE * 0.6);
  world.players[tower.team].stats.rocksRefined++;
  world.events.push({ type: 'rockRefined', team: tower.team, value, x: tower.x, y: tower.y });
  emitBurst(world, tower.x, tower.y, COLORS.thorium, 14, 120, 0.6, 2.5);
  emitBurst(world, tower.x, tower.y, COLORS.thoriumCore, 8, 80, 0.5, 2);
  addRing(world, tower.x, tower.y, TILE * 0.9, TEAM_COLORS[tower.team].bright, 0.4);
  tower.flash = 0.25;
  rock.alive = false;
}
