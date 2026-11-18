import type { Rock, System } from '@/types';
import { addThorium } from './thorium';
import { mapThoriumFactor } from './meteors';
import { ECON } from './tuning';

/**
 * Bionic Swarm layer: each finished Harvester drains a little thorium from the nearest landed rock
 * in range every few seconds, then recharges. Does nothing outside the bionic profile.
 */
export const harvestSystem: System = (w, dt, emit) => {
  if (w.settings.profile !== 'bionic') return;
  for (const s of w.structures.values()) {
    if (s.kind !== 'harvester' || s.buildProgress < 1) continue;
    s.cooldown -= dt;
    if (s.cooldown > 0) continue;
    const cx = s.tx + 0.5;
    const cy = s.ty + 0.5;
    let best: Rock | null = null;
    let bestD = ECON.harvesterRange * ECON.harvesterRange;
    for (const r of w.rocks) {
      if (r.state !== 'landed') continue;
      const d = (r.x - cx) ** 2 + (r.y - cy) ** 2;
      if (d < bestD) {
        best = r;
        bestD = d;
      }
    }
    if (!best) {
      s.cooldown = ECON.harvesterRetry;
      continue;
    }
    const pull = Math.min(best.thorium, ECON.harvesterPull);
    best.thorium -= pull;
    const gain = Math.round(pull * w.settings.thoriumRate * mapThoriumFactor(w));
    addThorium(w, s.owner, gain, emit);
    if (best.thorium <= 0) {
      best.state = 'smashed';
      emit({ t: 'rockSmashed', id: best.id, x: best.x, y: best.y, thorium: gain, owner: s.owner });
    }
    s.cooldown = ECON.harvesterInterval;
  }
};
