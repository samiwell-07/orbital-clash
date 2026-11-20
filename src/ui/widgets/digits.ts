import type { Ctx } from '../theme';

/** Segment order: a top, b top-right, c bottom-right, d bottom, e bottom-left, f top-left, g middle. */
export type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

const DIGIT_SEGS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', '/': '',
};

/** Which segments light for a character (colon and punctuation draw separately). */
export function segmentsFor(ch: string): Seg[] {
  return (DIGIT_SEGS[ch] ?? '').split('') as Seg[];
}

const cellW = (h: number): number => h * 0.56;
const advance = (ch: string, h: number): number => (ch === ':' ? h * 0.3 : ch === '.' ? h * 0.22 : cellW(h) + h * 0.14);

export function digitsWidth(text: string, h: number): number {
  let w = 0;
  for (const ch of text) w += advance(ch, h);
  return Math.max(0, w - h * 0.14);
}

function bar(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, t: number): void {
  const horiz = y0 === y1;
  const h = t / 2;
  ctx.beginPath();
  if (horiz) {
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + h, y0 - h); ctx.lineTo(x1 - h, y0 - h);
    ctx.lineTo(x1, y0); ctx.lineTo(x1 - h, y0 + h); ctx.lineTo(x0 + h, y0 + h);
  } else {
    ctx.moveTo(x0, y0); ctx.lineTo(x0 + h, y0 + h); ctx.lineTo(x0 + h, y1 - h);
    ctx.lineTo(x0, y1); ctx.lineTo(x0 - h, y1 - h); ctx.lineTo(x0 - h, y0 + h);
  }
  ctx.closePath();
}

export interface DigitOpts {
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Alpha of the unlit "ghost" segments (0 hides them). */
  ghost?: number;
  outline?: string;
  glow?: string;
}

/** Procedural seven-segment font (no font files). (x, y) is the top-left/centre/right-top depending on align. */
export function drawDigits(ctx: Ctx, text: string, x: number, y: number, h: number, o: DigitOpts = {}): void {
  const w = digitsWidth(text, h);
  let px = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  const t = h * 0.17;
  const g = t * 0.1;
  const color = o.color ?? '#e9ecef';
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, h * 0.035);
  ctx.strokeStyle = o.outline ?? 'rgba(0,0,0,0.85)';
  for (const ch of text) {
    const cw = cellW(h);
    if (ch === ':' || ch === '.') {
      ctx.fillStyle = color;
      const dots = ch === ':' ? [0.3, 0.7] : [0.94];
      for (const f of dots) {
        ctx.beginPath();
        ctx.rect(px + (advance(ch, h) - h * 0.14) / 2 - h * 0.02, y + h * f - t / 2, t, t);
        ctx.fill();
        ctx.stroke();
      }
      px += advance(ch, h);
      continue;
    }
    const l = px + t / 2, r = px + cw - t / 2, tp = y + t / 2, bt = y + h - t / 2, md = y + h / 2;
    const geo: Record<Seg, () => void> = {
      a: () => bar(ctx, l + g, tp, r - g, tp, t),
      d: () => bar(ctx, l + g, bt, r - g, bt, t),
      g: () => bar(ctx, l + g, md, r - g, md, t),
      f: () => bar(ctx, l, tp + g, l, md - g, t),
      e: () => bar(ctx, l, md + g, l, bt - g, t),
      b: () => bar(ctx, r, tp + g, r, md - g, t),
      c: () => bar(ctx, r, md + g, r, bt - g, t),
    };
    const lit = new Set(segmentsFor(ch));
    for (const seg of Object.keys(geo) as Seg[]) {
      const on = lit.has(seg);
      if (!on && !(o.ghost ?? 0.07)) continue;
      geo[seg]();
      ctx.globalAlpha = on ? 1 : o.ghost ?? 0.07;
      ctx.fillStyle = color;
      if (on && o.glow) {
        ctx.shadowColor = o.glow;
        ctx.shadowBlur = h * 0.25;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      if (on) ctx.stroke();
      ctx.globalAlpha = 1;
    }
    px += advance(ch, h);
  }
  ctx.restore();
}
