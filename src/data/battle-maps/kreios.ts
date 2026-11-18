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
