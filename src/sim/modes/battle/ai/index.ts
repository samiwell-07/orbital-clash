import type { Intent, PlayerId, System, World } from '@/types';
import { STAGE_ORDER, registerSystem } from '@/sim/core/pipeline';
import { queueIntents } from '@/sim/core/intents';
import { newMemory, type AiMemory, type BrainCtx } from './ctx';
import { shipIntents } from './economyBrain';
import { planArmy } from './armyBrain';
import { planBuild } from './buildBrain';
import { pickBaseTile } from './sites';
import { assessThreat } from './threat';
import { AI_TUNING } from './tuning';

export { AI_TUNING } from './tuning';

/**
 * Opponent for Battle/skirmish. Never used in the campaign (the system below ignores non-battle worlds).
 * Each call steers the ship; a decision pass (build, production mix, attack) runs every `thinkSec`,
 * which difficulty scales. Everything is derived from the world and its RNG, so equal seeds play out equally.
 */
export class AdaptiveAI {
  private readonly mem: AiMemory = newMemory();

  update(w: World, me: PlayerId, dt: number): Intent[] {
    const p = w.players[me];
    if (!p.alive || w.over) return [];
    const mem = this.mem;
    const tun = (mem.tuning ??= AI_TUNING[w.settings.difficulty]);
    const move = p.ship.dead ? [] : shipIntents(w, me, mem, dt);
    mem.timer -= dt;
    if (mem.timer > 0) return move;
    mem.timer = tun.thinkSec;

    const out: Intent[] = [];
    if (!p.baseBuilt) {
      if (w.timeSec - mem.baseAskedAt >= 1) {
        mem.baseAskedAt = w.timeSec;
        const site = pickBaseTile(w, me);
        if (site) out.push({ t: 'buildBase', player: me, tx: site.tx, ty: site.ty });
      }
      return out;
    }
    const ctx: BrainCtx = {
      w, me, p, tun, mem, threat: assessThreat(w, me), budget: { thorium: p.thorium }, pending: new Set<number>(), out,
    };
    planBuild(ctx);
    planArmy(ctx);
    return [...out, ...move];
  }
}

const brains = new WeakMap<World, Map<PlayerId, AdaptiveAI>>();

/** Feeds every adaptive player's intents through the normal intent queue, exactly like a human's input. */
export const aiSystem: System = (w, dt) => {
  if (w.settings.mode !== 'battle' || w.settings.mission !== null || w.over) return;
  let map = brains.get(w);
  if (!map) {
    map = new Map();
    brains.set(w, map);
  }
  for (const p of w.players) {
    if (p.controller !== 'adaptive' || !p.alive) continue;
    let ai = map.get(p.id);
    if (!ai) {
      ai = new AdaptiveAI();
      map.set(p.id, ai);
    }
    const intents = ai.update(w, p.id, dt);
    if (intents.length > 0) queueIntents(w, intents);
  }
};

registerSystem('battle.ai', STAGE_ORDER.timeline + 1, aiSystem);
