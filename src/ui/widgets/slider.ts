import { COLORS, drawText, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { clamp01 } from '../format';
import { drawBar } from './bar';

export interface SliderOpts {
  selected?: boolean;
  accent?: string;
}

/** Label on the left, value on the right, track with a thumb below. frac is 0..1. */
export function drawSlider(ctx: Ctx, r: Rect, label: string, valueText: string, frac: number, o: SliderOpts = {}): void {
  const accent = o.accent ?? COLORS.cyan;
  const labelSize = r.h * 0.38;
  drawText(ctx, label, r.x, r.y + r.h * 0.3, { size: labelSize, color: o.selected ? '#fff' : COLORS.text });
  drawText(ctx, valueText, r.x + r.w, r.y + r.h * 0.3, { size: labelSize, color: accent, align: 'right' });
  const track = { x: r.x, y: r.y + r.h * 0.62, w: r.w, h: r.h * 0.22 };
  drawBar(ctx, track, frac, { fill: accent, track: rgba(accent, 0.14) });
  const tx = track.x + 2 + (track.w - 4) * clamp01(frac);
  ctx.save();
  ctx.fillStyle = o.selected ? '#ffffff' : COLORS.dim;
  ctx.shadowColor = accent;
  ctx.shadowBlur = o.selected ? 12 : 0;
  ctx.beginPath();
  ctx.arc(tx, track.y + track.h / 2, track.h * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
