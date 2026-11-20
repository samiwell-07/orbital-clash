import { chamferPath, COLORS, paletteCss, playerColor, rgba, type Ctx } from '../theme';
import type { Rect } from '../layout';
import { drawDigits, digitsWidth } from './digits';

export interface GlyphOpts {
  /** Lobby seat number when it differs from the internal simulation slot. */
  number?: number;
  /** AI/enemy: draws a hexagonal flower sigil instead of the player number. */
  enemy?: boolean;
  /** PLAYER_COLORS index of the team frame (defaults to the player's own colour). */
  team?: number;
  alive?: boolean;
  flash?: number;
}

function sigil(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.5, r * 0.26, r * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a0608';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.lineTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Square glyph: the player number in the player's colour, framed in the team colour. */
export function drawPlayerGlyph(ctx: Ctx, r: Rect, player: number, o: GlyphOpts = {}): void {
  const col = playerColor(player);
  const frame = o.team === undefined ? col : paletteCss(o.team);
  chamferPath(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.save();
  ctx.fillStyle = o.enemy ? '#2a0608' : '#0a0d14';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = o.alive === false ? '#444b58' : frame;
  ctx.shadowColor = frame;
  ctx.shadowBlur = o.alive === false ? 0 : 8;
  ctx.stroke();
  ctx.restore();
  if (o.enemy) sigil(ctx, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.4, o.alive === false ? '#5a2a2e' : col);
  else {
    const h = r.h * 0.6;
    const txt = String(o.number ?? player + 1);
    drawDigits(ctx, txt, r.x + r.w / 2 - digitsWidth(txt, h) / 2, r.y + (r.h - h) / 2, h, {
      color: o.alive === false ? '#555b6b' : col, ghost: 0.12, glow: rgba(col, 0.8),
    });
  }
  if (o.flash && o.flash > 0) {
    chamferPath(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fillStyle = rgba(COLORS.danger, Math.min(1, o.flash) * 0.5);
    ctx.fill();
  }
}
