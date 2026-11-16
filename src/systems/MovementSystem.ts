import type { Base, Team, Unit, UnitKind, World } from '../types';
import { COLORS, TEAM_COLORS, TILE, otherTeam } from '../core/config';
import { pick, randRange } from '../core/Random';
import { UNIT_DEFS } from '../data/units';
import { createUnit } from '../entities/Unit';
import { cellCenter, getCell, inBounds, isPassable, pixelToCell } from './Grid';
import { findPath } from './Pathfinding';
import { addRing, addShake, emitBurst } from './ParticleSystem';

/** Spawns a unit on a random free spawn cell of `team`, pushes it to world.units and returns it. */
export function spawnUnit(world: World, team: Team, kind: UnitKind): Unit {
  const player = world.players[team];
  const free = player.spawnCells.filter((c) => isPassable(world.grid, c.col, c.row));
  const candidates = free.length > 0 ? free : player.spawnCells;
  const c = candidates.length > 0 ? pick(world.rng, candidates) : { col: world.bases[team].col, row: world.bases[team].row };
  const center = cellCenter(c.col, c.row);
  const j = TILE * 0.2;
  const x = center.x + randRange(world.rng, -j, j);
  const y = center.y + randRange(world.rng, -j, j);
  const unit = createUnit(world, team, kind, x, y);
  world.units.push(unit);
  player.stats.unitsSent++;
  emitBurst(world, x, y, TEAM_COLORS[team].bright, 8, 70, 0.4, 2);
  return unit;
}

function clampCell(world: World, x: number, y: number): { col: number; row: number } {
  const c = pixelToCell(x, y);
  return {
    col: Math.max(0, Math.min(world.grid.cols - 1, c.col)),
    row: Math.max(0, Math.min(world.grid.rows - 1, c.row)),
  };
}

function isEnemyBaseCell(world: World, unit: Unit, x: number, y: number): boolean {
  const c = pixelToCell(x, y);
  if (!inBounds(world.grid, c.col, c.row)) return false;
  const cell = getCell(world.grid, c.col, c.row);
  return cell !== null && cell.type === 'base' && cell.baseTeam === otherTeam(unit.team);
}

/** Distance from (x,y) to the base rectangle (0 when inside). */
function distToBase(base: Base, x: number, y: number): number {
  const left = base.col * TILE;
  const top = base.row * TILE;
  const dx = Math.max(left - x, 0, x - (left + base.w * TILE));
  const dy = Math.max(top - y, 0, y - (top + base.h * TILE));
  return Math.hypot(dx, dy);
}

function hitBase(world: World, unit: Unit): void {
  const enemy = otherTeam(unit.team);
  const base = world.bases[enemy];
  const damage = UNIT_DEFS[unit.kind].baseDamage;
  unit.alive = false;
  if (world.winner !== null) return;
  base.hp -= damage;
  base.hitFlash = 0.3;
  world.events.push({ type: 'baseHit', team: enemy, damage });
  addShake(world, 4 + damage * 0.4);
  emitBurst(world, unit.x, unit.y, COLORS.explosion, 20, 170, 0.55, 3);
  emitBurst(world, unit.x, unit.y, TEAM_COLORS[unit.team].main, 10, 120, 0.45, 2.5);
  addRing(world, unit.x, unit.y, TILE * 1.1, TEAM_COLORS[enemy].bright, 0.4);
  world.events.push({ type: 'explosion', x: unit.x, y: unit.y, big: damage >= 10 });
  if (base.hp <= 0) {
    base.hp = 0;
    world.winner = unit.team;
    world.events.push({ type: 'gameOver', winner: unit.team });
  }
}

function repath(world: World, unit: Unit): void {
  const start = clampCell(world, unit.x, unit.y);
  const path = findPath(world.grid, start, otherTeam(unit.team));
  unit.pathVersion = world.grid.version;
  if (!path) return;
  unit.path = path;
  unit.pathIndex = path.length > 1 ? 1 : 0;
}

/** Moves units along A* paths (re-path when grid.version changes), applies slow, handles base hits. */
export function updateMovement(world: World, dt: number): void {
  const reachDist = TILE * 0.6;
  for (const unit of world.units) {
    if (!unit.alive) continue;
    const def = UNIT_DEFS[unit.kind];
    unit.age += dt;
    unit.hitFlash = Math.max(0, unit.hitFlash - dt);
    if (unit.slowTimer > 0) {
      unit.slowTimer -= dt;
      if (unit.slowTimer <= 0) {
        unit.slowTimer = 0;
        unit.slowFactor = 1;
      }
    }
    unit.sinceDamage += dt;
    if (unit.maxShield > 0 && unit.shield < unit.maxShield && unit.sinceDamage >= def.shieldRegenDelay) {
      const scale = def.maxShield > 0 ? unit.maxShield / def.maxShield : 1;
      unit.shield = Math.min(unit.maxShield, unit.shield + def.shieldRegen * scale * dt);
    }

    if (unit.pathVersion !== world.grid.version || unit.path.length === 0) repath(world, unit);

    let move = unit.speed * TILE * unit.slowFactor * dt;
    while (move > 0 && unit.pathIndex < unit.path.length) {
      const wp = unit.path[unit.pathIndex]!;
      const target = cellCenter(wp.col, wp.row);
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.0001) unit.angle = Math.atan2(dy, dx);
      if (d <= move) {
        unit.x = target.x;
        unit.y = target.y;
        move -= d;
        unit.pathIndex++;
      } else {
        unit.x += (dx / d) * move;
        unit.y += (dy / d) * move;
        move = 0;
      }
    }

    const enemyBase = world.bases[otherTeam(unit.team)];
    const pathDone = unit.path.length > 0 && unit.pathIndex >= unit.path.length;
    if (
      isEnemyBaseCell(world, unit, unit.x, unit.y) ||
      distToBase(enemyBase, unit.x, unit.y) <= reachDist * 0.25 ||
      (pathDone && distToBase(enemyBase, unit.x, unit.y) <= reachDist)
    ) {
      hitBase(world, unit);
    }
  }
  if (world.units.some((u) => !u.alive)) world.units = world.units.filter((u) => u.alive);
}
