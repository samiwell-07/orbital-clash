import type { MapDef } from '@/types';
import { MAP_H, MAP_W } from '@/config/constants';
import { mulberry32 } from './rng';

type MapProvider = (id: string) => MapDef | null;
const providers: MapProvider[] = [];
const registered = new Map<string, MapDef>();

/** Data modules (battle maps, campaign areas) register authored maps so createWorld can find them by id. */
export function registerMap(map: MapDef): void {
  registered.set(map.id, map);
}

export function registerMapProvider(fn: MapProvider): void {
  providers.push(fn);
}

export function findMap(id: string): MapDef | null {
  const direct = registered.get(id);
  if (direct) return direct;
  for (const p of providers) {
    const m = p(id);
    if (m) return m;
  }
  return null;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h | 0;
}

/** Registered map for id, else a deterministic placeholder plateau. */
export function resolveMap(id: string): MapDef {
  return findMap(id) ?? generateDefaultMap(id);
}

/**
 * Fallback plateau: mirrored rock walls flank a clear central crossing and four open base pads.
 */
export function generateDefaultMap(id: string, w = MAP_W, h = MAP_H): MapDef {
  const g: string[][] = [];
  for (let y = 0; y < h; y++) g.push(new Array<string>(w).fill('.'));
  const rim = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const cornerCut = Math.min(x, w - 1 - x) + Math.min(y, h - 1 - y) < rim + 3;
      if (edge < rim || cornerCut) g[y][x] = '#';
    }
  }
  const bases = [
    { tx: 6, ty: 6 },
    { tx: w - 7, ty: h - 7 },
    { tx: w - 7, ty: 6 },
    { tx: 6, ty: h - 7 },
  ];
  const rnd = mulberry32(hashString(id));
  const set = (x: number, y: number, c: string) => {
    if (bases.some((b) => Math.abs(x - b.tx) <= 2 && Math.abs(y - b.ty) <= 2)) return;
    for (const [mx, my] of [[x, y], [w - 1 - x, y], [x, h - 1 - y], [w - 1 - x, h - 1 - y]]) {
      if (mx >= rim && my >= rim && mx < w - rim && my < h - rim) g[my][mx] = c;
    }
  };
  const cx = w / 2 - 2;
  const cy = h / 2 - 1;
  const bend = Math.floor(cy) - 2 - Math.floor(rnd() * 2);
  const tip = Math.floor(cx) - 1;
  for (let y = rim; y <= bend; y++) set(tip, y, '#');
  for (let x = tip - 2; x < tip; x++) set(x, bend, '#');
  for (let x = rim; x <= 6; x++) set(x, Math.floor(cy) - 1, '#');
  set(tip - 2, rim + 1, 'o');
  return {
    id,
    name: id,
    w,
    h,
    rows: g.map((r) => r.join('')),
    baseTiles: bases,
    thoriumLevel: 2,
    rockCount: 12,
    palette: 'kreios',
  };
}
