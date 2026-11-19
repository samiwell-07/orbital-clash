import type { ControlsDisplay } from '../../meta/settings';
import { COLORS, drawText, glowText, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawBackdrop } from '../widgets/panel';
import type { Command, UiNav } from '../screens/types';
import { drawControlsTable } from './controlsTable';
import { Form, buttonRows } from './form';
import { drawForm } from './formDraw';

const ITEMS = [
  { id: 'resume', label: 'Resume' },
  { id: 'restart', label: 'Restart' },
  { id: 'controls', label: 'Controls' },
  { id: 'quit', label: 'Quit to Title' },
];

/** Pause overlay: Resume / Restart / Controls / Quit to Title. Navigated with InputApi.nav(). */
export class PauseMenu {
  private form = new Form(buttonRows(ITEMS));
  private showControls = false;

  get controlsOpen(): boolean {
    return this.showControls;
  }

  reset(): void {
    this.form = new Form(buttonRows(ITEMS));
    this.showControls = false;
  }

  update(nav: UiNav, dt: number): Command | null {
    if (this.showControls) {
      if (nav.back || nav.confirm) this.showControls = false;
      return null;
    }
    const ev = this.form.handle(nav, dt);
    if (ev.back) return { t: 'resume' };
    switch (ev.activated) {
      case 'resume': return { t: 'resume' };
      case 'restart': return { t: 'restart' };
      case 'quit': return { t: 'quitToTitle' };
      case 'controls': this.showControls = true; return null;
      default: return null;
    }
  }

  draw(ctx: Ctx, full: Rect, s: number, now: number, prefer: ControlsDisplay, notice: string | null = null): void {
    drawBackdrop(ctx, full, 0.62);
    if (this.showControls) {
      const w = Math.min(full.w * 0.9, 1240 * s);
      const h = Math.min(full.h * 0.8, 720 * s);
      drawControlsTable(ctx, { x: full.x + (full.w - w) / 2, y: full.y + (full.h - h) / 2, w, h }, prefer);
      return;
    }
    const w = 380 * s;
    const cx = full.x + full.w / 2;
    glowText(ctx, 'PAUSED', cx, full.y + full.h * 0.28, { size: 56 * s, color: COLORS.text, glow: COLORS.cyan, align: 'center', spacing: 12 * s, weight: 700 });
    if (notice) drawText(ctx, notice, cx, full.y + full.h * 0.34, { size: 20 * s, color: COLORS.danger, align: 'center', weight: 700 });
    drawForm(ctx, this.form, { x: cx - w / 2, y: full.y + full.h * 0.38, w, h: 420 * s }, now, { rowH: 58 * s, gap: 12 * s });
    drawText(ctx, 'Menu / Start to resume', cx, full.y + full.h * 0.84, { size: 14 * s, color: COLORS.dim, align: 'center' });
  }
}
