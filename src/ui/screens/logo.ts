import { COLORS, font, rgba, type Ctx } from '../theme';

/** Orbital Clash logo, drawn procedurally: stacked wordmark, glowing orbit ring with a travelling satellite, comet streak. */
export function drawLogo(ctx: Ctx, cx: number, cy: number, k: number, now: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.save();
  ctx.rotate(-0.2);
  const rx = 400, ry = 92;
  ctx.lineWidth = 5;
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 24;
  const og = ctx.createLinearGradient(-rx, 0, rx, 0);
  og.addColorStop(0, rgba(COLORS.cyan, 0));
  og.addColorStop(0.35, rgba(COLORS.cyan, 0.9));
  og.addColorStop(1, rgba('#ffffff', 0.9));
  ctx.strokeStyle = og;
  ctx.beginPath();
  ctx.ellipse(0, 30, rx, ry, 0, Math.PI * 0.05, Math.PI * 1.95);
  ctx.stroke();
  const a = now * 0.8;
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(Math.cos(a) * rx, 30 + Math.sin(a) * ry, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.font = font(78, 500);
  ctx.letterSpacing = '30px';
  ctx.shadowColor = COLORS.cyan;
  ctx.shadowBlur = 28;
  ctx.fillStyle = COLORS.cyan;
  ctx.fillText('ORBITAL', 15, -78);
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba('#ffffff', 0.92);
  ctx.fillText('ORBITAL', 15, -78);

  ctx.font = font(168, 900);
  ctx.letterSpacing = '14px';
  const tg = ctx.createLinearGradient(0, -20, 0, 130);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.55, '#bff4ff');
  tg.addColorStop(1, '#2fb8e0');
  ctx.shadowColor = rgba(COLORS.cyan, 0.9);
  ctx.shadowBlur = 40;
  ctx.fillStyle = tg;
  ctx.fillText('CLASH', 7, 52);
  ctx.shadowBlur = 0;
  ctx.fillText('CLASH', 7, 52);

  ctx.letterSpacing = '0px';
  const streak = ctx.createLinearGradient(-380, -150, 330, -30);
  streak.addColorStop(0, 'rgba(255,170,60,0)');
  streak.addColorStop(1, 'rgba(255,230,160,0.95)');
  ctx.strokeStyle = streak;
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ffb347';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(-380, -150);
  ctx.lineTo(330, -40);
  ctx.stroke();
  ctx.restore();
}
