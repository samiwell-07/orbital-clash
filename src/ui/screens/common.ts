import type { ControlsDisplay } from '../../meta/settings';
import { COLORS, drawText, glowText, rgba, type Ctx } from '../theme';

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry(20260);
const STARS = Array.from({ length: 220 }, () => ({ x: rand(), y: rand(), r: 0.4 + rand() * 1.5, p: rand() * 6.28, hue: rand() }));

/** Procedural space backdrop for menus: deep gradient, nebula glows, twinkling stars, faint hex lattice. */
export function drawSpace(ctx: Ctx, w: number, h: number, now: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, COLORS.space0);
  g.addColorStop(1, COLORS.space1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (const [x, y, r, c] of [[0.2, 0.3, 0.55, '#3a2a8a'], [0.85, 0.75, 0.5, '#0e5a7a'], [0.6, 0.1, 0.35, '#6a1a5a']] as const) {
    const rg = ctx.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * Math.max(w, h));
    rg.addColorStop(0, rgba(c, 0.28));
    rg.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }
  const k = Math.max(w, h) / 1920;
  for (const st of STARS) {
    ctx.globalAlpha = 0.45 + 0.45 * Math.sin(now * 1.3 + st.p);
    ctx.fillStyle = st.hue > 0.8 ? '#bfe9ff' : st.hue < 0.15 ? '#ffd9a8' : '#ffffff';
    ctx.beginPath();
    ctx.arc(st.x * w, st.y * h, st.r * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = COLORS.cyan;
  ctx.lineWidth = 1;
  const hs = 90 * k;
  for (let row = -1; row * hs * 0.866 < h; row++) {
    for (let col = -1; col * hs * 1.5 < w; col++) {
      const cx = col * hs * 1.5, cy = row * hs * 1.732 + (col % 2 ? hs * 0.866 : 0);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) ctx.lineTo(cx + Math.cos((i * Math.PI) / 3) * hs * 0.5, cy + Math.sin((i * Math.PI) / 3) * hs * 0.5);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function drawHeader(ctx: Ctx, w: number, title: string, subtitle?: string): void {
  glowText(ctx, title.toUpperCase(), 70, 78, { size: 46, color: '#fff', glow: COLORS.cyan, spacing: 8, weight: 700 });
  if (subtitle) drawText(ctx, subtitle, 72, 124, { size: 20, color: COLORS.dim, weight: 500 });
  const g = ctx.createLinearGradient(70, 0, w - 70, 0);
  g.addColorStop(0, COLORS.cyan);
  g.addColorStop(1, rgba(COLORS.cyan, 0));
  ctx.fillStyle = g;
  ctx.fillRect(70, 148, w - 140, 2);
}

export interface Hint {
  key: 'confirm' | 'back' | 'move' | 'adjust' | 'target';
  label: string;
}

const KEYS: Record<ControlsDisplay, Record<Hint['key'], string>> = {
  gamepad: { confirm: 'X', back: 'O', move: 'D-PAD', adjust: '◀ ▶', target: 'L1' },
  keyboard: { confirm: 'ENTER', back: 'BKSP', move: 'ARROWS', adjust: '◀ ▶', target: '[ ]' },
};

/** Bottom legend (X Select, O Back...) in the device the player prefers. */
export function drawFooter(ctx: Ctx, h: number, display: ControlsDisplay, hints: readonly Hint[]): void {
  let x = 70;
  const y = h - 46;
  for (const hint of hints) {
    const key = KEYS[display][hint.key];
    ctx.font = `700 15px sans-serif`;
    const kw = Math.max(34, ctx.measureText(key).width + 22);
    ctx.fillStyle = 'rgba(11,12,16,0.9)';
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y - 15, kw, 30, 8);
    ctx.fill();
    ctx.stroke();
    drawText(ctx, key, x + kw / 2, y + 1, { size: 15, color: COLORS.cyan, align: 'center', weight: 700 });
    drawText(ctx, hint.label, x + kw + 12, y + 1, { size: 17, color: COLORS.dim, weight: 500 });
    ctx.font = `500 17px sans-serif`;
    x += kw + 12 + ctx.measureText(hint.label).width + 34;
  }
}
