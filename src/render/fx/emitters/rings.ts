import { count, type Fx } from '../types';
import { CYAN, CYAN_DEEP, REPAIR_GREEN, THORIUM_GOLD, WHITE, mixHex, playerColor } from '../palette';

const TAU = Math.PI * 2;

/** Flat ground ring expanding from radius r0 to r1. */
export function emitRing(fx: Fx, x: number, y: number, z: number, r0: number, r1: number, life: number, color: number, alpha: number, delay = 0): void {
  fx.ring.emit(fx.now + delay, x, y, z, 0, 0, 0, life, r0, r1, color, alpha, 0);
}

/** Thorium credited: golden pulse at the base. */
export function emitThoriumPulse(fx: Fx, x: number, z: number): void {
  emitRing(fx, x, 0.1, z, 0.3, 1.6, 0.5, THORIUM_GOLD, 0.8);
  fx.glow.emit(fx.now, x, 0.5, z, 0, 0.3, 0, 0.45, 1.0, 1.9, WHITE, THORIUM_GOLD, 0.6, 0);
  const n = count(fx, 5);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    fx.glow.emit(fx.now, x + Math.cos(a) * 0.4, 0.2, z + Math.sin(a) * 0.4, 0, 1.0 + fx.rnd(), 0, 0.6, 0.12, 0.02, WHITE, THORIUM_GOLD, 0.9, 0);
  }
}

/** Units launched: whoosh ring, radial streak sparks and an upward glow at the base. */
export function emitLaunchWhoosh(fx: Fx, x: number, z: number, owner: number, units: number): void {
  const col = playerColor(owner);
  const k = Math.min(1.6, 0.8 + units * 0.01);
  emitRing(fx, x, 0.1, z, 0.4, 2.2 * k, 0.4, mixHex(col, WHITE, 0.3), 0.8);
  emitRing(fx, x, 0.1, z, 0.2, 1.4 * k, 0.3, col, 0.6, 0.06);
  fx.glow.emit(fx.now, x, 0.4, z, 0, 0.4, 0, 0.35, 1.2 * k, 0.4, WHITE, col, 0.8, 0);
  const n = count(fx, 14);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const sp = 2.5 + fx.rnd() * 3 * k;
    fx.spark.emit(fx.now, x, 0.2, z, Math.cos(a) * sp, 0.3, Math.sin(a) * sp, 0.3 + fx.rnd() * 0.25, 0.16, 0.02, WHITE, col, 0.9, 0);
  }
}

/** Spawn tower teleport: short cyan-white column with rising shimmer motes. */
export function emitTeleportColumn(fx: Fx, x: number, z: number): void {
  fx.beam.emit(fx.now, x, 0, z, x, 2.4, z, 0.22, 0.2, 0.05, mixHex(CYAN, WHITE, 0.4), 0.9, 0);
  fx.glow.emit(fx.now, x, 0.1, z, 0, 0, 0, 0.25, 0.7, 0.2, WHITE, CYAN_DEEP, 0.9, 0);
  emitRing(fx, x, 0.08, z, 0.15, 0.55, 0.22, CYAN, 0.8);
  const n = count(fx, 7);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const r = 0.05 + fx.rnd() * 0.15;
    fx.glow.emit(fx.now + fx.rnd() * 0.1, x + Math.cos(a) * r, 0.05, z + Math.sin(a) * r, 0, 3 + fx.rnd() * 3, 0, 0.35 + fx.rnd() * 0.2,
      0.08, 0.02, WHITE, CYAN_DEEP, 0.9, 0);
  }
}

/** Repair: green pulse ring with rising plus-sparks. */
export function emitRepairPulse(fx: Fx, x: number, z: number): void {
  emitRing(fx, x, 0.08, z, 0.2, 1.3, 0.55, REPAIR_GREEN, 0.8);
  emitRing(fx, x, 0.08, z, 0.1, 0.8, 0.45, WHITE, 0.4, 0.1);
  const n = count(fx, 8);
  for (let i = 0; i < n; i++) {
    const a = fx.rnd() * TAU;
    const r = 0.1 + fx.rnd() * 0.4;
    fx.glow.emit(fx.now + fx.rnd() * 0.2, x + Math.cos(a) * r, 0.1, z + Math.sin(a) * r, 0, 0.8 + fx.rnd(), 0, 0.7, 0.14, 0.03, WHITE, REPAIR_GREEN, 0.9, 0.2);
  }
}
