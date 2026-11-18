import { chamferPath, COLORS, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';

export interface PanelStyle {
  chamfer?: number;
  fill?: string;
  alpha?: number;
  edge?: string;
  /** Outer glow colour (e.g. selected state). */
  glow?: string;
  lineWidth?: number;
}

/** Dark chamfered plate with a 2 px inner highlight, as in the sidebar references. */
export function drawPanel(ctx: Ctx, r: Rect, st: PanelStyle = {}): void {
  const c = st.chamfer ?? 10;
  ctx.save();
  if (st.glow) {
    ctx.shadowColor = st.glow;
    ctx.shadowBlur = 18;
  }
  chamferPath(ctx, r.x, r.y, r.w, r.h, c);
  ctx.fillStyle = rgba(st.fill ?? COLORS.panel, st.alpha ?? 0.85);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = st.lineWidth ?? 2;
  ctx.strokeStyle = st.edge ?? COLORS.panelEdge;
  chamferPath(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, Math.max(0, c - 1));
  ctx.stroke();
  ctx.restore();
}

export function drawBackdrop(ctx: Ctx, r: Rect, alpha = 0.6): void {
  ctx.save();
  ctx.fillStyle = `rgba(3,4,10,${alpha})`;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}
