import type { Emit, Intent, Player, PlayerId, Structure, System, World } from '@/types';
import { MISSILE_SILO } from '@/data';
import { addProjectile } from '@/sim/core';
import { hostile, structureCenter } from './targeting';
import { SHOT_SLACK } from './tuning';

export function siloLoaded(s: Structure): boolean {
  return s.kind === 'missileSilo' && s.buildProgress >= 1 && s.cooldown <= 0;
}

/** Reloads every Missile Silo (Structure.cooldown = seconds until its missile is ready). */
export const siloSystem: System = (w, dt) => {
  for (const s of w.structures.values()) {
    if (s.kind === 'missileSilo' && s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt);
  }
};

/** The targeted enemy's base, else the next living hostile base. */
function missileTarget(w: World, player: PlayerId): Player | null {
  const me = w.players[player];
  const valid = (q: Player | undefined): q is Player => !!q && q.alive && q.baseBuilt && hostile(w, player, q.id);
  const first = w.players[me.attack.targetPlayer];
  if (valid(first)) return first;
  for (let i = 1; i <= w.players.length; i++) {
    const q = w.players[(me.attack.targetPlayer + i) % w.players.length];
    if (valid(q)) return q;
  }
  return null;
}

/** Launches one missile from every loaded silo the player owns. Returns how many were fired. */
export function fireMissiles(w: World, player: PlayerId, emit: Emit): number {
  const silos = [...w.structures.values()].filter((s) => s.owner === player && s.kind === 'missileSilo');
  const deny = (reason: string): number => {
    emit({ t: 'denied', owner: player, reason });
    return 0;
  };
  if (silos.length === 0) return deny('Build a Missile Silo first');
  const loaded = silos.filter(siloLoaded);
  if (loaded.length === 0) return deny('Missile Silo reloading');
  const target = missileTarget(w, player);
  if (!target) return deny('No enemy base to target');
  const tx = target.baseTx + 0.5;
  const ty = target.baseTy + 0.5;
  for (const s of loaded) {
    const { x, y } = structureCenter(s);
    const dist = Math.hypot(tx - x, ty - y) || 1;
    addProjectile(w, {
      owner: player, kind: 'missile', x, y, z: 1,
      vx: ((tx - x) / dist) * MISSILE_SILO.speed, vy: ((ty - y) / dist) * MISSILE_SILO.speed,
      damage: MISSILE_SILO.damage, splash: MISSILE_SILO.splash,
      life: dist / MISSILE_SILO.speed + SHOT_SLACK, layerMask: 'both',
    });
    s.cooldown = MISSILE_SILO.reloadSec;
    emit({ t: 'shot', from: s.id, kind: s.kind, x, y, tx, ty });
  }
  return loaded.length;
}

export function handleMissileIntent(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'fireMissile') return false;
  fireMissiles(w, intent.player, emit);
  return true;
}
