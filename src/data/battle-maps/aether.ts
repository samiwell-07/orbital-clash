import type { MapDef } from '@/types';
import { box, canvas, clearZone, finish, put, rim, rngFor, scatter } from './gen';

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
