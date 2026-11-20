import { ownerColor, paletteColor } from '../config/playerColors';

export type Ctx = CanvasRenderingContext2D;

export const COLORS = {
  panel: '#0b0c10',
  panelEdge: '#2b2f3a',
  plate: '#16181d',
  text: '#e9ecef',
  dim: '#8b93a7',
  hp: '#37e24a',
  hpTrack: '#0d3a14',
  thorium: '#ffd23c',
  units: '#27c6e8',
  unitsTrack: '#06303a',
  danger: '#ff4a4a',
  cyan: '#38e8ff',
  ok: '#66ff9a',
  lock: '#ffd23c',
  space0: '#05060f',
  space1: '#16102b',
} as const;

export const FONT_UI = "'Orbitron','Eurostile','Segoe UI',sans-serif";

export function hex(n: number): string {
  return '#' + (n & 0xffffff).toString(16).padStart(6, '0');
}

/** CSS colour of an owner (player id), following the lobby colour choice. */
export function playerColor(p: number): string {
  return hex(ownerColor(p));
}

/** CSS colour of a palette index (lobby swatches, team labels); not remapped by owner. */
export function paletteCss(index: number): string {
  return hex(paletteColor(index));
}

/** Accepts '#rrggbb'. */
export function rgba(color: string, a: number): string {
  const n = parseInt(color.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function font(px: number, weight: number | string = 600): string {
  return `${weight} ${Math.round(px)}px ${FONT_UI}`;
}

export type Align = 'left' | 'center' | 'right';

export interface TextOpts {
  size: number;
  color?: string;
  glow?: string;
  align?: Align;
  weight?: number | string;
  /** Letter spacing in px (ignored by browsers without ctx.letterSpacing). */
  spacing?: number;
  alpha?: number;
  baseline?: CanvasTextBaseline;
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts): void {
  ctx.save();
  ctx.font = font(o.size, o.weight ?? 600);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  ctx.globalAlpha *= o.alpha ?? 1;
  ctx.letterSpacing = `${o.spacing ?? 0}px`;
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = o.size * 0.6;
  }
  ctx.fillStyle = o.color ?? COLORS.text;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Text with a soft outer glow: two passes so the core stays crisp. */
export function glowText(ctx: Ctx, text: string, x: number, y: number, o: TextOpts & { glow: string }): void {
  drawText(ctx, text, x, y, { ...o, alpha: (o.alpha ?? 1) * 0.9 });
  drawText(ctx, text, x, y, { ...o, glow: undefined });
}

export function measure(ctx: Ctx, text: string, size: number, weight: number | string = 600, spacing = 0): number {
  ctx.save();
  ctx.font = font(size, weight);
  ctx.letterSpacing = `${spacing}px`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}

/** Rounded rectangle with chamfered (cut) corners, like the border frame in the references. */
export function chamferPath(ctx: Ctx, x: number, y: number, w: number, h: number, c: number): void {
  const k = Math.min(c, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.lineTo(x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.lineTo(x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.closePath();
}

export function wrapText(ctx: Ctx, text: string, maxW: number, size: number, weight: number | string = 500): string[] {
  ctx.save();
  ctx.font = font(size, weight);
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  ctx.restore();
  return out;
}
