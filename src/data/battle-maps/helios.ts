import type { MapDef } from '@/types';
import { box, canvas, clearZone, corners, finish, line, rim, rngFor, scatter } from './gen';

/** 48x30, huge arena with a magma cross and rock-flanked chokepoints at the centre. */
export function heliosForge(): MapDef {
  const id = 'battle-helios-forge';
  const c = canvas(48, 30, 'mirror4');
  const bases = corners(48, 30, 6, 5);
  const rnd = rngFor(id);
  rim(c, 1, 5);
  box(c, 23, 9, 24, 14, 'o');
  box(c, 17, 14, 22, 15, 'o');
  box(c, 19, 10, 21, 11, '#');
  box(c, 23, 6, 24, 7, '#');
  box(c, 14, 13, 15, 16, '#');
  scatter(c, rnd, 6, { x0: 9, y0: 3, x1: 19, y1: 11 }, '#', 2);
  scatter(c, rnd, 3, { x0: 9, y0: 3, x1: 19, y1: 11 }, 'o', 1);
  clearZone(c, bases, 4);
  return finish(c, { id, name: 'Helios Forge', palette: 'helios', thoriumLevel: 2, rockCount: 14, bases });
}

/** 48x30, patch 1.03: lava rivers with narrow bridges; players choose their base tile. */
export function heliosFurnace(): MapDef {
  const id = 'battle-helios-furnace';
  const c = canvas(48, 30, 'mirror4');
  const bases = [null, null, null, null];
  const rnd = rngFor(id);
  rim(c, 1, 5);
  line(c, 12, 2, 12, 12, 'o');
  line(c, 13, 2, 13, 12, 'o');
  line(c, 12, 12, 22, 12, 'o');
  line(c, 12, 13, 22, 13, 'o');
  box(c, 12, 6, 13, 8, '.');
  box(c, 17, 12, 18, 13, '.');
  box(c, 23, 2, 24, 8, '#');
  scatter(c, rnd, 5, { x0: 2, y0: 14, x1: 10, y1: 27 }, '#', 2);
  scatter(c, rnd, 4, { x0: 25, y0: 3, x1: 40, y1: 8 }, '#', 2);
  return finish(c, { id, name: 'Helios Furnace', palette: 'helios', thoriumLevel: 3, rockCount: 15, bases });
}
