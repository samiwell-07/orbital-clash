import type { MapDef, PaletteId } from '@/types';

/** From (x,y), run to successive absolute coordinates, alternating x, y, x, ... */
type Wall = readonly [x: number, y: number, toX: number, ...turns: number[]];

export interface MapSpec {
  id: string;
  name: string;
  size: number;
  palette: PaletteId;
  layout?: 'side';
  /** Each stroke has a matching stroke on the opposite approach. */
  ridges: readonly Wall[];
  trenches: readonly Wall[];
  thorium: 1 | 2 | 3;
  rocks: number;
}

export function makeMap(spec: MapSpec): MapDef {
  const { size, id, name, palette } = spec;
  const end = size - 1;
  const human = { tx: 5, ty: spec.layout === 'side' ? Math.floor(size / 2) : 5 };
  const enemy = { tx: end - human.tx, ty: end - human.ty };
  const partners = spec.layout === 'side'
    ? [{ tx: 5, ty: human.ty - 4 }, { tx: 5, ty: human.ty + 4 }]
    : [{ tx: 9, ty: 6 }, { tx: 6, ty: 9 }];
  const rows = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x): string =>
    Math.min(x, y, end - x, end - y) < 2 ? '#' : '.'));

  function draw([x, y, ...ends]: Wall, tile: string): void {
    function stamp() {
      if (Math.min(x, y, end - x, end - y) < 2) throw new Error(`${id}: wall outside plateau at ${x},${y}`);
      rows[y][x] = rows[end - y][end - x] = tile;
    }
    stamp();
    ends.forEach((to, i) => {
      while ((i % 2 ? y : x) !== to) {
        if (i % 2) y += Math.sign(to - y);
        else x += Math.sign(to - x);
        stamp();
      }
    });
  }
  for (const ridge of spec.ridges) draw(ridge, '#');
  for (const trench of spec.trenches) draw(trench, 'o');
  return {
    id, name, palette, w: size, h: size, rows: rows.map((r) => r.join('')),
    baseTiles: [human, enemy, ...partners], thoriumLevel: spec.thorium, rockCount: spec.rocks,
  };
}
