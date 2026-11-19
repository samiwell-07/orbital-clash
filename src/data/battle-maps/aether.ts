import type { MapDef } from '@/types';
import { box, canvas, clearZone, corners, finish, line, put, rim, ring, rngFor, scatter } from './gen';

/** 44x24, two players: long central corridor between two walled flanking lanes with windows. */
export function aetherDrift(): MapDef {
  const id = 'battle-aether-drift';
  const c = canvas(44, 24, 'mirror4');
  const bases = [{ tx: 4, ty: 11 }, { tx: 39, ty: 12 }];
  const rnd = rngFor(id);
  rim(c, 1, 4);
  box(c, 10, 8, 33, 9, '#');
  for (const x of [20, 21, 22, 23]) for (const y of [8, 9]) put(c, x, y, '.');
  box(c, 14, 6, 15, 6, '#');
  scatter(c, rnd, 3, { x0: 11, y0: 3, x1: 19, y1: 6 }, '#', 2);
  scatter(c, rnd, 3, { x0: 13, y0: 10, x1: 19, y1: 11 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Aether Drift', palette: 'aether', thoriumLevel: 1, rockCount: 8, bases });
}

/** 36x24, patch 1.03: crystal spires in a diamond lattice; players choose their base tile. */
export function aetherSpires(): MapDef {
  const id = 'battle-aether-spires';
  const c = canvas(36, 24, 'mirror4');
  const rnd = rngFor(id);
  const bases = [null, null, null, null];
  rim(c, 1, 5);
  for (const [x, y] of [[8, 5], [12, 8], [16, 5], [8, 11], [16, 11], [12, 2]]) box(c, x, y, x + 1, y + 1, '#');
  for (const [x, y] of [[17, 9], [14, 12]]) put(c, x, y, 'o');
  scatter(c, rnd, 4, { x0: 3, y0: 3, x1: 14, y1: 10 }, '#', 1);
  return finish(c, { id, name: 'Aether Spires', palette: 'aether', thoriumLevel: 2, rockCount: 11, bases });
}

/** 40x30, four starts: crystal shards fan out toward a hollow diamond prism opened top and bottom. */
export function aetherPrism(): MapDef {
  const id = 'battle-aether-prism';
  const c = canvas(40, 30, 'mirror4');
  const bases = corners(40, 30, 5, 5);
  const rnd = rngFor(id);
  rim(c, 1, 5);
  line(c, 15, 14, 19, 10, '#');
  box(c, 19, 10, 19, 11, '.');
  ring(c, 20, 15, 0, 1.6, 'o');
  line(c, 10, 9, 14, 4, '#');
  line(c, 11, 9, 15, 4, '#');
  for (const [x, y] of [[4, 12], [9, 13]]) box(c, x, y, x + 1, y, '#');
  scatter(c, rnd, 3, { x0: 15, y0: 2, x1: 19, y1: 7 }, '#', 1);
  scatter(c, rnd, 2, { x0: 7, y0: 10, x1: 13, y1: 12 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Aether Prism', palette: 'aether', thoriumLevel: 1, rockCount: 9, bases });
}

/** 38x26, two players: two concentric crystal halos around a sunken core; inner ring open east and west, outer ring breached on all sides. */
export function aetherHalo(): MapDef {
  const id = 'battle-aether-halo';
  const c = canvas(38, 26, 'rot2');
  const bases = [{ tx: 4, ty: 5 }, { tx: 33, ty: 20 }];
  const rnd = rngFor(id);
  rim(c, 1, 4);
  ring(c, 19, 13, 9.5, 10.4, '#');
  ring(c, 19, 13, 5.5, 6.6, '#');
  ring(c, 19, 13, 0, 2, 'o');
  box(c, 11, 11, 14, 14, '.');
  box(c, 16, 1, 21, 4, '.');
  box(c, 7, 9, 10, 12, '.');
  box(c, 12, 3, 13, 4, '#');
  scatter(c, rnd, 4, { x0: 2, y0: 12, x1: 7, y1: 22 }, '#', 2);
  scatter(c, rnd, 2, { x0: 22, y0: 2, x1: 30, y1: 6 }, 'o', 1);
  clearZone(c, bases, 3);
  return finish(c, { id, name: 'Aether Halo', palette: 'aether', thoriumLevel: 2, rockCount: 10, bases });
}
