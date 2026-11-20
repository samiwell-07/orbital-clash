import type { Emit, Player, PlayerId, System, World } from '@/types';
import {
  SHIP_DEATH_PENALTY, SHIP_FULL_HEAL_S, SHIP_HEAL_RADIUS, SHIP_HP_CAP, SHIP_HP_PER_TOKEN, SHIP_HP_START, SHIP_RESPAWN_S,
} from '@/config/constants';
import { releaseRock } from './rocks';

/** Players that fly a ship (humans and the adaptive AI); scripted enemies and empty slots have none. */
export function hasShip(p: Player): boolean {
  return p.alive && (p.controller === 'human' || p.controller === 'adaptive');
}

/** A live ship that weapons, splash and kamikaze drones may hit. */
export function shipTargetable(p: Player): boolean {
  return hasShip(p) && !p.ship.dead;
}

/** Destroys the ship: drops its rock (keeping the ship's velocity), shrinks max hp and starts the respawn timer. */
export function destroyShip(w: World, owner: PlayerId, killer: PlayerId | -1, emit: Emit): void {
  const s = w.players[owner].ship;
  if (s.dead) return;
  if (s.carrying !== 0) {
    const rock = w.rocks.find((r) => r.id === s.carrying);
    if (rock && rock.state === 'grabbed' && rock.carriedBy === owner) releaseRock(w, rock);
    s.carrying = 0;
  }
  s.hp = 0;
  s.dead = true;
  s.healing = false;
  s.maxHp = Math.max(SHIP_HP_START, s.maxHp - SHIP_DEATH_PENALTY);
  s.respawnTimer = SHIP_RESPAWN_S;
  s.vx = 0;
  s.vy = 0;
  emit({ t: 'shipDestroyed', owner, x: s.x, y: s.y, killer });
  emit({ t: 'explosion', x: s.x, y: s.y, radius: 0.8, big: true });
}

/** Applies raw damage to a ship (callers scale weapon damage). Returns true when this hit destroyed it. */
export function damageShip(w: World, owner: PlayerId, amount: number, attacker: PlayerId | -1, emit: Emit): boolean {
  const p = w.players[owner];
  if (!shipTargetable(p) || amount <= 0) return false;
  const s = p.ship;
  s.hp = Math.max(0, s.hp - amount);
  emit({ t: 'shipHit', owner, hp: s.hp, maxHp: s.maxHp, attacker });
  if (s.hp > 0) return false;
  destroyShip(w, owner, attacker, emit);
  return true;
}

/** Health token: +SHIP_HP_PER_TOKEN max hp (capped) and the same amount healed. */
export function applyHealthToken(w: World, owner: PlayerId): void {
  const s = w.players[owner].ship;
  s.maxHp = Math.min(SHIP_HP_CAP, s.maxHp + SHIP_HP_PER_TOKEN);
  if (!s.dead) s.hp = Math.min(s.maxHp, s.hp + SHIP_HP_PER_TOKEN);
}

function respawn(w: World, p: Player, emit: Emit): void {
  const s = p.ship;
  const x = p.baseBuilt ? p.baseTx + 0.5 : w.grid.w / 2;
  const y = p.baseBuilt ? p.baseTy + 0.5 : w.grid.h / 2;
  s.x = x;
  s.y = y;
  s.vx = 0;
  s.vy = 0;
  s.cursorTx = Math.floor(x);
  s.cursorTy = Math.floor(y);
  s.dead = false;
  s.respawnTimer = 0;
  s.hp = s.maxHp;
  emit({ t: 'shipRespawned', owner: p.id, x, y, hp: s.hp, maxHp: s.maxHp });
}

function overOwnBase(p: Player): boolean {
  if (!p.baseBuilt) return false;
  return Math.hypot(p.ship.x - (p.baseTx + 0.5), p.ship.y - (p.baseTy + 0.5)) <= SHIP_HEAL_RADIUS;
}

/** Death fallback, respawn countdown, and healing over the own (living) base. Full heal of SHIP_HP_CAP takes SHIP_FULL_HEAL_S. */
export const shipHealthSystem: System = (w, dt, emit) => {
  for (const p of w.players) {
    const s = p.ship;
    if (!hasShip(p)) {
      s.healing = false;
      continue;
    }
    if (!s.dead && s.hp <= 0) destroyShip(w, p.id, -1, emit);
    if (s.dead) {
      s.respawnTimer -= dt;
      if (s.respawnTimer <= 1e-9) respawn(w, p, emit);
      continue;
    }
    s.healing = s.hp < s.maxHp && overOwnBase(p);
    if (s.healing) s.hp = Math.min(s.maxHp, s.hp + (SHIP_HP_CAP / SHIP_FULL_HEAL_S) * dt);
  }
};
