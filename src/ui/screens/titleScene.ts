import { drawText, type Ctx } from '../theme';
import { drawIcon } from '../widgets/icon';
import type { ScreenCtx } from './types';

function drawMoon(g: Ctx, x: number, y: number, r: number): void {
  g.save();
  g.translate(x, y);
  g.scale(r, r);
  g.rotate(-0.3);
  const ring = (start: number, end: number) => {
    g.beginPath();
    g.ellipse(0, 0, 1.65, 0.27, 0, start, end);
    g.stroke();
  };
  g.strokeStyle = '#ac96be80';
  g.lineWidth = 0.055;
  ring(Math.PI, 2 * Math.PI);
  const light = g.createRadialGradient(-0.55, -0.75, 0, 0.25, 0.3, 1.55);
  light.addColorStop(0, '#f2b29a');
  light.addColorStop(0.27, '#925d81');
  light.addColorStop(0.58, '#39304e');
  light.addColorStop(1, '#16172a');
  g.fillStyle = light;
  g.beginPath();
  g.arc(0, 0, 1, 0, Math.PI * 2);
  g.fill();
  ring(0, Math.PI);
  g.restore();
}

function outpost(g: Ctx, t: number): void {
  const rx = 115, ry = 50;
  const rim = (y: number) => {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      g.lineTo(rx * Math.cos(a), y + ry * Math.sin(a));
    }
    g.closePath();
  };
  rim(12);
  g.fillStyle = '#244454';
  g.fill();
  rim(0);
  g.fillStyle = '#122937';
  g.fill();
  g.strokeStyle = '#5da7b7';
  g.lineWidth = 1.5;
  g.stroke();
  drawIcon(g, 'harvester', -48, -9, 48, '#eab879');
  drawIcon(g, 'turret', 49, -10, 40, '#7ce0ed');
  // Two ranks of tanks patrol the landing pad.
  for (let i = 0; i < 6; i++) {
    g.save();
    g.translate(-34 + (i % 3) * 23 + Math.sin(t * 0.5) * 10, 9 + Math.floor(i / 3) * 13);
    g.rotate(Math.PI / 2);
    drawIcon(g, 'tank', 0, 0, 15, '#98c8da');
    g.restore();
  }
}

export function drawTitleScene(g: Ctx, w: number, h: number, t: number, ship: CanvasImageSource | null): void {
  const k = Math.min(w / 1920, h / 1080);
  drawMoon(g, w * 0.84, h * 0.23, 86 * k);

  g.save();
  g.translate(w * 0.19, h * 0.55);
  g.scale(k, k);
  g.rotate(-0.18);
  g.translate(Math.sin(t * 0.31) * 18, Math.cos(t * 0.48) * 10);
  for (const [x, y, size] of [[-90, -54, 100], [-113, 62, 120], [23, 0, 300]]) {
    const tail = g.createLinearGradient(x - size, y, x, y);
    tail.addColorStop(0, '#38dfff00');
    tail.addColorStop(0.72, '#38dfff66');
    tail.addColorStop(1, '#c6fbff');
    g.fillStyle = tail;
    g.beginPath();
    g.moveTo(x - size, y + 4);
    g.lineTo(x, y - size * 0.025);
    g.lineTo(x, y + size * 0.025);
    g.fill();
    if (ship) g.drawImage(ship, x - size / 2, y - size / 2, size, size);
    else {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 2);
      drawIcon(g, 'scout', 0, 0, size * 0.51, '#a3e6fb');
      g.restore();
    }
  }
  g.restore();

  g.save();
  g.translate(w * 0.81, h * 0.68);
  g.scale(k * 1.3, k * 1.3);
  outpost(g, t);
  const a = t * 0.4;
  drawIcon(g, 'drone', Math.cos(a) * 108, -40 + Math.sin(a) * 22, 24, '#8ce9ff');
  g.restore();

  for (const [x, y, label] of [[0.19, 0.7, '01  /  FLIGHT GROUP'], [0.81, 0.79, '02  /  SURFACE OPS']] as const) {
    drawText(g, label, w * x, h * y, { align: 'center', size: 15 * k, spacing: 3 * k, color: '#91baca' });
  }
}

// The preview canvas is shared with the lobby. Refresh its pose on title re-entry,
// not on every animation frame; flight motion itself is composited in 2D.
export function titleShip(getPreview: ScreenCtx['shipPreview']): CanvasImageSource | null {
  return getPreview?.(0, 0.55) ?? null;
}
