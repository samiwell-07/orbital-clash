/** Shared visual helpers for the neon sci-fi look. */

export const FONT_FAMILY = '"Orbitron", "Segoe UI", system-ui, sans-serif';

/** CSS font string, e.g. font(14, 700). */
export function font(size: number, weight: number | string = 600): string {
  return `${weight} ${size}px ${FONT_FAMILY}`;
}

/** Runs `fn` with a canvas shadow glow, restoring the previous state. Use sparingly (shadowBlur is expensive). */
export function withGlow(ctx: CanvasRenderingContext2D, color: string, blur: number, fn: () => void): void {
  const prevColor = ctx.shadowColor;
  const prevBlur = ctx.shadowBlur;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.shadowColor = prevColor;
  ctx.shadowBlur = prevBlur;
}

/** Adds a rounded-rect sub-path (call beginPath() first if needed). */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Adds a rect sub-path with 45° cut corners (sci-fi frame). */
export function angledRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cut: number): void {
  const c = Math.max(0, Math.min(cut, w / 2, h / 2));
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/** Adds a regular polygon sub-path centered at (x, y). */
export function polygonPath(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sides: number, rot = 0): void {
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** '#rrggbb' + alpha -> 'rgba(...)'. Non-hex inputs are returned unchanged. */
export function rgba(hex: string, a: number): string {
  if (hex.length !== 7 || hex[0] !== '#') return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const GLOW_SPRITE_SIZE = 64;
const glowCache = new Map<string, HTMLCanvasElement>();

/** Cached soft radial glow sprite (any CSS color), 64x64. */
export function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = GLOW_SPRITE_SIZE;
  c.height = GLOW_SPRITE_SIZE;
  const g = c.getContext('2d');
  if (g) {
    const h = GLOW_SPRITE_SIZE / 2;
    const grad = g.createRadialGradient(h, h, 0, h, h, h);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, GLOW_SPRITE_SIZE, GLOW_SPRITE_SIZE);
  }
  glowCache.set(color, c);
  return c;
}

/** Draws a cached glow of `radius` px centered at (x, y). Caller chooses the composite mode. */
export function drawGlow(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, radius: number, alpha = 1): void {
  if (alpha <= 0 || radius <= 0) return;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * Math.min(1, alpha);
  ctx.drawImage(glowSprite(color), x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
}

/** Deterministic 0..1 hash of two integers (+ salt). */
export function hash2(a: number, b: number, salt = 0): number {
  let h = (a * 374761393 + b * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}
