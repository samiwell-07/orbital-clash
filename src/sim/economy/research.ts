import type { Emit, Intent, PlayerId, ResearchDef, World } from '@/types';
import { RESEARCH_DEFS, researchDef } from '@/data';
import { structureAt } from '@/sim/core';
import { spendThorium } from './thorium';

export interface ResearchResult {
  ok: boolean;
  reason: string;
}

/** Bionic Swarm layer: a finished Research Lab owned by the player. */
export function hasResearchLab(w: World, player: PlayerId): boolean {
  if (w.settings.profile !== 'bionic') return false;
  for (const s of w.structures.values()) {
    if (s.kind === 'researchLab' && s.owner === player && s.buildProgress >= 1) return true;
  }
  return false;
}

/** Research the player does not have yet, cheapest first. Empty without a lab. */
export function purchasableResearch(w: World, player: PlayerId): ResearchDef[] {
  if (!hasResearchLab(w, player)) return [];
  const tech = w.players[player].tech;
  return RESEARCH_DEFS.filter((r) => !tech[r.key]).sort((a, b) => a.cost - b.cost);
}

export function unlockResearch(w: World, player: PlayerId, key: string, emit: Emit): ResearchResult {
  const def = researchDef(key);
  if (!def) return { ok: false, reason: 'unknown research' };
  if (!hasResearchLab(w, player)) return { ok: false, reason: 'needs a research lab' };
  const p = w.players[player];
  if (p.tech[key]) return { ok: false, reason: 'already unlocked' };
  if (!spendThorium(w, player, def.cost)) return { ok: false, reason: 'not enough thorium' };
  p.tech[key] = true;
  emit({ t: 'techUnlocked', owner: player, key });
  return { ok: true, reason: '' };
}

/** 'upgrade' (O) on a Research Lab buys the cheapest outstanding research. */
export function handleResearchIntent(w: World, intent: Intent, emit: Emit): boolean {
  if (intent.t !== 'upgrade') return false;
  const s = structureAt(w, intent.tx, intent.ty);
  if (!s || s.kind !== 'researchLab' || s.owner !== intent.player) return false;
  const next = purchasableResearch(w, intent.player)[0];
  const res = next ? unlockResearch(w, intent.player, next.key, emit) : { ok: false, reason: 'nothing to research' };
  if (!res.ok) emit({ t: 'denied', owner: intent.player, reason: res.reason });
  return true;
}
