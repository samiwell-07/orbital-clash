import type { Emit, PlayerId, World } from '@/types';

function defaultEmit(w: World): Emit {
  return (e) => {
    w.events.push(e);
  };
}

/** Credits thorium, tracks stats.thoriumEarned and emits a 'thorium' event. Returns the amount credited. */
export function addThorium(w: World, player: PlayerId, amount: number, emit: Emit = defaultEmit(w)): number {
  if (!(amount > 0)) return 0;
  const p = w.players[player];
  p.thorium += amount;
  p.stats.thoriumEarned += amount;
  emit({ t: 'thorium', owner: player, amount });
  return amount;
}

/** Deducts thorium if affordable. Returns false (and changes nothing) otherwise. */
export function spendThorium(w: World, player: PlayerId, amount: number): boolean {
  const p = w.players[player];
  if (amount < 0 || p.thorium < amount) return false;
  p.thorium -= amount;
  return true;
}

/** Patch 1.01: destroying an enemy base in Battle pays a thorium bonus. No-op outside Battle mode. */
export function awardBaseKillBonus(w: World, player: PlayerId, amount: number, emit: Emit = defaultEmit(w)): number {
  if (w.settings.mode !== 'battle') return 0;
  return addThorium(w, player, amount, emit);
}
