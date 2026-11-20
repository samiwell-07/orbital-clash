import type { Ctx } from '../theme';

/** Tiny vector DSL: coordinates in -1..1, y down. `d` draws a darker cut-out detail, `s` strokes instead of filling. */
export type Shape =
  | { k: 'p'; pts: readonly number[]; s?: boolean; d?: boolean }
  | { k: 'c'; x: number; y: number; r: number; s?: boolean; d?: boolean }
  | { k: 'l'; pts: readonly number[]; d?: boolean };

export const poly = (pts: readonly number[], o: { s?: boolean; d?: boolean } = {}): Shape => ({ k: 'p', pts, ...o });
export const circle = (x: number, y: number, r: number, o: { s?: boolean; d?: boolean } = {}): Shape => ({ k: 'c', x, y, r, ...o });
export const line = (pts: readonly number[], d = false): Shape => ({ k: 'l', pts, d });

export function ngon(n: number, r: number, rot = -Math.PI / 2, cx = 0, cy = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

export function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, steps = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** Annular wedge between radii r0..r1 from angle a0 to a1. */
export function wedge(a0: number, a1: number, r0: number, r1: number): number[] {
  const outer = arcPts(0, 0, r1, a0, a1, 6);
  const inner = arcPts(0, 0, r0, a1, a0, 6);
  return [...outer, ...inner];
}

export function rotate(pts: readonly number[], ang: number): number[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(pts[i] * c - pts[i + 1] * s, pts[i] * s + pts[i + 1] * c);
  return out;
}

export function rotateShapes(shapes: readonly Shape[], ang: number): Shape[] {
  return shapes.map((sh) => {
    if (sh.k === 'c') {
      const [x, y] = rotate([sh.x, sh.y], ang);
      return { ...sh, x, y };
    }
    return { ...sh, pts: rotate(sh.pts, ang) };
  });
}

function trace(ctx: Ctx, pts: readonly number[], close: boolean): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}

export function drawShapes(ctx: Ctx, shapes: readonly Shape[], cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 2, size / 2);
  ctx.lineWidth = 0.13;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const sh of shapes) {
    const paint = sh.d ? 'rgba(6,8,14,0.62)' : color;
    ctx.fillStyle = paint;
    ctx.strokeStyle = paint;
    if (sh.k === 'c') {
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.r, 0, Math.PI * 2);
      if (sh.s) ctx.stroke();
      else ctx.fill();
    } else if (sh.k === 'l') {
      trace(ctx, sh.pts, false);
      ctx.stroke();
    } else {
      trace(ctx, sh.pts, true);
      if (sh.s) ctx.stroke();
      else ctx.fill();
    }
  }
  ctx.restore();
}
