import { COLORS, type Ctx } from '../theme';
import type { PaletteId } from '../../types';

const FLOOR: Record<PaletteId, string> = {
  kreios: '#94796d', hathor: '#bc9859', aether: '#91adc9', helios: '#9e6550', gaia: '#70813d', kronos: '#7774a7',
};

function paintTerrain(g: Ctx, x: number, y: number, side: number, rows: readonly string[], palette: PaletteId): void {
  g.fillStyle = FLOOR[palette];
  g.fillRect(x, y, side, side);
  const k = side / rows.length;
  rows.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx++) {
      if (row[tx] === '.') continue;
      g.fillStyle = row[tx] === '#' ? '#14122b' : '#56455d';
      g.fillRect(x + tx * k, y + ty * k, k, k);
    }
  });
}

// Each immutable layout has one palette. Rasterize once instead of repainting every tile of every thumbnail per frame.
const previews = new WeakMap<readonly string[], HTMLCanvasElement>();

export function drawMapPreview(g: Ctx, x: number, y: number, side: number, rows: readonly string[], palette: PaletteId): void {
  g.save();
  let bitmap = previews.get(rows);
  if (!bitmap && typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = rows.length;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      paintTerrain(ctx, 0, 0, rows.length, rows, palette);
      previews.set(rows, canvas);
      bitmap = canvas;
    }
  }
  if (bitmap) {
    g.imageSmoothingEnabled = false;
    g.drawImage(bitmap, x, y, side, side);
  } else paintTerrain(g, x, y, side, rows, palette);
  g.strokeStyle = COLORS.panelEdge;
  g.lineWidth = 2;
  g.strokeRect(x, y, side, side);
  g.restore();
}
