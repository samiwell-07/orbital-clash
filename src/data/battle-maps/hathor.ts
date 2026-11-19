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

/** 44x30, four starts separated by tall mesas; a strip of sinkholes and rock clusters guard the centre. */
export function hathorMesa(): MapDef {
  const id = 'battle-hathor-mesa';
  const c = canvas(44, 30, 'mirror4');
  const bases = corners(44, 30, 6, 5);
  const rnd = rngFor(id);
  rim(c, 1, 4);
  box(c, 13, 3, 16, 9, '#');
  box(c, 3, 11, 9, 12, '#');
  line(c, 11, 14, 15, 14, 'o');
  for (const [x, y] of [[20, 9], [17, 12]]) box(c, x, y, x + 1, y + 1, '#');
  scatter(c, rnd, 5, { x0: 17, y0: 2, x1: 21, y1: 7 }, '#', 1);
  scatter(c, rnd, 3, { x0: 9, y0: 8, x1: 13, y1: 12 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Hathor Mesa', palette: 'hathor', thoriumLevel: 3, rockCount: 13, bases });
}

/** 48x24, two players: canyon walls split three long lanes, each wall broken by three staggered gaps. */
export function hathorCanyon(): MapDef {
  const id = 'battle-hathor-canyon';
  const c = canvas(48, 24, 'rot2');
  const bases = [{ tx: 5, ty: 12 }, { tx: 42, ty: 11 }];
  const rnd = rngFor(id);
  rim(c, 1, 4);
  box(c, 10, 6, 37, 7, '#');
  for (const x of [16, 23, 30]) box(c, x, 6, x + 1, 7, '.');
  box(c, 20, 10, 21, 11, '#');
  line(c, 13, 14, 15, 14, 'o');
  scatter(c, rnd, 6, { x0: 10, y0: 2, x1: 38, y1: 4 }, '#', 2);
  scatter(c, rnd, 3, { x0: 12, y0: 9, x1: 34, y1: 13 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Hathor Canyon', palette: 'hathor', thoriumLevel: 2, rockCount: 11, bases });
}
