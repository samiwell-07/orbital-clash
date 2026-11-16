import type { MenuView, Rect, ViewState } from '../types';
import { CANVAS_H, CANVAS_W, COLORS, TEAM_COLORS } from '../core/config';
import { angledRectPath, font, withGlow } from './theme';

const ITEM_W = 340;
const ITEM_H = 44;
const ITEM_GAP = 12;
const LINE_H = 20;
const TITLE_BLOCK = 170;

interface MenuLayout {
  titleY: number;
  subtitleY: number;
  items: Rect[];
  lines: Rect | null;
}

function layoutMenu(menu: MenuView): MenuLayout {
  const itemsH = menu.items.length * ITEM_H + Math.max(0, menu.items.length - 1) * ITEM_GAP;
  const linesH = menu.lines.length > 0 ? menu.lines.length * LINE_H + 28 : 0;
  const total = TITLE_BLOCK + itemsH + (linesH > 0 ? 28 + linesH : 0);
  const top = Math.max(16, (CANVAS_H - total) / 2);
  const items: Rect[] = [];
  const ix = (CANVAS_W - ITEM_W) / 2;
  for (let i = 0; i < menu.items.length; i++) {
    items.push({ x: ix, y: top + TITLE_BLOCK + i * (ITEM_H + ITEM_GAP), w: ITEM_W, h: ITEM_H });
  }
  let lines: Rect | null = null;
  if (linesH > 0) {
    let maxLen = 0;
    for (const l of menu.lines) maxLen = Math.max(maxLen, l.length);
    const w = Math.min(CANVAS_W - 80, Math.max(ITEM_W + 120, maxLen * 8.6 + 60));
    lines = { x: (CANVAS_W - w) / 2, y: top + TITLE_BLOCK + itemsH + 28, w, h: linesH };
  }
  return { titleY: top + 70, subtitleY: top + 122, items, lines };
}

/** Clickable rects (canvas logical coords) for each item of the menu, same order as menu.items. */
export function getMenuItemRects(menu: MenuView): Rect[] {
  return layoutMenu(menu).items;
}

/** Draws the menu (title, items, info lines). The caller draws any backdrop. */
export function drawMenu(ctx: CanvasRenderingContext2D, menu: MenuView, view: ViewState): void {
  const L = layoutMenu(menu);
  const t = view.realTime;
  const cx = CANVAS_W / 2;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title.
  const titleSize = menu.title.length > 14 ? 56 : 72;
  ctx.font = font(titleSize, 900);
  const tw = ctx.measureText(menu.title).width;
  const grad = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  grad.addColorStop(0, TEAM_COLORS[0].main);
  grad.addColorStop(0.5, '#e6f1ff');
  grad.addColorStop(1, TEAM_COLORS[1].main);
  // Occasional flicker.
  const flick = Math.sin(t * 37) > 0.97 || Math.sin(t * 2.3 + 1) > 0.995 ? 0.55 : 1;
  ctx.globalAlpha = flick;
  withGlow(ctx, TEAM_COLORS[0].glow, 28, () => {
    ctx.fillStyle = grad;
    ctx.fillText(menu.title, cx, L.titleY);
  });
  withGlow(ctx, TEAM_COLORS[1].glow, 14, () => {
    ctx.fillStyle = grad;
    ctx.fillText(menu.title, cx, L.titleY);
  });
  ctx.globalAlpha = 1;
  // Scanlines over the title.
  const th = titleSize * 0.9;
  ctx.fillStyle = 'rgba(2,3,10,0.2)';
  for (let y = L.titleY - th / 2; y < L.titleY + th / 2; y += 4) ctx.fillRect(cx - tw / 2 - 10, y, tw + 20, 1);
  const sweep = ((t * 0.35) % 1) * th - th / 2;
  ctx.fillStyle = 'rgba(200,240,255,0.12)';
  ctx.fillRect(cx - tw / 2 - 10, L.titleY + sweep, tw + 20, 3);

  // Underline.
  const ul = ctx.createLinearGradient(cx - tw / 2, 0, cx + tw / 2, 0);
  ul.addColorStop(0, 'rgba(25,211,255,0)');
  ul.addColorStop(0.3, TEAM_COLORS[0].main);
  ul.addColorStop(0.7, TEAM_COLORS[1].main);
  ul.addColorStop(1, 'rgba(255,90,31,0)');
  ctx.fillStyle = ul;
  ctx.fillRect(cx - tw / 2, L.titleY + titleSize * 0.55, tw, 2);

  // Subtitle.
  if (menu.subtitle) {
    ctx.font = font(16, 600);
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(menu.subtitle.toUpperCase(), cx, L.subtitleY);
  }

  // Items.
  for (let i = 0; i < menu.items.length; i++) {
    const r = L.items[i]!;
    const sel = i === menu.selected;
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.beginPath();
    angledRectPath(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = sel ? `rgba(25,211,255,${0.16 + 0.08 * pulse})` : 'rgba(10,16,32,0.72)';
    ctx.fill();
    if (sel) {
      withGlow(ctx, TEAM_COLORS[0].main, 10 + 8 * pulse, () => {
        ctx.beginPath();
        angledRectPath(ctx, r.x, r.y, r.w, r.h, 12);
        ctx.strokeStyle = TEAM_COLORS[0].main;
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    } else {
      ctx.strokeStyle = 'rgba(140,180,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.font = font(sel ? 19 : 17, sel ? 800 : 600);
    ctx.fillStyle = sel ? '#ffffff' : COLORS.text;
    ctx.fillText(menu.items[i]!, cx, r.y + r.h / 2 + 1);
    if (sel) {
      const off = 4 * pulse;
      ctx.fillStyle = TEAM_COLORS[0].main;
      ctx.font = font(18, 800);
      ctx.fillText('>', r.x + 22 + off, r.y + r.h / 2 + 1);
      ctx.fillText('<', r.x + r.w - 22 - off, r.y + r.h / 2 + 1);
    }
  }

  // Info lines.
  if (L.lines) {
    const r = L.lines;
    ctx.beginPath();
    angledRectPath(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = 'rgba(6,10,22,0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,180,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = font(13, 500);
    ctx.textAlign = 'left';
    for (let i = 0; i < menu.lines.length; i++) {
      const line = menu.lines[i]!;
      const header = line.length > 0 && line === line.toUpperCase() && /[A-Z]/.test(line);
      ctx.fillStyle = header ? '#7fe8ff' : COLORS.text;
      ctx.fillText(line, r.x + 30, r.y + 14 + LINE_H / 2 + i * LINE_H);
    }
  }

  ctx.font = font(10, 500);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(125,138,166,0.8)';
  ctx.fillText(`↑↓ select · ENTER confirm${view.muted ? ' · SOUND OFF' : ''}`, cx, CANVAS_H - 16);
  ctx.restore();
}
