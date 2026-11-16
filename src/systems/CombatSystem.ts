import type { Team, Tower, TowerKind, Unit, World } from '../types';
import { COLORS, TEAM_COLORS, TILE } from '../core/config';
import { towerStats } from '../data/towers';
import { UNIT_DEFS } from '../data/units';
import { createProjectile } from '../entities/Projectile';
import { addMoney } from './EconomySystem';
import { addRing, addShake, emitBurst, emitParticle } from './ParticleSystem';

/** Radians per second a turret can rotate. */
const TURN_SPEED = 10;

function findUnitById(world: World, id: number): Unit | null {
  for (const u of world.units) if (u.id === id) return u;
  return null;
}

/** Remaining waypoints to the unit's goal (lower = further along). */
function remainingPath(u: Unit): number {
  return u.path.length > 0 ? u.path.length - u.pathIndex : Number.MAX_SAFE_INTEGER;
}

function inRange(tower: Tower, u: Unit, rangePx: number): boolean {
  const dx = u.x - tower.x;
  const dy = u.y - tower.y;
  return dx * dx + dy * dy <= rangePx * rangePx;
}

function acquireTarget(world: World, tower: Tower, rangePx: number): Unit | null {
  if (tower.targetId !== null) {
    const cur = findUnitById(world, tower.targetId);
    if (cur && cur.alive && cur.team !== tower.team && inRange(tower, cur, rangePx)) return cur;
    tower.targetId = null;
  }
  let best: Unit | null = null;
  let bestRemain = Infinity;
  for (const u of world.units) {
    if (!u.alive || u.team === tower.team || !inRange(tower, u, rangePx)) continue;
    const remain = remainingPath(u);
    if (remain < bestRemain) {
      bestRemain = remain;
      best = u;
    }
  }
  tower.targetId = best ? best.id : null;
  return best;
}

function rotateToward(tower: Tower, x: number, y: number, dt: number): void {
  const desired = Math.atan2(y - tower.y, x - tower.x);
  let diff = desired - tower.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const maxStep = TURN_SPEED * dt;
  tower.angle += Math.abs(diff) <= maxStep ? diff : Math.sign(diff) * maxStep;
}

/** Towers acquire targets & fire, projectiles fly/explode, dead units removed + bounty paid. */
export function updateCombat(world: World, dt: number): void {
  for (const tower of world.towers) {
    if (tower.kind === 'refinery') continue;
    tower.cooldown = Math.max(0, tower.cooldown - dt);
    const stats = towerStats(tower.kind, tower.level);
    const rangePx = stats.range * TILE;
    const target = acquireTarget(world, tower, rangePx);
    if (!target) continue;
    rotateToward(tower, target.x, target.y, dt);
    if (tower.cooldown > 0) continue;
    fireTower(world, tower, target);
    tower.cooldown = stats.fireInterval;
    tower.flash = 0.1;
  }

  updateProjectiles(world, dt);
  if (world.units.some((u) => !u.alive)) world.units = world.units.filter((u) => u.alive);
}

function fireTower(world: World, tower: Tower, target: Unit): void {
  const stats = towerStats(tower.kind, tower.level);
  const color = TEAM_COLORS[tower.team].main;
  const muzzle = TILE * 0.4;
  const mx = tower.x + Math.cos(tower.angle) * muzzle;
  const my = tower.y + Math.sin(tower.angle) * muzzle;

  if (tower.kind === 'laser') {
    world.beams.push({
      x1: mx,
      y1: my,
      x2: target.x,
      y2: target.y,
      team: tower.team,
      color,
      width: 2 + tower.level,
      life: 0.08,
      maxLife: 0.08,
    });
    emitBurst(world, target.x, target.y, TEAM_COLORS[tower.team].bright, 3, 90, 0.2, 1.6);
    damageUnit(world, target, stats.damage, 'laser', tower.team);
  } else if (tower.kind === 'cannon') {
    world.projectiles.push(
      createProjectile(world, {
        team: tower.team,
        kind: 'missile',
        x: mx,
        y: my,
        targetId: target.id,
        tx: target.x,
        ty: target.y,
        speed: stats.projectileSpeed * TILE,
        damage: stats.damage,
        splashRadius: stats.splashRadius * TILE,
      }),
    );
  } else if (tower.kind === 'cryo') {
    const radius = stats.splashRadius * TILE;
    const r2 = radius * radius;
    for (const u of world.units) {
      if (!u.alive || u.team === tower.team) continue;
      const dx = u.x - tower.x;
      const dy = u.y - tower.y;
      if (dx * dx + dy * dy > r2) continue;
      u.slowFactor = Math.min(u.slowFactor, stats.slowFactor);
      u.slowTimer = Math.max(u.slowTimer, stats.slowDuration);
      damageUnit(world, u, stats.damage, 'cryo', tower.team);
    }
    addRing(world, tower.x, tower.y, radius, COLORS.cryo, 0.45);
  }
  world.events.push({ type: 'shot', team: tower.team, kind: tower.kind, x: tower.x, y: tower.y });
}

function updateProjectiles(world: World, dt: number): void {
  if (world.projectiles.length === 0) return;
  for (const p of world.projectiles) {
    if (!p.alive) continue;
    if (p.targetId !== null) {
      const t = findUnitById(world, p.targetId);
      if (t && t.alive) {
        p.tx = t.x;
        p.ty = t.y;
      } else {
        p.targetId = null;
      }
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (dist < step + 6) {
      p.x = p.tx;
      p.y = p.ty;
      explodeProjectile(world, p.x, p.y, p.team, p.damage, p.splashRadius, p.kind === 'cryo' ? 'cryo' : 'cannon', p.slowFactor, p.slowDuration);
      p.alive = false;
      continue;
    }
    p.angle = Math.atan2(dy, dx);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;

    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.015;
      const back = p.angle + Math.PI;
      const spread = (Math.random() - 0.5) * 0.8;
      const s = 40 + Math.random() * 40;
      emitParticle(
        world,
        p.x,
        p.y,
        Math.cos(back + spread) * s,
        Math.sin(back + spread) * s,
        0.3 + Math.random() * 0.2,
        2 + Math.random() * 1.5,
        Math.random() < 0.6 ? COLORS.explosion : TEAM_COLORS[p.team].main,
        0.2,
      );
    }
  }
  world.projectiles = world.projectiles.filter((p) => p.alive);
}

function explodeProjectile(
  world: World,
  x: number,
  y: number,
  team: Team,
  damage: number,
  splashRadius: number,
  source: TowerKind,
  slowFactor: number,
  slowDuration: number,
): void {
  const r = Math.max(1, splashRadius);
  for (const u of world.units) {
    if (!u.alive || u.team === team) continue;
    const d = Math.hypot(u.x - x, u.y - y);
    if (d > r) continue;
    const falloff = 1 - 0.5 * (d / r);
    if (slowFactor < 1) {
      u.slowFactor = Math.min(u.slowFactor, slowFactor);
      u.slowTimer = Math.max(u.slowTimer, slowDuration);
    }
    damageUnit(world, u, damage * falloff, source, team);
  }
  emitBurst(world, x, y, COLORS.explosion, 18, 160, 0.5, 3);
  emitBurst(world, x, y, TEAM_COLORS[team].bright, 6, 100, 0.35, 2);
  addRing(world, x, y, r, COLORS.explosion, 0.35);
  addShake(world, 1.5);
  world.events.push({ type: 'explosion', x, y, big: false });
}

/** Applies damage (shield first, laser reduced vs shield). Kills -> bounty, event, explosion. */
export function damageUnit(world: World, unit: Unit, amount: number, source: TowerKind, attackerTeam: Team): void {
  if (!unit.alive || amount <= 0) return;
  unit.sinceDamage = 0;
  unit.hitFlash = 0.12;

  let remaining = amount;
  if (unit.shield > 0) {
    const mult = source === 'laser' ? UNIT_DEFS[unit.kind].shieldLaserMult : 1;
    if (mult <= 0) {
      remaining = 0;
    } else {
      const shieldDamage = remaining * mult;
      if (shieldDamage <= unit.shield) {
        unit.shield -= shieldDamage;
        remaining = 0;
      } else {
        remaining = (shieldDamage - unit.shield) / mult;
        unit.shield = 0;
      }
    }
  }
  if (remaining <= 0) return;
  unit.hp -= remaining;
  if (unit.hp > 0) return;

  unit.hp = 0;
  unit.alive = false;
  const bounty = UNIT_DEFS[unit.kind].bounty;
  addMoney(world, attackerTeam, bounty, unit.x, unit.y - 10);
  world.players[attackerTeam].stats.kills++;
  const big = unit.kind === 'tank';
  world.events.push({ type: 'unitKilled', killerTeam: attackerTeam, kind: unit.kind, bounty, x: unit.x, y: unit.y });
  world.events.push({ type: 'explosion', x: unit.x, y: unit.y, big });
  emitBurst(world, unit.x, unit.y, TEAM_COLORS[unit.team].main, big ? 28 : 14, big ? 180 : 130, 0.6, big ? 3.5 : 2.5);
  emitBurst(world, unit.x, unit.y, COLORS.white, big ? 10 : 5, 220, 0.3, 1.5);
  if (big) {
    addRing(world, unit.x, unit.y, TILE * 1.2, COLORS.explosion, 0.4);
    addShake(world, 3);
  }
}
