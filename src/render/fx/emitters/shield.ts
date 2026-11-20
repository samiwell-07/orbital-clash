import { count, type Fx } from '../types';
import { WHITE, mixHex } from '../palette';
import { emitRing } from './rings';

const TAU = Math.PI * 2;

/**
 * Base shield ripple: three staggered rings, a hex-ish dome of glints and a screen flash in the
 * victim colour. hitsLeftFrac (0..1) tints the dome toward white as the base gets weaker.
 */
export function emitShieldRipple(fx: Fx, x: number, z: number, color: number, hitsLeftFrac: number): void {
  const strong = mixHex(color, WHITE, 0.35 * (1 - hitsLeftFrac));
  for (let k = 0; k < 3; k++) emitRing(fx, x, 0.12, z, 0.8 + k * 0.2, 2.6 + k * 0.5, 0.55, k === 0 ? strong : color, 0.75 - k * 0.15, k * 0.08);
  const n = count(fx, 28);
  const R = 1.7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + fx.rnd() * 0.3;
    const el = 0.15 + fx.rnd() * 1.2;
    const cx = Math.cos(a) * Math.cos(el) * R;
    const cz = Math.sin(a) * Math.cos(el) * R;
    fx.glow.emit(fx.now + fx.rnd() * 0.12, x + cx, 0.3 + Math.sin(el) * R, z + cz, cx * 0.25, 0.2, cz * 0.25, 0.45 + fx.rnd() * 0.2,
      0.5, 0.3, strong, color, 0.55, 0);
  }
  fx.glow.emit(fx.now, x, 0.8, z, 0, 0, 0, 0.35, 3.6, 5.4, strong, color, 0.4, 0);
  fx.flash(color, 0.35);
  fx.shake(0.3);
}
