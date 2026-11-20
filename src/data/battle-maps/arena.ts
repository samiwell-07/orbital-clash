import type { MapDef } from '@/types';
import { canvas, corners, finish, put, rim, type Canvas, type Tile } from './gen';

type Point = readonly [number, number];
interface Arena {
  id: string;
  name: string;
  palette: MapDef['palette'];
  side: number;
  start: 'free' | 'corners' | Point;
  thorium: 1 | 2 | 3;
  rocks: number;
  /** Orthogonal polylines, mirrored for fair starts. Gaps are authored, not carved afterwards. */
  walls: readonly (readonly Point[])[];
  pits: readonly Point[];
}

function wall(c: Canvas, points: readonly Point[]): void {
  let [x, y] = points[0];
  put(c, x, y, '#');
  for (const [tx, ty] of points.slice(1)) {
    if (tx !== x && ty !== y) throw new Error('Rock walls require an orthogonal bend');
    while (tx !== x || ty !== y) {
      x += Math.sign(tx - x);
      y += Math.sign(ty - y);
      put(c, x, y, '#');
    }
  }
}

export function arena(a: Arena): MapDef {
  const c = canvas(a.side, a.side, typeof a.start === 'string' ? 'mirror4' : 'rot2');
  const bases: (Tile | null)[] = a.start === 'free' ? [null, null, null, null]
    : a.start === 'corners' ? corners(a.side, a.side, 4, 4)
    : [{ tx: a.start[0], ty: a.start[1] }, { tx: a.side - 1 - a.start[0], ty: a.side - 1 - a.start[1] }];
  rim(c, 1, 3);
  for (const path of a.walls) wall(c, path);
  for (const [x, y] of a.pits) put(c, x, y, 'o');
  return finish(c, { id: a.id, name: a.name, palette: a.palette, rockCount: a.rocks, thoriumLevel: a.thorium, bases });
}
