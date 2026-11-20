import type { Player, PlayerId, UnitKind, World } from '@/types';
import { DEFS } from '@/data';
import { structuresOf } from '@/sim/core/entities';

export interface Threat {
  incoming: number;
  air: number;
  ground: number;
  byKind: Partial<Record<UnitKind, number>>;
  /** Distance in tiles of the closest incoming unit to my base (Infinity when none). */
  nearest: number;
  airShare: number;
}

export interface Defence {
  antiAir: number;
  groundOnly: number;
  weapons: number;
  structures: number;
}

export function isHostile(w: World, a: PlayerId, b: PlayerId): boolean {
  return w.players[a].team !== w.players[b].team;
}

/** Living enemy players that have a base, in id order. */
export function enemiesOf(w: World, me: PlayerId): Player[] {
  return w.players.filter((p) => p.id !== me && p.alive && p.baseBuilt && isHostile(w, me, p.id));
}

/** The enemy with the fewest hits left (ties: lowest id): the cheapest base to finish. */
export function weakestEnemy(w: World, me: PlayerId): PlayerId | null {
  let best: Player | null = null;
  for (const p of enemiesOf(w, me)) {
    if (!best || p.maxHits - p.hits < best.maxHits - best.hits) best = p;
  }
  return best ? best.id : null;
}

/** What the enemy has fielded: used to pick counters (drones vs. ground-only defence, etc.). */
export function enemyDefence(w: World, enemy: PlayerId): Defence {
  const d: Defence = { antiAir: 0, groundOnly: 0, weapons: 0, structures: 0 };
  for (const s of structuresOf(w, enemy)) {
    d.structures++;
    if (s.kind !== 'turret' && s.kind !== 'laser' && s.kind !== 'pulsar' && s.kind !== 'bomber') continue;
    d.weapons++;
    if (DEFS.weapon(s.kind).targets === 'ground') d.groundOnly++;
    else d.antiAir++;
  }
  return d;
}

/** Units sent against my base, by kind, so the build brain can counter what the enemy actually sends. */
export function assessThreat(w: World, me: PlayerId): Threat {
  const t: Threat = { incoming: 0, air: 0, ground: 0, byKind: {}, nearest: Infinity, airShare: 0 };
  const base = w.players[me];
  for (const u of w.units) {
    if (u.state === 'dead' || u.targetPlayer !== me || !isHostile(w, me, u.owner)) continue;
    t.incoming++;
    if (u.layer === 'air') t.air++;
    else t.ground++;
    t.byKind[u.kind] = (t.byKind[u.kind] ?? 0) + 1;
    if (base.baseBuilt) t.nearest = Math.min(t.nearest, Math.hypot(u.x - base.baseTx - 0.5, u.y - base.baseTy - 0.5));
  }
  t.airShare = t.incoming > 0 ? t.air / t.incoming : 0;
  return t;
}

export function storedTotal(p: Player): number {
  let n = 0;
  for (const v of Object.values(p.stored)) n += v ?? 0;
  return n;
}
