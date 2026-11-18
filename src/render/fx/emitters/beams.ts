import type { Fx } from '../types';
import { emitHitSparks } from './sparks';
import { CYAN, mixHex, playerColor } from '../palette';

export const MAX_BEAMS = 48;
const HOLD = 0.24;
const FADE = 0.1;
const HIT_INTERVAL = 0.09;

/**
 * Keeps laser beams alive between 'beam' events so a locked target reads as one continuous,
 * flickering ribbon. Beams are matched by owner and emitter position; slots are fixed (no allocation).
 */
export class BeamTracker {
  private readonly owner = new Int8Array(MAX_BEAMS).fill(-1);
  private readonly ends = new Float32Array(MAX_BEAMS * 4);
  private readonly seen = new Float64Array(MAX_BEAMS);
  private readonly nextHit = new Float64Array(MAX_BEAMS);

  touch(owner: number, x: number, z: number, tx: number, tz: number, now: number): void {
    let free = -1;
    let slot = -1;
    for (let i = 0; i < MAX_BEAMS; i++) {
      if (this.owner[i] < 0 || now - this.seen[i] > HOLD + FADE) {
        if (free < 0) free = i;
        continue;
      }
      const dx = this.ends[i * 4] - x;
      const dz = this.ends[i * 4 + 1] - z;
      if (this.owner[i] === owner && dx * dx + dz * dz < 0.0025) { slot = i; break; }
    }
    if (slot < 0) {
      if (free < 0) return;
      slot = free;
      this.owner[slot] = owner;
      this.nextHit[slot] = 0;
    }
    const o = slot * 4;
    this.ends[o] = x; this.ends[o + 1] = z; this.ends[o + 2] = tx; this.ends[o + 3] = tz;
    this.seen[slot] = now;
  }

  /** Rewrites live quads for every active beam; emits hit sparks at the impact point. */
  update(fx: Fx): void {
    const live = fx.live;
    const now = fx.now;
    for (let i = 0; i < MAX_BEAMS; i++) {
      const age = now - this.seen[i];
      if (this.owner[i] < 0 || age > HOLD + FADE) {
        if (this.owner[i] >= 0) { live.clear(i); this.owner[i] = -1; }
        continue;
      }
      const fade = age <= HOLD ? 1 : 1 - (age - HOLD) / FADE;
      const flicker = 0.8 + 0.2 * Math.sin(now * 90 + i * 1.7) + 0.08 * Math.sin(now * 37 + i);
      const o = i * 4;
      const col = mixHex(CYAN, playerColor(this.owner[i]), 0.65);
      live.set(i, this.ends[o], 0.55, this.ends[o + 1], this.ends[o + 2], 0.3, this.ends[o + 3], 0.26 * flicker, col, fade * Math.min(1, flicker));
      if (age <= HOLD && now >= this.nextHit[i]) {
        this.nextHit[i] = now + HIT_INTERVAL;
        emitHitSparks(fx, this.ends[o + 2], this.ends[o + 3]);
      }
    }
  }

  reset(live: { clear(slot: number): void }): void {
    for (let i = 0; i < MAX_BEAMS; i++) {
      this.owner[i] = -1;
      live.clear(i);
    }
  }
}
