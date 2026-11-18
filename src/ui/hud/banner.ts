import type { Objective } from '../../types';
import { COLORS, drawText, glowText, measure, rgba, wrapText, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawPanel } from '../widgets/panel';
import type { FeedMessage, MsgKind } from './messages';

const ACCENT: Record<MsgKind | 'hint', string> = {
  info: COLORS.cyan, hint: COLORS.cyan, tech: COLORS.thorium, warning: COLORS.danger, denied: '#ff9a4a', error: COLORS.danger,
};

/** Top-centre banner stack: floating messages plus the current tutorial hint. */
export function drawBanners(
  ctx: Ctx, r: Rect, s: number, now: number,
  items: readonly { msg: Pick<FeedMessage, 'kind' | 'text'>; alpha: number }[],
  hint: string | null,
): void {
  const list = hint ? [{ msg: { kind: 'hint' as const, text: hint }, alpha: 1 }, ...items] : items;
  let y = r.y;
  const h = r.h;
  for (const { msg, alpha } of list) {
    const accent = ACCENT[msg.kind];
    const pulse = msg.kind === 'warning' ? 0.6 + 0.4 * Math.sin(now * 10) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawPanel(ctx, { x: r.x, y, w: r.w, h }, { chamfer: 10 * s, edge: accent, glow: rgba(accent, 0.35 * pulse), alpha: 0.9 });
    ctx.fillStyle = accent;
    ctx.fillRect(r.x + 10 * s, y + h * 0.22, 4 * s, h * 0.56);
    const size = Math.min(19 * s, h * 0.46);
    const text = msg.kind === 'hint' ? `HINT  ${msg.text}` : msg.text;
    const fit = Math.min(1, (r.w - 50 * s) / Math.max(1, measure(ctx, text, size, 600)));
    const t = { size: size * fit, color: msg.kind === 'error' ? '#ffb0b0' : COLORS.text, align: 'center' as const, weight: 600 };
    if (msg.kind === 'warning' || msg.kind === 'tech') glowText(ctx, text, r.x + r.w / 2, y + h / 2, { ...t, glow: accent });
    else drawText(ctx, text, r.x + r.w / 2, y + h / 2, t);
    ctx.restore();
    y += h + 6 * s;
  }
}

/** Mission objectives list under the sidebar panels (campaign only). */
export function drawObjectives(ctx: Ctx, r: Rect, s: number, objectives: readonly Objective[]): void {
  if (!objectives.length || r.h < 60 * s) return;
  const size = 14 * s;
  const lines: { text: string; head: boolean }[] = [{ text: 'OBJECTIVES', head: true }];
  for (const o of objectives) for (const [i, l] of wrapText(ctx, o.text, r.w - 38 * s, size).entries()) lines.push({ text: i ? `   ${l}` : `◆ ${l}`, head: false });
  const lh = size * 1.45;
  const h = Math.min(r.h, lines.length * lh + 20 * s);
  drawPanel(ctx, { x: r.x, y: r.y, w: r.w, h }, { chamfer: 10 * s, alpha: 0.7 });
  lines.forEach((ln, i) => {
    const y = r.y + 14 * s + i * lh + lh / 2;
    if (y > r.y + h - 6 * s) return;
    drawText(ctx, ln.text, r.x + 14 * s, y, ln.head
      ? { size: size * 0.85, color: COLORS.cyan, spacing: 2 * s, weight: 700 }
      : { size, color: COLORS.text, weight: 500 });
  });
}

/** Wordmark used by the 4:3 layout (top-centre). */
export function drawWordmark(ctx: Ctx, r: Rect, s: number): void {
  glowText(ctx, 'ORBITAL CLASH', r.x + r.w / 2, r.y + r.h / 2, {
    size: 24 * s, color: COLORS.cyan, glow: COLORS.cyan, align: 'center', spacing: 8 * s, weight: 500,
  });
}
