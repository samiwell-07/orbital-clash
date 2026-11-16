import type { Harvester, ResearchKind, Team, ThoriumRock, Tower, World } from '../types';
import {
  COLORS,
  DRONE_LERP,
  HARVEST_TIME,
  HARVESTER_SPEED,
  PASSIVE_INCOME,
  PASSIVE_RESEARCH,
  PICKUP_RADIUS,
  RESEARCH_PER_REFINE,
  TILE,
  paletteOf,
} from '../core/config';
import { towerStats } from '../data/towers';
import { RESEARCH_DEFS } from '../data/units';
import { createHarvester } from '../entities/ThoriumRock';
import { addRing, addText, emitBurst, emitParticle } from './ParticleSystem';

/** Max rocks a single refinery magnet pulls at the same time. */
export const MAX_MAGNET_ROCKS = 3;
/** Harvesters look for rocks within this many tiles of their station. */
export const HARVEST_SEARCH_TILES = 10;
/** A loaded harvester with spare capacity chains to another rock within this many tiles. */
export const HARVEST_CHAIN_TILES = 2;

/** Fractional passive money not yet paid out, per world/team. */
const incomeCarry = new WeakMap<World, [number, number]>();
/** Seconds a harvester has been mining its current target. */
const mineTimers = new WeakMap<Harvester, number>();

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

/** Team's ship picks up the nearest landed rock (PICKUP_RADIUS), even one a harvester reserved. */
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
  rock.harvesterId = null;
  rock.reservedBy = null;
  rock.magnetTowerId = null;
  cursor.carryingRockId = rock.id;
  world.events.push({ type: 'rockPickup', team });
  return true;
}

/** Drops the carried rock at the ship position (lands it). Returns false if not carrying. */
export function dropRock(world: World, team: Team): boolean {
  const cursor = world.players[team].cursor;
  if (cursor.carryingRockId === null) return false;
  const rock = findRockById(world, cursor.carryingRockId);
  cursor.carryingRockId = null;
  if (!rock || !rock.alive || rock.state !== 'carried') return false;
  landRock(rock, cursor.x, cursor.y);
  world.events.push({ type: 'rockDrop', team });
  return true;
}

function landRock(rock: ThoriumRock, x: number, y: number): void {
  rock.state = 'landed';
  rock.carriedBy = null;
  rock.harvesterId = null;
  rock.magnetTowerId = null;
  rock.reservedBy = null;
  rock.x = x;
  rock.y = y;
  rock.targetX = x;
  rock.targetY = y;
}

/** Buys a research with research energy. Emits `research`, or `buildFail` with the reason. */
export function tryResearch(world: World, team: Team, kind: ResearchKind): boolean {
  const player = world.players[team];
  const fail = (reason: string): false => {
    player.cursor.failFlash = 0.3;
    world.events.push({ type: 'buildFail', team, reason, col: player.cursor.col, row: player.cursor.row });
    return false;
  };
  if (player.researched[kind]) return fail('ALREADY RESEARCHED');
  const cost = RESEARCH_DEFS[kind].cost;
  if (player.research < cost) return fail('NEED RESEARCH ENERGY');
  player.research -= cost;
  player.researched[kind] = true;
  world.events.push({ type: 'research', team, kind });
  return true;
}

/** Passive income, ship-carried rocks, harvesters, refinery magnets and refining. */
export function updateEconomy(world: World, dt: number): void {
  updatePassive(world, dt);

  const towersById = new Map<number, Tower>();
  for (const t of world.towers) if (t.kind === 'refinery') towersById.set(t.id, t);

  // Ship-carried rocks follow the cursor; stale carry ids are cleared.
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

  updateHarvesters(world, towersById, dt);

  // Rocks whose refinery or harvester disappeared fall back to the ground.
  for (const rock of world.rocks) {
    if (!rock.alive) continue;
    if (rock.state === 'magnet' || rock.state === 'refining') {
      if (rock.magnetTowerId === null || !towersById.has(rock.magnetTowerId)) landRock(rock, rock.x, rock.y);
    } else if (rock.state === 'carried' && rock.carriedBy === null) {
      const h = rock.harvesterId === null ? undefined : world.harvesters.find((x) => x.id === rock.harvesterId);
      if (!h || !h.alive || h.cargo.indexOf(rock.id) < 0) landRock(rock, rock.x, rock.y);
    } else if (rock.state === 'landed' && rock.reservedBy !== null) {
      const id = rock.reservedBy;
      const h = world.harvesters.find((x) => x.id === id);
      if (!h || !h.alive || h.targetRockId !== rock.id) rock.reservedBy = null;
    }
  }

  for (const tower of towersById.values()) updateRefinery(world, tower, dt);

  if (world.rocks.some((r) => !r.alive)) world.rocks = world.rocks.filter((r) => r.alive);
}

function updatePassive(world: World, dt: number): void {
  let carry = incomeCarry.get(world);
  if (!carry) {
    carry = [0, 0];
    incomeCarry.set(world, carry);
  }
  for (const player of world.players) {
    player.research += PASSIVE_RESEARCH * dt;
    carry[player.team] += PASSIVE_INCOME * player.incomeMult * dt;
    const whole = Math.floor(carry[player.team] + 1e-9);
    if (whole >= 1) {
      carry[player.team] -= whole;
      addMoney(world, player.team, whole);
    }
  }
}

// ---------------------------------------------------------------- Harvesters

function releaseHarvester(world: World, h: Harvester): void {
  for (const id of h.cargo) {
    const rock = findRockById(world, id);
    if (rock && rock.alive && rock.state === 'carried' && rock.harvesterId === h.id) landRock(rock, h.x, h.y);
  }
  h.cargo.length = 0;
  if (h.targetRockId !== null) {
    const rock = findRockById(world, h.targetRockId);
    if (rock && rock.reservedBy === h.id) rock.reservedBy = null;
  }
  h.targetRockId = null;
  h.alive = false;
}

function syncHarvesterCounts(world: World, towersById: Map<number, Tower>): void {
  const counts = new Map<number, number>();
  for (const h of world.harvesters) {
    if (!h.alive) continue;
    const station = towersById.get(h.stationId);
    if (!station || station.team !== h.team) {
      releaseHarvester(world, h);
      continue;
    }
    const want = towerStats('refinery', station.level).harvesters;
    const have = counts.get(station.id) ?? 0;
    if (have >= want) {
      releaseHarvester(world, h);
      continue;
    }
    counts.set(station.id, have + 1);
  }
  for (const station of towersById.values()) {
    const want = towerStats('refinery', station.level).harvesters;
    for (let have = counts.get(station.id) ?? 0; have < want; have++) {
      world.harvesters.push(createHarvester(world, station.team, station.id, station.x, station.y));
    }
  }
  if (world.harvesters.some((h) => !h.alive)) world.harvesters = world.harvesters.filter((h) => h.alive);
}

function isFreeLanded(rock: ThoriumRock): boolean {
  return rock.alive && rock.state === 'landed' && rock.reservedBy === null;
}

/** Best unreserved landed rock for a harvester: near its station, then near the drone. */
function pickRock(world: World, h: Harvester, station: Tower, fromX: number, fromY: number, maxTiles: number, chain: boolean): ThoriumRock | null {
  const limit = maxTiles * TILE;
  let best: ThoriumRock | null = null;
  let bestScore = Infinity;
  for (const r of world.rocks) {
    if (!isFreeLanded(r)) continue;
    const ddx = r.x - fromX;
    const ddy = r.y - fromY;
    const fromDist = Math.sqrt(ddx * ddx + ddy * ddy);
    const sdx = r.x - station.x;
    const sdy = r.y - station.y;
    const stationDist = Math.sqrt(sdx * sdx + sdy * sdy);
    if ((chain ? fromDist : stationDist) > limit) continue;
    const score = chain ? fromDist : stationDist + 0.25 * fromDist;
    if (score < bestScore) {
      bestScore = score;
      best = r;
    }
  }
  if (best) {
    best.reservedBy = h.id;
    h.targetRockId = best.id;
    h.state = 'toRock';
    mineTimers.set(h, 0);
  }
  return best;
}

/** Moves the harvester toward (x,y); returns true on arrival. */
function flyTo(h: Harvester, x: number, y: number, dt: number): boolean {
  const dx = x - h.x;
  const dy = y - h.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const step = HARVESTER_SPEED * TILE * dt;
  if (d <= step) {
    h.x = x;
    h.y = y;
    return true;
  }
  h.angle = Math.atan2(dy, dx);
  h.x += (dx / d) * step;
  h.y += (dy / d) * step;
  return false;
}

function updateHarvesters(world: World, towersById: Map<number, Tower>, dt: number): void {
  syncHarvesterCounts(world, towersById);
  for (const h of world.harvesters) {
    const station = towersById.get(h.stationId);
    if (!station) continue;
    const capacity = world.players[h.team].researched.doubleHarvest ? 2 : 1;

    if (h.state === 'idle') {
      if (!pickRock(world, h, station, h.x, h.y, HARVEST_SEARCH_TILES, false)) {
        const a = world.time * 1.3 + h.id * 2.1;
        flyTo(h, station.x + Math.cos(a) * TILE * 0.55, station.y + Math.sin(a) * TILE * 0.55, dt * 0.5);
      }
    }

    if (h.state === 'toRock') {
      const rock = h.targetRockId === null ? null : findRockById(world, h.targetRockId);
      if (!rock || !rock.alive || rock.state !== 'landed' || rock.reservedBy !== h.id) {
        h.targetRockId = null;
        h.state = h.cargo.length > 0 ? 'returning' : 'idle';
      } else if (flyTo(h, rock.x, rock.y, dt)) {
        const t = (mineTimers.get(h) ?? 0) + dt;
        mineTimers.set(h, t);
        if (Math.random() < 0.3) {
          emitParticle(world, rock.x, rock.y, (Math.random() - 0.5) * 60, -20 - Math.random() * 40, 0.3, 1.6, COLORS.thoriumCore, 0.4);
        }
        if (t >= HARVEST_TIME) {
          rock.state = 'carried';
          rock.harvesterId = h.id;
          rock.reservedBy = null;
          rock.carriedBy = null;
          rock.magnetTowerId = null;
          h.cargo.push(rock.id);
          h.targetRockId = null;
          h.state = 'returning';
          if (h.cargo.length < capacity) pickRock(world, h, station, h.x, h.y, HARVEST_CHAIN_TILES, true);
        }
      }
    }

    if (h.state === 'returning') {
      if (flyTo(h, station.x, station.y, dt)) {
        for (const id of h.cargo) {
          const rock = findRockById(world, id);
          if (!rock || !rock.alive || rock.state !== 'carried' || rock.harvesterId !== h.id) continue;
          rock.state = 'refining';
          rock.harvesterId = null;
          rock.magnetTowerId = station.id;
          rock.x = station.x;
          rock.y = station.y;
          station.refineQueue.push(rock.id);
        }
        h.cargo.length = 0;
        h.state = 'idle';
      }
    }

    for (let i = 0; i < h.cargo.length; i++) {
      const rock = findRockById(world, h.cargo[i]!);
      if (!rock) continue;
      rock.x = h.x + (i === 0 ? 0 : 5);
      rock.y = h.y + 6 + (i === 0 ? 0 : 2);
    }
  }
}

// ---------------------------------------------------------------- Refinery (magnet + refining)

function updateRefinery(world: World, tower: Tower, dt: number): void {
  const stats = towerStats(tower.kind, tower.level);
  const radius = stats.magnetRadius * TILE;
  const strength = stats.magnetStrength * TILE;

  let pulling = 0;
  for (const r of world.rocks) if (r.alive && r.state === 'magnet' && r.magnetTowerId === tower.id) pulling++;
  if (pulling < MAX_MAGNET_ROCKS) {
    let best: ThoriumRock | null = null;
    let bestD = radius * radius;
    for (const r of world.rocks) {
      if (!r.alive) continue;
      const eligible =
        (r.state === 'landed' && r.reservedBy === null) ||
        (r.state === 'carried' && r.harvesterId === null && r.carriedBy === tower.team);
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

  for (const r of world.rocks) {
    if (!r.alive || r.state !== 'magnet' || r.magnetTowerId !== tower.id) continue;
    const dx = tower.x - r.x;
    const dy = tower.y - r.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
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
    if (Math.random() < 0.4) {
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

  while (tower.refineQueue.length > 0) {
    const rock = findRockById(world, tower.refineQueue[0]!);
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
  const player = world.players[tower.team];
  addMoney(world, tower.team, value, tower.x, tower.y - TILE * 0.6);
  player.research += RESEARCH_PER_REFINE * rock.value;
  player.stats.rocksRefined++;
  world.events.push({ type: 'rockRefined', team: tower.team, value, x: tower.x, y: tower.y });
  emitBurst(world, tower.x, tower.y, COLORS.thorium, 12, 120, 0.6, 2.5);
  emitBurst(world, tower.x, tower.y, COLORS.research, 6, 80, 0.5, 2);
  addRing(world, tower.x, tower.y, TILE * 0.9, paletteOf(player).bright, 0.4);
  tower.flash = 0.25;
  rock.alive = false;
}
