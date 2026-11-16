import type { GridPos, ThoriumRock, World } from '../types';
import { COLORS, ROCK_LIFETIME, TILE } from '../core/config';
import { randInt, randRange } from '../core/Random';
import { createLandedRock, createRock } from '../entities/ThoriumRock';
import { isNearBase } from './Grid';
import { addRing, addShake, emitBurst, emitParticle } from './ParticleSystem';

/** Seconds a landed rock takes to fade out after ROCK_LIFETIME. */
export const ROCK_FADE_TIME = 1.5;
/** Meteor shower cluster centers are chosen in these columns (inclusive). */
export const SHOWER_MIN_COL = 6;
export const SHOWER_MAX_COL = 21;

/** Rock -> world.time when it (last) landed. */
const landTimes = new WeakMap<ThoriumRock, number>();

/** 0..1 opacity of a rock (1 unless it is fading out). Useful for rendering. */
export function rockFade(world: World, rock: ThoriumRock): number {
  if (rock.state !== 'landed' || rock.reservedBy !== null) return 1;
  const t = landTimes.get(rock);
  if (t === undefined) return 1;
  const over = world.time - t - ROCK_LIFETIME;
  return over <= 0 ? 1 : Math.max(0, 1 - over / ROCK_FADE_TIME);
}

/** Counts down world.meteorTimer, triggers showers, animates falling rocks, expires old landed rocks. */
export function updateMeteors(world: World, dt: number): void {
  world.meteorTimer -= dt;
  if (world.meteorTimer <= 0) {
    const [min, max] = world.level.rocksPerShower;
    const count = spawnShower(world, randInt(world.rng, min, max));
    world.meteorTimer = world.level.meteorInterval * randRange(world.rng, 0.8, 1.2);
    if (count > 0) world.events.push({ type: 'meteorShower', count });
  }

  for (const rock of world.rocks) {
    if (!rock.alive) continue;
    if (rock.state === 'falling') {
      updateFalling(world, rock, dt);
    } else if (rock.state === 'landed') {
      let t = landTimes.get(rock);
      if (t === undefined || (rock.reservedBy !== null && t < world.time - ROCK_LIFETIME)) {
        // New landing, or reserved by a harvester: keep it from starting to fade.
        t = t === undefined ? world.time : world.time - ROCK_LIFETIME;
        landTimes.set(rock, t);
      }
      if (rock.reservedBy === null && world.time - t >= ROCK_LIFETIME + ROCK_FADE_TIME) rock.alive = false;
    } else {
      // Picked up / pulled / carried: the lifetime restarts when it lands again.
      landTimes.delete(rock);
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

  if (Math.random() < 0.7) {
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
    landTimes.set(rock, world.time);
    emitBurst(world, rock.x, rock.y, COLORS.thorium, 12, 140, 0.5, 2.5);
    addRing(world, rock.x, rock.y, TILE * 0.9, COLORS.thoriumGlow, 0.45);
    addShake(world, 1);
    world.events.push({ type: 'rockLanded', x: rock.x, y: rock.y });
  }
}

/** Grid indices already occupied (or targeted) by a live rock. */
function takenCells(world: World): Set<number> {
  const cols = world.grid.cols;
  const taken = new Set<number>();
  for (const r of world.rocks) {
    if (!r.alive) continue;
    const x = r.state === 'falling' ? r.targetX : r.x;
    const y = r.state === 'falling' ? r.targetY : r.y;
    taken.add(Math.floor(y / TILE) * cols + Math.floor(x / TILE));
  }
  return taken;
}

function isFreeCell(world: World, taken: Set<number>, col: number, row: number): boolean {
  const g = world.grid;
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return false;
  const idx = row * g.cols + col;
  if (taken.has(idx)) return false;
  const cell = g.cells[idx]!;
  return cell.type === 'empty' && cell.towerId === null && !isNearBase(col, row);
}

/**
 * Grows a cluster of up to `count` adjacent cells from (col,row) accepted by `ok`.
 * Cells are chosen randomly from the 8-neighbour frontier so clusters look organic.
 */
function growCluster(world: World, col: number, row: number, count: number, ok: (c: number, r: number) => boolean): GridPos[] {
  if (!ok(col, row)) return [];
  const cols = world.grid.cols;
  const cluster: GridPos[] = [{ col, row }];
  const used = new Set<number>([row * cols + col]);
  while (cluster.length < count) {
    const frontier: GridPos[] = [];
    for (const p of cluster) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          const c = p.col + dc;
          const r = p.row + dr;
          const idx = r * cols + c;
          if (used.has(idx) || !ok(c, r)) continue;
          used.add(idx);
          frontier.push({ col: c, row: r });
        }
      }
    }
    if (frontier.length === 0) break;
    for (const f of frontier) used.delete(f.row * cols + f.col);
    const next = frontier[Math.floor(world.rng() * frontier.length)]!;
    used.add(next.row * cols + next.col);
    cluster.push(next);
  }
  return cluster;
}

function jittered(world: World, col: number, row: number): [number, number] {
  const j = TILE * 0.15;
  return [col * TILE + TILE / 2 + randRange(world.rng, -j, j), row * TILE + TILE / 2 + randRange(world.rng, -j, j)];
}

/** Drops ONE cluster of up to `count` falling rocks on adjacent free cells. Returns the number spawned. */
export function spawnShower(world: World, count: number): number {
  const taken = takenCells(world);
  const ok = (c: number, r: number): boolean => isFreeCell(world, taken, c, r);
  let best: GridPos[] = [];
  for (let attempt = 0; attempt < 30 && best.length < count; attempt++) {
    const col = randInt(world.rng, SHOWER_MIN_COL, SHOWER_MAX_COL);
    const row = randInt(world.rng, 1, world.grid.rows - 2);
    const cluster = growCluster(world, col, row, count, ok);
    if (cluster.length > best.length) best = cluster;
  }
  for (const p of best) {
    const [x, y] = jittered(world, p.col, p.row);
    world.rocks.push(createRock(world, x, y));
  }
  return best.length;
}

/** Places 2 mirrored clusters of 4-6 landed rocks in the neutral middle of the map. */
export function seedInitialDeposits(world: World): void {
  const cols = world.grid.cols;
  const taken = takenCells(world);
  const count = randInt(world.rng, 4, 6);
  const ok = (c: number, r: number): boolean =>
    c < cols / 2 && isFreeCell(world, taken, c, r) && isFreeCell(world, taken, cols - 1 - c, r);
  let best: GridPos[] = [];
  for (let attempt = 0; attempt < 40 && best.length < count; attempt++) {
    const col = randInt(world.rng, 8, Math.floor(cols / 2) - 2);
    const row = randInt(world.rng, 2, world.grid.rows - 3);
    const cluster = growCluster(world, col, row, count, ok);
    if (cluster.length > best.length) best = cluster;
  }
  for (const p of best) {
    const [x, y] = jittered(world, p.col, p.row);
    const left = createLandedRock(world, x, y);
    const right = createLandedRock(world, cols * TILE - x, y);
    right.size = left.size;
    right.value = left.value;
    world.rocks.push(left, right);
    landTimes.set(left, world.time);
    landTimes.set(right, world.time);
  }
}
