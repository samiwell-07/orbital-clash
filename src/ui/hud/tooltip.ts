import { COLORS, drawText, measure, playerColor, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { UNIT_DEFS } from '../../data';
import { drawBar, hpColor } from '../widgets/bar';
import { drawIcon } from '../widgets/icon';
import { drawPanel } from '../widgets/panel';
import type { StructureCard } from './card';

export function cardSize(card: StructureCard, s: number): { w: number; h: number } {
  const rows = 3 + (card.stats ? 1 : 0) + (card.output || card.nextOutput ? 1 : 0) + (card.locked ? 1 : 0);
  return { w: 290 * s, h: (58 + rows * 24) * s };
}

function cost(ctx: Ctx, label: string, value: number | null, cx: number, y: number, size: number, s: number): void {
  drawText(ctx, label, cx, y - size * 0.2, { size: size * 0.72, color: COLORS.dim, weight: 500, align: 'center' });
  const txt = value === null ? '—' : String(value);
  const vy = y + size * 1.15;
  drawText(ctx, txt, cx + (value === null ? 0 : 8 * s), vy, { size, color: value === null ? COLORS.dim : COLORS.thorium, align: 'center', weight: 700 });
  if (value !== null) {
    const w = measure(ctx, txt, size, 700);
    drawIcon(ctx, 'thorium', cx + 8 * s - w / 2 - 9 * s, vy, size * 0.95, COLORS.thorium);
  }
}

/** Context card shown while a ship hovers a structure: name, level pips, hp, costs, next output. */
export function drawStructureCard(ctx: Ctx, r: Rect, card: StructureCard, s: number): void {
  const col = playerColor(card.owner);
  drawPanel(ctx, r, { chamfer: 10 * s, edge: col, alpha: 0.92 });
  const px = r.x + 16 * s;
  const iw = r.w - 32 * s;
  const size = 14 * s;
  const lh = 24 * s;
  drawIcon(ctx, card.kind, px + 12 * s, r.y + 26 * s, 26 * s, col);
  drawText(ctx, card.name, px + 34 * s, r.y + 26 * s, { size: 17 * s, color: '#fff', weight: 700 });
  for (let i = 0; i < card.maxLevel; i++) {
    ctx.fillStyle = i < card.level ? COLORS.cyan : 'rgba(255,255,255,0.18)';
    ctx.fillRect(r.x + r.w - 16 * s - (card.maxLevel - i) * 11 * s, r.y + 19 * s, 8 * s, 14 * s);
  }
  let y = r.y + 54 * s;
  const frac = card.maxHp > 0 ? card.hp / card.maxHp : 0;
  drawBar(ctx, { x: px, y: y - 7 * s, w: iw * 0.62, h: 14 * s }, frac, { fill: hpColor(frac), track: COLORS.hpTrack });
  drawText(ctx, `${Math.ceil(card.hp)} / ${Math.ceil(card.maxHp)}`, px + iw, y, { size, color: COLORS.text, align: 'right', weight: 600 });
  y += lh;
  if (card.stats) {
    drawText(ctx, card.stats, px, y, { size: size * 0.9, color: COLORS.text, weight: 500 });
    y += lh;
  }
  if (card.output || card.nextOutput) {
    const cur = card.output ? UNIT_DEFS[card.output].name : '—';
    const nxt = card.nextOutput ? `  ›  ${UNIT_DEFS[card.nextOutput].name} next` : '';
    drawText(ctx, `Makes ${cur}${nxt}`, px, y, { size: size * 0.95, color: COLORS.units, weight: 600 });
    y += lh;
  }
  if (card.locked) {
    drawText(ctx, card.locked, px, y, { size, color: COLORS.lock, weight: 600 });
    y += lh;
  }
  const col3 = iw / 3;
  const own = card.recycle !== null;
  if (own) {
    cost(ctx, card.upgradeCost === null ? 'Max level' : 'Upgrade', card.upgradeCost, px + col3 * 0.5, y, size, s);
    cost(ctx, 'Recycle', card.recycle, px + col3 * 1.5, y, size, s);
    cost(ctx, 'Repair', card.repair, px + col3 * 2.5, y, size, s);
  } else drawText(ctx, 'Enemy structure', px, y, { size, color: COLORS.danger, weight: 600 });
}
