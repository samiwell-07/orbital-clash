import type { MapDef } from '@/types';
import { box, canvas, clearZone, corners, finish, line, ring, rim, rngFor, scatter } from './gen';

/** 36x24, central rock ring with four gaps, four corner starts. */
export function kreiosCrater(): MapDef {
  const id = 'battle-kreios-crater';
  const c = canvas(36, 24, 'mirror4');
  const bases = corners(36, 24, 5, 4);
  const rnd = rngFor(id);
  rim(c, 1, 4);
  ring(c, 18, 12, 3.4, 5.2, '#');
  ring(c, 18, 12, 0, 1.8, 'o');
  box(c, 17, 4, 18, 8, '.');
  box(c, 12, 11, 16, 12, '.');
  scatter(c, rnd, 5, { x0: 8, y0: 3, x1: 14, y1: 9 }, '#', 2);
  scatter(c, rnd, 3, { x0: 9, y0: 2, x1: 15, y1: 8 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Kreios Crater', palette: 'kreios', thoriumLevel: 2, rockCount: 12, bases });
}

/** 40x26, patch 1.03: diagonal cliff ridges with notched passes, scarce Thorium. */
export function kreiosRidge(): MapDef {
  const id = 'battle-kreios-ridge';
  const c = canvas(40, 26, 'mirror4');
  const bases = corners(40, 26, 5, 4);
  const rnd = rngFor(id);
  rim(c, 1, 5);
  line(c, 10, 8, 17, 15, '#');
  line(c, 11, 8, 18, 15, '#');
  line(c, 13, 3, 13, 6, '#');
  box(c, 14, 10, 15, 11, '.');
  box(c, 19, 9, 20, 16, 'o');
  box(c, 19, 12, 20, 13, '.');
  scatter(c, rnd, 4, { x0: 6, y0: 8, x1: 10, y1: 12 }, '#', 2);
  scatter(c, rnd, 3, { x0: 20, y0: 2, x1: 28, y1: 5 }, '#', 2);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Kreios Ridge', palette: 'kreios', thoriumLevel: 1, rockCount: 9, bases });
}

/** 44x26, two players: a crater fissure splits the map diagonally, crossed at a high notch and the centre. */
export function kreiosFissure(): MapDef {
  const id = 'battle-kreios-fissure';
  const c = canvas(44, 26, 'rot2');
  const bases = [{ tx: 5, ty: 6 }, { tx: 38, ty: 19 }];
  const rnd = rngFor(id);
  rim(c, 1, 4);
  line(c, 14, 1, 21, 12, 'o');
  line(c, 15, 1, 22, 12, 'o');
  box(c, 16, 4, 19, 6, '.');
  box(c, 19, 11, 24, 14, '.');
  box(c, 8, 15, 11, 16, '#');
  line(c, 29, 3, 33, 3, '#');
  scatter(c, rnd, 5, { x0: 6, y0: 12, x1: 14, y1: 22 }, '#', 2);
  scatter(c, rnd, 3, { x0: 24, y0: 2, x1: 34, y1: 9 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Kreios Fissure', palette: 'kreios', thoriumLevel: 2, rockCount: 10, bases });
}

/** 40x28: a cliff cross walls off four crater-pocked basins joined around its arms; players choose their base tile. */
export function kreiosBasin(): MapDef {
  const id = 'battle-kreios-basin';
  const c = canvas(40, 28, 'mirror4');
  const bases = [null, null, null, null];
  const rnd = rngFor(id);
  rim(c, 1, 5);
  box(c, 18, 5, 19, 10, '#');
  box(c, 8, 13, 14, 13, '#');
  ring(c, 20, 14, 0, 2.2, 'o');
  ring(c, 10, 7, 0, 1.6, 'o');
  scatter(c, rnd, 6, { x0: 3, y0: 3, x1: 16, y1: 11 }, '#', 2);
  scatter(c, rnd, 2, { x0: 4, y0: 9, x1: 15, y1: 12 }, 'o', 1);
  return finish(c, { id, name: 'Kreios Basin', palette: 'kreios', thoriumLevel: 1, rockCount: 12, bases });
}
