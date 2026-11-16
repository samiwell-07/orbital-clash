import type { Base, GridPos, Team, Unit, UnitKind, World } from '../types';
import { COLORS, TILE, otherTeam, paletteOf } from '../core/config';
import { UNIT_DEFS } from '../data/units';
import { createUnit } from '../entities/Unit';
import { nextStep, updateFlowFields } from './FlowField';
import { rebuildSpatial } from './Spatial';
import { addRing, addShake, emitBurst } from './ParticleSystem';

/** Grid version each world's ground units last routed against. */
const routedVersion = new WeakMap<World, number>();

const HALF = TILE / 2;

/** Spawns a unit exactly at the center of `spawnCell` (no jitter, so trains stay single-file). */
export function spawnUnit(world: World, team: Team, kind: UnitKind, spawnCell: GridPos, trainIndex: number): Unit {
  const x = spawnCell.col * TILE + HALF;
  const y = spawnCell.row * TILE + HALF;
  const unit = createUnit(world, team, kind, x, y, spawnCell.col, spawnCell.row, trainIndex);
  world.units.push(unit);
  world.players[team].stats.unitsSent++;
  emitBurst(world, x, y, paletteOf(world.players[team]).bright, unit.air ? 4 : 2, 60, 0.3, 1.8);
  return unit;
}

function isEnemyBaseCell(world: World, team: Team, col: number, row: number): boolean {
  const g = world.grid;
  if (col < 0 || row < 0 || col >= g.cols || row >= g.rows) return false;
  const cell = g.cells[row * g.cols + col]!;
  return cell.type === 'base' && cell.baseTeam !== team;
}

/** Distance from (x,y) to the base rectangle (0 when inside). */
export function distToBase(base: Base, x: number, y: number): number {
  const left = base.col * TILE;
  const top = base.row * TILE;
  const dx = Math.max(left - x, 0, x - (left + base.w * TILE));
  const dy = Math.max(top - y, 0, y - (top + base.h * TILE));
  return Math.sqrt(dx * dx + dy * dy);
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
  addShake(world, 2 + damage * 0.6);
  const big = damage >= 4;
  emitBurst(world, unit.x, unit.y, COLORS.explosion, big ? 16 : 6, 160, 0.5, 3);
  emitBurst(world, unit.x, unit.y, paletteOf(world.players[unit.team]).main, big ? 8 : 3, 120, 0.4, 2.5);
  if (big) addRing(world, unit.x, unit.y, TILE * 1.1, paletteOf(world.players[enemy]).bright, 0.4);
  world.events.push({ type: 'explosion', x: unit.x, y: unit.y, big });
  if (base.hp <= 0) {
    base.hp = 0;
    world.winner = unit.team;
    world.events.push({ type: 'gameOver', winner: unit.team });
  }
}

function cellOf(world: World, x: number, y: number): number {
  const g = world.grid;
  let c = Math.floor(x / TILE);
  let r = Math.floor(y / TILE);
  if (c < 0) c = 0;
  else if (c >= g.cols) c = g.cols - 1;
  if (r < 0) r = 0;
  else if (r >= g.rows) r = g.rows - 1;
  return r * g.cols + c;
}

/**
 * Picks the waypoint after (col,row) via nextStep (which already falls back to any reachable neighbour when the
 * cell is blocked/unreachable). If even that fails, steps straight toward the enemy base.
 */
function route(world: World, unit: Unit, col: number, row: number): void {
  const step = nextStep(world, unit.team, col, row);
  if (step) {
    unit.nextCol = step.col;
    unit.nextRow = step.row;
    return;
  }
  // Completely cut off: walk straight toward the enemy base, one cell at a time.
  const base = world.bases[otherTeam(unit.team)];
  const bc = base.col + (base.w >> 1);
  const br = base.row + (base.h >> 1);
  const dc = bc - col;
  const dr = br - row;
  const horizontal = Math.abs(dc) >= Math.abs(dr);
  unit.nextCol = horizontal ? col + Math.sign(dc) : col;
  unit.nextRow = horizontal ? row : row + Math.sign(dr);
}

function moveGround(world: World, unit: Unit, move: number): void {
  const reroute = routedVersion.get(world) !== world.grid.version;
  if (reroute) {
    const idx = cellOf(world, unit.x, unit.y);
    const col = idx % world.grid.cols;
    const row = Math.floor(idx / world.grid.cols);
    const nextCell = world.grid.cells[unit.nextRow * world.grid.cols + unit.nextCol];
    const nextBlocked = nextCell !== undefined && nextCell.towerId !== null;
    // Already inside its (still open) waypoint cell: finish reaching the center; arrival re-queries the new field.
    if (nextBlocked || col !== unit.nextCol || row !== unit.nextRow) route(world, unit, col, row);
  }
  for (let guard = 0; guard < 8 && move > 0; guard++) {
    const tx = unit.nextCol * TILE + HALF;
    const ty = unit.nextRow * TILE + HALF;
    const dx = tx - unit.x;
    const dy = ty - unit.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (isEnemyBaseCell(world, unit.team, unit.nextCol, unit.nextRow) && d - move <= HALF) {
      hitBase(world, unit);
      return;
    }
    if (d > 0.0001) unit.angle = Math.atan2(dy, dx);
    if (d <= move) {
      unit.x = tx;
      unit.y = ty;
      move -= d;
      route(world, unit, unit.nextCol, unit.nextRow);
    } else {
      unit.x += (dx / d) * move;
      unit.y += (dy / d) * move;
      move = 0;
    }
  }
}

function moveAir(world: World, unit: Unit, move: number): void {
  const base = world.bases[otherTeam(unit.team)];
  const dx = base.x - unit.x;
  const dy = base.y - unit.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d > 0.0001) {
    unit.angle = Math.atan2(dy, dx);
    const k = Math.min(1, move / d);
    unit.x += dx * k;
    unit.y += dy * k;
  }
  if (distToBase(base, unit.x, unit.y) <= TILE * 0.25) hitBase(world, unit);
}

/** Moves ground units along the flow fields and air units straight at the enemy base; handles base hits. */
export function updateMovement(world: World, dt: number): void {
  updateFlowFields(world);
  const units = world.units;
  for (let i = 0; i < units.length; i++) {
    const unit = units[i]!;
    if (!unit.alive) continue;
    const def = UNIT_DEFS[unit.kind];
    unit.age += dt;
    if (unit.hitFlash > 0) unit.hitFlash = Math.max(0, unit.hitFlash - dt);
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
    const move = unit.speed * TILE * unit.slowFactor * dt;
    if (unit.air) moveAir(world, unit, move);
    else moveGround(world, unit, move);
  }
  routedVersion.set(world, world.grid.version);

  let w = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.alive) units[w++] = u;
  }
  units.length = w;
  rebuildSpatial(world.spatial, units);
}
