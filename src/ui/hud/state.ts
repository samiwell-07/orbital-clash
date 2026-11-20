import type { Player } from '../../types';
import { approach, clamp01, sumStored } from '../format';

/** Smoothed, animated values for one player's sidebar panel. */
export interface PanelState {
  hpFrac: number;
  ghost: number;
  thorium: number;
  thoriumTarget: number;
  popAt: number;
  flashAt: number;
  units: number;
}

export function newPanelState(p: Player): PanelState {
  const hp = p.maxHits > 0 ? clamp01(p.hits / p.maxHits) : 0;
  return { hpFrac: hp, ghost: hp, thorium: p.thorium, thoriumTarget: p.thorium, popAt: -9, flashAt: -9, units: sumStored(p.stored) };
}

/**
 * Advances the animation state: red ghost drains over 0.6 s after damage, thorium counts up in ~0.2 s with a
 * short scale pop, and a hit flash starts when hits drop.
 */
export function updatePanelState(st: PanelState, p: Player, dt: number, now: number): void {
  const hp = p.maxHits > 0 ? clamp01(p.hits / p.maxHits) : 0;
  if (hp < st.hpFrac - 1e-6) st.flashAt = now;
  st.hpFrac = hp;
  st.ghost = hp >= st.ghost ? hp : Math.max(hp, st.ghost - dt / 0.6);
  if (p.thorium !== st.thoriumTarget) {
    st.thoriumTarget = p.thorium;
    st.popAt = now;
  }
  st.thorium = approach(st.thorium, st.thoriumTarget, dt, 0.07);
  st.units = approach(st.units, sumStored(p.stored), dt, 0.1);
}

/** 1 -> 1.14 -> 1 scale pulse over 0.1 s after a change. */
export function popScale(st: PanelState, now: number): number {
  const t = (now - st.popAt) / 0.1;
  return t < 0 || t > 1 ? 1 : 1 + 0.14 * Math.sin(t * Math.PI);
}

export function slideOffset(now: number, startSec: number, index: number, dist: number): number {
  const t = clamp01((now - startSec - index * 0.06) / 0.3);
  return -dist * Math.pow(1 - t, 3);
}
