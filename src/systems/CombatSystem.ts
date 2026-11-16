import type { Team, Tower, TowerKind, TowerLevelStats, Unit, World } from '../types';
import { COLORS, TILE, otherTeam, paletteOf } from '../core/config';
import { TOWER_DEFS, towerStats } from '../data/towers';
import { UNIT_DEFS } from '../data/units';
import { createProjectile } from '../entities/Projectile';
import { addMoney } from './EconomySystem';
import { distToBase } from './MovementSystem';
import { addRing, addShake, emitBurst, emitParticle } from './ParticleSystem';
import { queryUnits } from './Spatial';

/** Radians per second a turret can rotate. */
const TURN_SPEED = 10;
const UNREACHABLE_PRIORITY = 1e6;

/** id -> live unit, rebuilt once per updateCombat (projectile tracking, target retention). */
const unitById = new Map<number, Unit>();

// Module-level query state so the hot spatial callbacks never allocate closures.
let qWorld: World | null = null;
let qGround = true;
let qAir = false;
let qBest: Unit | null = null;
let qBestPriority = Infinity;
let qDamage = 0;
let qRadius = 1;
let qSource: TowerKind = 'laser';
let qTeam: Team = 0;
let qSlowFactor = 1;
let qSlowDuration = 0;
let qSkip: Unit | null = null;
let qFalloff = true;

/** Lower = closer to its goal (flow distance in cells; air: straight tiles to the base). */
function goalPriority(world: World, u: Unit): number {
  if (u.air) return distToBase(world.bases[otherTeam(u.team)], u.x, u.y) / TILE;
  const g = world.grid;
  const c = Math.floor(u.x / TILE);
  const r = Math.floor(u.y / TILE);
  if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return UNREACHABLE_PRIORITY;
  const d = world.flow.dist[u.team][r * g.cols + c]!;
  return d < 0 ? UNREACHABLE_PRIORITY : d;
}

function acquireVisit(u: Unit): void {
  if (u.air ? !qAir : !qGround) return;
  const p = goalPriority(qWorld!, u);
  if (p < qBestPriority) {
    qBestPriority = p;
    qBest = u;
  }
}

function canHit(tower: Tower, u: Unit): boolean {
  const def = TOWER_DEFS[tower.kind];
  return u.air ? def.hitsAir : def.hitsGround;
}

function acquireTarget(world: World, tower: Tower, rangePx: number): Unit | null {
  if (tower.targetId !== null) {
    const cur = unitById.get(tower.targetId);
    if (cur && cur.alive && canHit(tower, cur)) {
      const dx = cur.x - tower.x;
      const dy = cur.y - tower.y;
      if (dx * dx + dy * dy <= rangePx * rangePx) return cur;
    }
    tower.targetId = null;
  }
  const def = TOWER_DEFS[tower.kind];
  qWorld = world;
  qGround = def.hitsGround;
  qAir = def.hitsAir;
  qBest = null;
  qBestPriority = Infinity;
  queryUnits(world.spatial, tower.x, tower.y, rangePx, otherTeam(tower.team), acquireVisit);
  // Assigned inside the query callback; widen TS's narrowing from the `null` reset above.
  const best = qBest as Unit | null;
  qBest = null;
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

/** Towers acquire targets & fire, projectiles fly/explode, dead units are removed. */
export function updateCombat(world: World, dt: number): void {
  unitById.clear();
  const units = world.units;
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.alive) unitById.set(u.id, u);
  }

  for (const tower of world.towers) {
    if (tower.kind === 'refinery') continue;
    if (tower.cooldown > 0) tower.cooldown = Math.max(0, tower.cooldown - dt);
    const stats = towerStats(tower.kind, tower.level);
    const target = acquireTarget(world, tower, stats.range * TILE);
    if (!target) continue;
    rotateToward(tower, target.x, target.y, dt);
    if (tower.cooldown > 0) continue;
    fireTower(world, tower, target, stats);
    tower.cooldown += stats.fireInterval;
    tower.flash = 0.1;
  }

  updateProjectiles(world, dt);

  let w = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.alive) units[w++] = u;
  }
  units.length = w;
  qWorld = null;
}

function splashVisit(u: Unit, distSq: number): void {
  if (u === qSkip || !u.alive) return;
  if (u.air ? !qAir : !qGround) return;
  const world = qWorld!;
  if (qSlowFactor < 1 && !u.air) {
    if (qSlowFactor < u.slowFactor) u.slowFactor = qSlowFactor;
    if (qSlowDuration > u.slowTimer) u.slowTimer = qSlowDuration;
  }
  const falloff = qFalloff ? 1 - 0.5 * (Math.sqrt(distSq) / qRadius) : 1;
  damageUnit(world, u, qDamage * falloff, qSource, qTeam);
}

/** Damages every enemy unit within `radius` px of (x,y) honouring the tower's ground/air reach. */
function applySplash(
  world: World,
  tower: { team: Team; kind: TowerKind },
  x: number,
  y: number,
  radius: number,
  damage: number,
  falloff: boolean,
  skip: Unit | null,
  slowFactor: number,
  slowDuration: number,
): void {
  const def = TOWER_DEFS[tower.kind];
  qWorld = world;
  qGround = def.hitsGround;
  qAir = def.hitsAir;
  qDamage = damage;
  qRadius = Math.max(1, radius);
  qSource = tower.kind;
  qTeam = tower.team;
  qSlowFactor = slowFactor;
  qSlowDuration = slowDuration;
  qSkip = skip;
  qFalloff = falloff;
  queryUnits(world.spatial, x, y, qRadius, otherTeam(tower.team), splashVisit);
  qSkip = null;
}

function fireTower(world: World, tower: Tower, target: Unit, stats: TowerLevelStats): void {
  const muzzle = TILE * 0.42;
  const mx = tower.x + Math.cos(tower.angle) * muzzle;
  const my = tower.y + Math.sin(tower.angle) * muzzle;

  if (tower.kind === 'laser') {
    const life = 0.07;
    world.beams.push({
      x1: mx,
      y1: my,
      x2: target.x,
      y2: target.y,
      team: tower.team,
      style: 'laser',
      color: COLORS.laser,
      width: 2 + tower.level,
      life,
      maxLife: life,
    });
    emitBurst(world, target.x, target.y, COLORS.laser, 2, 80, 0.18, 1.5);
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
    emitBurst(world, mx, my, COLORS.fireball, 3, 70, 0.2, 2);
  } else if (tower.kind === 'cryo') {
    const radius = stats.splashRadius * TILE;
    applySplash(world, tower, tower.x, tower.y, radius, stats.damage, false, null, stats.slowFactor, stats.slowDuration);
    addRing(world, tower.x, tower.y, radius, COLORS.cryo, 0.45);
  } else if (tower.kind === 'plasma') {
    const life = stats.fireInterval * 1.6;
    world.beams.push({
      x1: mx,
      y1: my,
      x2: target.x,
      y2: target.y,
      team: tower.team,
      style: 'plasma',
      color: COLORS.plasma,
      width: 4 + tower.level,
      life,
      maxLife: life,
    });
    const tx = target.x;
    const ty = target.y;
    damageUnit(world, target, stats.damage, 'plasma', tower.team);
    applySplash(world, tower, tx, ty, stats.splashRadius * TILE, stats.damage * 0.5, false, target, 1, 0);
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 70;
      emitParticle(
        world,
        tx,
        ty,
        Math.cos(a) * s,
        Math.sin(a) * s,
        0.15 + Math.random() * 0.15,
        1.5 + Math.random() * 1.5,
        i === 0 ? COLORS.plasmaCore : COLORS.plasma,
        0.2,
      );
    }
  }
  world.events.push({ type: 'shot', team: tower.team, kind: tower.kind, x: tower.x, y: tower.y });
}

function updateProjectiles(world: World, dt: number): void {
  const list = world.projectiles;
  if (list.length === 0) return;
  for (const p of list) {
    if (!p.alive) continue;
    if (p.targetId !== null) {
      const t = unitById.get(p.targetId);
      if (t && t.alive) {
        p.tx = t.x;
        p.ty = t.y;
      } else {
        p.targetId = null;
      }
    }
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed * dt;
    if (dist < step + 6) {
      p.x = p.tx;
      p.y = p.ty;
      explodeFireball(world, p.x, p.y, p.team, p.damage, p.splashRadius);
      p.alive = false;
      continue;
    }
    p.angle = Math.atan2(dy, dx);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;

    p.trailTimer -= dt;
    if (p.trailTimer <= 0) {
      p.trailTimer = 0.025;
      const back = p.angle + Math.PI;
      const spread = (Math.random() - 0.5) * 0.8;
      const s = 40 + Math.random() * 40;
      emitParticle(
        world,
        p.x,
        p.y,
        Math.cos(back + spread) * s,
        Math.sin(back + spread) * s,
        0.25 + Math.random() * 0.2,
        2 + Math.random() * 1.5,
        Math.random() < 0.6 ? COLORS.fireball : COLORS.explosion,
        0.2,
      );
    }
  }
  let w = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i]!;
    if (p.alive) list[w++] = p;
  }
  list.length = w;
}

const CANNON = { team: 0 as Team, kind: 'cannon' as TowerKind };

function explodeFireball(world: World, x: number, y: number, team: Team, damage: number, splashRadius: number): void {
  CANNON.team = team;
  applySplash(world, CANNON, x, y, splashRadius, damage, true, null, 1, 0);
  // Level-3 mortars have the largest splash radius; only they shake the screen hard.
  const big = splashRadius >= towerStats('cannon', 2).splashRadius * TILE - 0.01;
  emitBurst(world, x, y, COLORS.explosion, big ? 14 : 9, 150, 0.45, 3);
  emitBurst(world, x, y, COLORS.fireball, big ? 6 : 4, 100, 0.35, 2.2);
  addRing(world, x, y, Math.max(1, splashRadius), COLORS.explosion, 0.35);
  addShake(world, big ? 3 : 0.5);
  world.events.push({ type: 'explosion', x, y, big });
}

/** Applies damage (shield first; laser/plasma scaled vs shield). Kills -> bounty, event, particles. */
export function damageUnit(world: World, unit: Unit, amount: number, source: TowerKind, attackerTeam: Team): void {
  if (!unit.alive || amount <= 0) return;
  unit.sinceDamage = 0;
  unit.hitFlash = 0.12;

  let remaining = amount;
  if (unit.shield > 0) {
    const mult = source === 'laser' || source === 'plasma' ? UNIT_DEFS[unit.kind].shieldLaserMult : 1;
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
  const def = UNIT_DEFS[unit.kind];
  const bounty = def.bounty;
  // Floating "+$" text only for valuable kills: swarms die by the hundred.
  if (bounty >= 5) addMoney(world, attackerTeam, bounty, unit.x, unit.y - 10);
  else addMoney(world, attackerTeam, bounty);
  world.players[attackerTeam].stats.kills++;
  const big = unit.kind === 'tank' || unit.kind === 'bomber';
  world.events.push({ type: 'unitKilled', killerTeam: attackerTeam, kind: unit.kind, bounty, x: unit.x, y: unit.y });
  world.events.push({ type: 'explosion', x: unit.x, y: unit.y, big });
  const color = paletteOf(world.players[unit.team]).main;
  if (big) {
    emitBurst(world, unit.x, unit.y, color, 16, 170, 0.6, 3.5);
    emitBurst(world, unit.x, unit.y, COLORS.explosion, 10, 200, 0.4, 2.5);
    addRing(world, unit.x, unit.y, TILE * 1.2, COLORS.explosion, 0.4);
    addShake(world, unit.kind === 'tank' ? 3 : 2);
  } else {
    emitBurst(world, unit.x, unit.y, color, 4, 120, 0.45, 2.2);
    emitBurst(world, unit.x, unit.y, COLORS.white, 2, 180, 0.25, 1.4);
  }
}
