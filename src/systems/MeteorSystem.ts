import type { ThoriumRock, World } from '../types';
import { COLORS, ROCK_LIFETIME, TILE } from '../core/config';
import { randInt, randRange } from '../core/Random';
import { createRock } from '../entities/ThoriumRock';
import { getCell, isNearBase, pixelToCell } from './Grid';
import { addRing, addShake, emitBurst, emitParticle } from './ParticleSystem';

/** Seconds a landed rock takes to fade out after ROCK_LIFETIME. */
export const ROCK_FADE_TIME = 1.5;

/** Rock id -> world.time when it (last) landed. */
const landTimes = new Map<number, number>();

/** 0..1 opacity of a rock (1 unless it is fading out). Useful for rendering. */
export function rockFade(world: World, rock: ThoriumRock): number {
  if (rock.state !== 'landed') return 1;
  const t = landTimes.get(rock.id);
  if (t === undefined) return 1;
  const over = world.time - t - ROCK_LIFETIME;
  return over <= 0 ? 1 : Math.max(0, 1 - over / ROCK_FADE_TIME);
}

/** Counts down world.meteorTimer, triggers showers, animates falling rocks, expires old landed rocks. */
export function updateMeteors(world: World, dt: number): void {
  world.meteorTimer -= dt;
  if (world.meteorTimer <= 0) {
    const [min, max] = world.level.rocksPerShower;
    const count = randInt(world.rng, min, max);
    spawnShower(world, count);
    const interval = world.level.meteorInterval;
    world.meteorTimer = interval * randRange(world.rng, 0.8, 1.2);
    world.events.push({ type: 'meteorShower', count });
  }

  for (const rock of world.rocks) {
    if (!rock.alive) continue;
    if (rock.state === 'falling') {
      updateFalling(world, rock, dt);
    } else if (rock.state === 'landed') {
      let t = landTimes.get(rock.id);
      if (t === undefined) {
        t = world.time;
        landTimes.set(rock.id, t);
      }
      if (world.time - t >= ROCK_LIFETIME + ROCK_FADE_TIME) rock.alive = false;
    } else {
      // Picked up / pulled: the lifetime restarts when it lands again.
      landTimes.delete(rock.id);
    }
  }

  if (landTimes.size > 0) {
    for (const id of landTimes.keys()) {
      if (!world.rocks.some((r) => r.id === id && r.alive)) landTimes.delete(id);
    }
  }
  if (world.rocks.some((r) => !r.alive)) world.rocks = world.rocks.filter((r) => r.alive);
}

function updateFalling(world: World, rock: ThoriumRock, dt: number): void {
  rock.fallTimer += dt;
  const t = Math.min(1, rock.fallTimer / rock.fallDuration);
  const e = t * t;
  rock.x = rock.startX + (rock.targetX - rock.startX) * e;
  rock.y = rock.startY + (rock.targetY - rock.startY) * e;

  if (Math.random() < 0.8) {
    emitParticle(
      world,
      rock.x + (Math.random() - 0.5) * 6,
      rock.y + (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 30 - 10,
      0.4 + Math.random() * 0.3,
      2 + Math.random() * 2.5 * rock.size,
      Math.random() < 0.6 ? COLORS.thorium : COLORS.thoriumCore,
      0.3,
    );
  }

  if (t >= 1) {
    rock.x = rock.targetX;
    rock.y = rock.targetY;
    rock.state = 'landed';
    landTimes.set(rock.id, world.time);
    emitBurst(world, rock.x, rock.y, COLORS.thorium, 16, 140, 0.5, 2.5);
    addRing(world, rock.x, rock.y, TILE * 0.9, COLORS.thoriumGlow, 0.45);
    addShake(world, 1.2);
    world.events.push({ type: 'rockLanded', x: rock.x, y: rock.y });
  }
}

/** Spawns `count` falling rocks targeting free empty cells (no tower/base/rock/other rock). */
export function spawnShower(world: World, count: number): void {
  const grid = world.grid;
  const taken = new Set<number>();
  for (const r of world.rocks) {
    if (!r.alive) continue;
    const c = pixelToCell(r.state === 'falling' ? r.targetX : r.x, r.state === 'falling' ? r.targetY : r.y);
    taken.add(c.row * grid.cols + c.col);
  }

  const free: number[] = [];
  const weights: number[] = [];
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const idx = row * grid.cols + col;
      if (taken.has(idx)) continue;
      const cell = getCell(grid, col, row);
      if (!cell || cell.type !== 'empty' || cell.towerId !== null) continue;
      if (isNearBase(col, row)) continue;
      free.push(idx);
      weights.push(col >= 6 && col <= 25 ? 4 : 1);
    }
  }

  const jitter = TILE * 0.18;
  for (let n = 0; n < count && free.length > 0; n++) {
    let total = 0;
    for (const w of weights) total += w;
    let roll = world.rng() * total;
    let i = 0;
    for (; i < weights.length - 1; i++) {
      roll -= weights[i]!;
      if (roll < 0) break;
    }
    const idx = free[i]!;
    free.splice(i, 1);
    weights.splice(i, 1);
    const col = idx % grid.cols;
    const row = Math.floor(idx / grid.cols);
    const x = col * TILE + TILE / 2 + randRange(world.rng, -jitter, jitter);
    const y = row * TILE + TILE / 2 + randRange(world.rng, -jitter, jitter);
    world.rocks.push(createRock(world, x, y));
  }
}
