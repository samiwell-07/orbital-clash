import type { MapDef } from '@/types';
import { box, canvas, clearZone, corners, finish, line, ring, rim, rngFor, scatter } from './gen';

/** 40x26, wide open sand with scattered rock pillars and ripple lines, four starts. */
export function hathorDunes(): MapDef {
  const id = 'battle-hathor-dunes';
  const c = canvas(40, 26, 'mirror4');
  const bases = corners(40, 26, 5, 4);
  const rnd = rngFor(id);
  rim(c, 1, 4);
  for (const [x, y] of [[10, 6], [13, 10], [16, 4], [8, 11], [17, 8]]) box(c, x, y, x + 1, y + 1, '#');
  scatter(c, rnd, 6, { x0: 9, y0: 2, x1: 18, y1: 11 }, '#', 1);
  line(c, 3, 9, 7, 11, 'o');
  line(c, 19, 11, 20, 12, 'o');
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Hathor Dunes', palette: 'hathor', thoriumLevel: 3, rockCount: 14, bases });
}

/** 44x28, patch 1.03: sunken oasis (decorative crater pool) ringed by dunes; players choose their base tile. */
export function hathorOasis(): MapDef {
  const id = 'battle-hathor-oasis';
  const c = canvas(44, 28, 'mirror4');
  const rnd = rngFor(id);
  const bases = [null, null, null, null];
  rim(c, 1, 4);
  ring(c, 22, 14, 0, 3.6, 'o');
  ring(c, 22, 14, 5, 6.4, '#');
  box(c, 21, 7, 22, 9, '.');
  box(c, 15, 13, 17, 14, '.');
  scatter(c, rnd, 7, { x0: 4, y0: 3, x1: 15, y1: 12 }, '#', 2);
  scatter(c, rnd, 4, { x0: 4, y0: 3, x1: 15, y1: 12 }, 'o', 1);
  return finish(c, { id, name: 'Hathor Oasis', palette: 'hathor', thoriumLevel: 3, rockCount: 16, bases });
}
