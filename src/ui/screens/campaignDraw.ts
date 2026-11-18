import type { CometId } from '../../types';
import { COLORS, drawText, glowText, rgba, type Ctx } from '../theme';
import { drawIcon } from '../widgets/icon';

export const COMET_COLORS: Record<CometId, { base: string; glow: string; dark: string }> = {
  kreios: { base: '#c97a4a', glow: '#ffb347', dark: '#4a2a1c' },
  hathor: { base: '#e0b860', glow: '#37e0c8', dark: '#5a4420' },
  aether: { base: '#bfdcff', glow: '#b5e6ff', dark: '#3a5a8a' },
  helios: { base: '#ff6a2a', glow: '#ff7a2e', dark: '#3a1208' },
};

/** Procedural comet: glowing sphere with craters and a tail. */
export function drawComet(ctx: Ctx, id: CometId, cx: number, cy: number, r: number, dim: boolean, now: number): void {
  const c = COMET_COLORS[id];
  ctx.save();
  if (dim) ctx.globalAlpha = 0.4;
  const tail = ctx.createLinearGradient(cx, cy, cx - r * 4, cy + r * 1.2);
  tail.addColorStop(0, rgba(c.glow, 0.45));
  tail.addColorStop(1, rgba(c.glow, 0));
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 0.8);
  ctx.lineTo(cx - r * 4, cy + r * 1.4);
  ctx.lineTo(cx, cy + r * 0.8);
  ctx.fill();
  ctx.shadowColor = c.glow;
  ctx.shadowBlur = r * 0.7;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, c.base);
  g.addColorStop(1, c.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba('#000000', 0.22);
  for (const [dx, dy, k] of [[-0.3, 0.2, 0.22], [0.35, -0.1, 0.16], [0.05, 0.5, 0.14], [-0.1, -0.45, 0.12]] as const) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy + dy * r, k * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = rgba(c.glow, 0.6 + 0.2 * Math.sin(now * 2));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export interface NodeView {
  x: number;
  y: number;
  label: string;
  locked: boolean;
  rank: string | null;
  selected: boolean;
  resurgence: boolean;
  accent: string;
}

/** Hexagonal area node; Resurgence nodes are red diamonds. Completed nodes show the best rank underneath. */
export function drawNode(ctx: Ctx, n: NodeView, now: number): void {
  const r = n.selected ? 40 : 32;
  const col = n.resurgence ? COLORS.danger : n.accent;
  ctx.save();
  ctx.beginPath();
  const sides = n.resurgence ? 4 : 6;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + (n.resurgence ? 0 : Math.PI / 6);
    ctx.lineTo(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = n.locked ? 'rgba(11,12,16,0.8)' : rgba(col, n.selected ? 0.38 : 0.2);
  ctx.shadowColor = col;
  ctx.shadowBlur = n.selected ? 20 + 6 * Math.sin(now * 6) : n.locked ? 0 : 8;
  ctx.fill();
  ctx.lineWidth = n.selected ? 4 : 2.5;
  ctx.strokeStyle = n.locked ? '#3a3f4d' : n.selected ? '#fff' : col;
  ctx.stroke();
  ctx.restore();
  if (n.locked) drawIcon(ctx, 'lock', n.x, n.y, 26, COLORS.lock);
  else glowText(ctx, n.label, n.x, n.y + 1, { size: n.selected ? 30 : 24, color: '#fff', glow: col, align: 'center', weight: 700 });
  if (n.rank) drawText(ctx, n.rank, n.x, n.y + r + 18, { size: 18, color: COLORS.thorium, align: 'center', weight: 700 });
}
