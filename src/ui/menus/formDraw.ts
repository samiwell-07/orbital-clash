import { COLORS, drawText, measure, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { clamp01 } from '../format';
import { drawButton } from '../widgets/button';
import { drawPanel } from '../widgets/panel';
import { drawSlider } from '../widgets/slider';
import type { Form, Row } from './form';

export interface FormDrawOpts {
  rowH: number;
  gap?: number;
  accent?: string;
}

export function rowHeight(row: Row, h: number): number {
  return row.k === 'slider' ? h * 1.45 : row.k === 'label' ? h * 0.7 : h;
}

function visibleRange(form: Form, o: FormDrawOpts, avail: number): [number, number] {
  const gap = o.gap ?? 8;
  const n = form.rows.length;
  const h = (i: number): number => rowHeight(form.rows[i], o.rowH) + gap;
  let start = Math.min(form.index, n - 1), end = start + 1, used = h(start);
  for (;;) {
    const below = end < n && used + h(end) <= avail;
    const above = start > 0 && used + h(start - 1) <= avail;
    if (!below && !above) break;
    if (below && (!above || end - form.index - 1 <= form.index - start)) used += h(end++);
    else used += h(--start);
  }
  return [start, end];
}

/** Draws a Form top-down inside `r`; returns the total height used. */
export function drawForm(ctx: Ctx, form: Form, r: Rect, now: number, o: FormDrawOpts): number {
  const accent = o.accent ?? COLORS.cyan;
  const gap = o.gap ?? 8;
  const [start, end] = visibleRange(form, o, r.h);
  let y = r.y;
  for (let i = start; i < end; i++) {
    const row = form.rows[i];
    const h = rowHeight(row, o.rowH);
    const rr = { x: r.x, y, w: r.w, h };
    const sel = i === form.index;
    if (row.k === 'button') drawButton(ctx, rr, row.label, { selected: sel, enabled: row.enabled, nowSec: now, icon: row.icon, accent });
    else if (row.k === 'label') drawText(ctx, row.label.toUpperCase(), r.x + 6, y + h / 2, { size: h * 0.46, color: accent, spacing: 3, weight: 700 });
    else {
      drawPanel(ctx, rr, { chamfer: 10, edge: sel ? accent : COLORS.panelEdge, glow: sel ? rgba(accent, 0.4) : undefined, fill: sel ? '#0d2a33' : COLORS.panel, alpha: 0.85 });
      const pad = h * 0.3;
      if (row.k === 'slider') {
        const txt = row.fmt ? row.fmt(row.value) : String(row.value);
        drawSlider(ctx, { x: r.x + pad, y: y + h * 0.08, w: r.w - pad * 2, h: h * 0.86 }, row.label, txt, clamp01((row.value - row.min) / (row.max - row.min)), { selected: sel, accent });
      } else {
        const size = h * 0.4;
        drawText(ctx, row.label, r.x + pad, y + h / 2, { size, color: sel ? '#fff' : COLORS.text });
        const txt = row.options[row.index] ?? '';
        const vr = r.x + r.w - pad - size * 1.1;
        drawText(ctx, txt, vr, y + h / 2, { size, color: accent, align: 'right', weight: 700 });
        const ac = sel ? accent : COLORS.dim;
        drawText(ctx, '›', r.x + r.w - pad, y + h / 2, { size: size * 1.3, color: ac, align: 'right' });
        drawText(ctx, '‹', vr - measure(ctx, txt, size, 700) - size * 0.4, y + h / 2, { size: size * 1.3, color: ac, align: 'right' });
      }
    }
    y += h + gap;
  }
  return y - r.y;
}
