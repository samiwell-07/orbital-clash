import type { MapDef } from '@/types';
import { box, canvas, clearZone, corners, finish, line, rim, ring, rngFor, scatter } from './gen';

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

/** 46x30, four starts around a central magma lake inside a caldera wall breached on all four sides. */
export function heliosCaldera(): MapDef {
  const id = 'battle-helios-caldera';
  const c = canvas(46, 30, 'mirror4');
  const bases = corners(46, 30, 6, 5);
  const rnd = rngFor(id);
  rim(c, 1, 5);
  ring(c, 23, 15, 6.5, 7.6, '#');
  ring(c, 23, 15, 0, 4.2, 'o');
  box(c, 21, 6, 22, 9, '.');
  box(c, 14, 14, 17, 14, '.');
  box(c, 13, 4, 14, 8, '#');
  line(c, 7, 12, 11, 10, 'o');
  scatter(c, rnd, 5, { x0: 15, y0: 2, x1: 20, y1: 7 }, '#', 2);
  scatter(c, rnd, 3, { x0: 3, y0: 11, x1: 12, y1: 13 }, 'o', 1);
  clearZone(c, bases, 4);
  return finish(c, { id, name: 'Helios Caldera', palette: 'helios', thoriumLevel: 2, rockCount: 15, bases });
}

/** 42x28: diagonal vent fissures and a basalt core split the field; players choose their base tile. */
export function heliosVents(): MapDef {
  const id = 'battle-helios-vents';
  const c = canvas(42, 28, 'rot2');
  const bases = [null, null, null, null];
  const rnd = rngFor(id);
  rim(c, 1, 5);
  line(c, 6, 20, 16, 10, 'o');
  line(c, 7, 20, 17, 10, 'o');
  box(c, 10, 14, 13, 16, '.');
  line(c, 20, 2, 20, 8, 'o');
  box(c, 19, 12, 22, 15, '#');
  box(c, 28, 4, 31, 5, '#');
  scatter(c, rnd, 6, { x0: 2, y0: 2, x1: 17, y1: 9 }, '#', 2);
  scatter(c, rnd, 3, { x0: 24, y0: 9, x1: 36, y1: 13 }, 'o', 1);
  return finish(c, { id, name: 'Helios Vents', palette: 'helios', thoriumLevel: 3, rockCount: 14, bases });
}
