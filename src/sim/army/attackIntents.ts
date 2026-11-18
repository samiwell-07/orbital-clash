import type { Intent, PlayerId, World, Emit } from '@/types';

/** Next living enemy-team player after `from` (cyclic by id), or `from` when there is none. */
export function nextEnemy(w: World, owner: PlayerId, from: PlayerId): PlayerId {
  const me = w.players[owner];
  for (let i = 1; i <= 4; i++) {
    const t = ((from + i) % 4) as PlayerId;
    const q = w.players[t];
    if (q.alive && q.team !== me.team) return t;
  }
  return from;
}

/**
 * Attack menu intents: attackSelect (null stops, unless locked), attackLock (unlocking also
 * clears the selection so the stick picks anew), cycleTarget (L1).
 */
export function handleAttackIntent(w: World, intent: Intent, emit: Emit): boolean {
  switch (intent.t) {
    case 'attackSelect': {
      const a = w.players[intent.player].attack;
      if (intent.kind !== null || !a.locked) a.selected = intent.kind;
      return true;
    }
    case 'attackLock': {
      const a = w.players[intent.player].attack;
      if (a.locked === intent.locked) return true;
      a.locked = intent.locked;
      if (!intent.locked) a.selected = null;
      emit({ t: 'attackLocked', owner: intent.player, locked: intent.locked });
      return true;
    }
    case 'cycleTarget': {
      const a = w.players[intent.player].attack;
      a.targetPlayer = nextEnemy(w, intent.player, a.targetPlayer);
      return true;
    }
    default:
      return false;
  }
}
