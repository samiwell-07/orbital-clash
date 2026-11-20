import { chamferPath, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { clamp01 } from '../format';

export interface BarOpts {
  fill: string;
  track: string;
  /** Fraction behind the live value drawn in red (damage trail). */
  ghost?: number;
  /** 0..1 white flash overlay (hit feedback). */
  flash?: number;
  outline?: string;
}

/** Glossy gauge bar: dark outline, track, fill with a top highlight, optional damage ghost. */
export function drawBar(ctx: Ctx, r: Rect, frac: number, o: BarOpts): void {
  const c = Math.min(5, r.h / 3);
  const f = clamp01(frac);
  ctx.save();
  chamferPath(ctx, r.x, r.y, r.w, r.h, c);
  ctx.fillStyle = '#04080a';
  ctx.fill();
  const inner = { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 };
  chamferPath(ctx, inner.x, inner.y, inner.w, inner.h, Math.max(1, c - 2));
  ctx.clip();
  ctx.fillStyle = o.track;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  if (o.ghost !== undefined && o.ghost > f) {
    ctx.fillStyle = '#ff4a4a';
    ctx.fillRect(inner.x, inner.y, inner.w * clamp01(o.ghost), inner.h);
  }
  if (f > 0) {
    const g = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    g.addColorStop(0, rgba('#ffffff', 0.55));
    g.addColorStop(0.18, o.fill);
    g.addColorStop(1, rgba(o.fill, 0.72));
    ctx.fillStyle = g;
    ctx.fillRect(inner.x, inner.y, inner.w * f, inner.h);
  }
  if (o.flash && o.flash > 0) {
    ctx.fillStyle = rgba('#ffffff', clamp01(o.flash) * 0.55);
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  }
  ctx.restore();
  ctx.save();
  chamferPath(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, c);
  ctx.strokeStyle = o.outline ?? 'rgba(0,0,0,0.9)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

/** Bar colour from full (green) to empty (red) through yellow. */
export function hpColor(frac: number): string {
  const f = clamp01(frac);
  const hue = Math.round(f * 124);
  return `hsl(${hue},84%,${50 + (1 - f) * 4}%)`;
}
