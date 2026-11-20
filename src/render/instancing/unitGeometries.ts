import type { BufferGeometry } from 'three';
import type { UnitKind } from '@/types';
import { assemble, box, coneX, cyl, cylX, ico, octa, slab, sph, W, D } from './kit';
import type { KindSpecs, PartSpec } from './kit';
import { specialSpecs } from './unitGeometriesSpecial';

export interface UnitModel { body: BufferGeometry; glow: BufferGeometry }

const PI = Math.PI;

/** Visual scale = UnitDef.radius * VIS[kind]; geometry spans roughly x in [-1,1]. */
export const VIS: Readonly<Record<UnitKind, number>> = {
  scout: 0.7, tank: 0.78, drone: 0.85, torpedo: 0.9, hammer: 0.9,
  switch: 0.85, thief: 0.8, carrier: 1.2, snake: 1.0, dragon: 0.95,
};

/** Team silhouette detail: blue smooth shards, red spikes, purple horns, orange fins (palette 4-7 reuse them in order). */
export function crest(colorIndex: number, y: number, k: number): PartSpec[] {
  const team = colorIndex % 4;
  const out: PartSpec[] = [];
  if (team === 0) {
    for (let i = 0; i < 3; i++) out.push({ g: octa(0.18 * k), p: [(0.3 - i * 0.4) * k, y, 0], s: [1.7, 0.8, 0.8], c: W, smooth: true });
  } else if (team === 1) {
    for (let i = 0; i < 5; i++) {
      const z = (i % 2 === 0 ? 0.16 : -0.16) * k;
      out.push({ g: coneX(0.07 * k, 0.55 * k, 3), p: [(0.4 - i * 0.22) * k, y, z], r: [0, 0, PI / 2 + 0.25], c: W });
    }
  } else if (team === 2) {
    for (const sg of [1, -1]) out.push({ g: coneX(0.09 * k, 0.65 * k, 5), p: [0.4 * k, y, 0.2 * k * sg], r: [0.55 * sg, 0, 0.75], c: W });
  } else {
    out.push({ g: slab([[-0.7, 0], [0.3, 0], [-0.2, -0.55]].map(([a, b]) => [a * k, b * k] as const), 0.04), p: [0, y, 0], r: [PI / 2, 0, 0], c: W });
    for (const sg of [1, -1]) out.push({ g: slab([[0.2, 0], [-0.5, 0.45 * sg], [-0.6, 0]].map(([a, b]) => [a * k, b * k] as const), 0.03), p: [0, y - 0.1 * k, 0], c: W });
  }
  return out;
}

const scout = (): KindSpecs => ({
  body: [
    { g: coneX(0.3, 1.6, 4), p: [0.2, 0.3, 0], r: [PI / 4, 0, 0], c: W },
    { g: octa(0.4), p: [-0.35, 0.3, 0], s: [1.3, 0.6, 0.85], c: W },
    { g: slab([[0.1, 0.1], [-1, 0.8], [-0.6, 0.1]]), p: [0, 0.28, 0], c: D },
    { g: slab([[0.1, -0.1], [-1, -0.8], [-0.6, -0.1]]), p: [0, 0.28, 0], c: D },
    { g: coneX(0.09, 0.7, 3), p: [-0.15, 0.62, 0], r: [0, 0, 1.2], c: D },
  ],
  glow: [
    { g: sph(0.11, 6, 4), p: [0.95, 0.3, 0] },
    { g: sph(0.14, 6, 4), p: [-0.85, 0.3, 0], s: [1.3, 0.8, 0.8] },
    { g: box(0.3, 0.05, 0.12), p: [0.15, 0.5, 0] },
  ],
  crestY: 0.56, crestScale: 0.7,
});

const tank = (): KindSpecs => ({
  body: [
    { g: box(1.7, 0.4, 1.1), p: [0, 0.3, 0], c: W },
    { g: box(1.9, 0.26, 0.28), p: [0, 0.2, 0.7], c: D },
    { g: box(1.9, 0.26, 0.28), p: [0, 0.2, -0.7], c: D },
    { g: coneX(0.55, 0.7, 4), p: [1.0, 0.28, 0], r: [PI / 4, 0, 0], s: [1, 0.55, 1], c: W },
    { g: cyl(0.4, 0.46, 0.28, 8), p: [-0.1, 0.64, 0], c: W },
    { g: cylX(0.07, 1.0, 6), p: [0.7, 0.66, 0], c: D },
    { g: box(0.3, 0.14, 1.2), p: [-0.8, 0.54, 0], c: D },
  ],
  glow: [
    { g: sph(0.1, 6, 4), p: [1.22, 0.66, 0] },
    { g: box(1.4, 0.04, 0.05), p: [0, 0.52, 0.56] },
    { g: box(1.4, 0.04, 0.05), p: [0, 0.52, -0.56] },
  ],
  crestY: 0.82, crestScale: 0.85,
});

const drone = (): KindSpecs => {
  const body: PartSpec[] = [{ g: octa(0.42), p: [0, 0, 0], s: [1.2, 0.7, 0.9], c: W }];
  const glow: PartSpec[] = [{ g: sph(0.16, 6, 4), p: [0, -0.18, 0] }];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
    body.push({ g: box(0.8, 0.06, 0.1), p: [sx * 0.45, 0.04, sz * 0.45], r: [0, sx * sz * 0.78, 0], c: D });
    body.push({ g: box(0.62, 0.03, 0.1), p: [sx * 0.78, 0.14, sz * 0.78], r: [0, sx * sz * 0.78 + 0.8, 0], c: W });
    body.push({ g: box(0.62, 0.03, 0.1), p: [sx * 0.78, 0.14, sz * 0.78], r: [0, sx * sz * 0.78 - 0.8, 0], c: W });
    glow.push({ g: sph(0.07, 5, 3), p: [sx * 0.78, 0.2, sz * 0.78] });
  }
  return { body, glow, crestY: 0.3, crestScale: 0.55 };
};

const torpedo = (): KindSpecs => {
  const body: PartSpec[] = [
    { g: cylX(0.3, 1.5, 8), p: [-0.1, 0.34, 0], c: W },
    { g: coneX(0.3, 0.55, 8), p: [0.95, 0.34, 0], c: D },
    { g: cylX(0.12, 0.3, 6), p: [-0.95, 0.34, 0], c: D },
    { g: ico(0.1, 0), p: [0.1, 0.66, 0], s: [1.6, 0.8, 0.8], c: D },
  ];
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2;
    body.push({ g: slab([[-0.5, 0], [-1.0, 0.55], [-0.95, 0]], 0.04), p: [0, 0.34, 0], r: [a, 0, 0], c: D });
  }
  return {
    body,
    glow: [
      { g: sph(0.16, 6, 4), p: [1.22, 0.34, 0] },
      { g: coneX(0.2, 0.55, 6), p: [-1.25, 0.34, 0], r: [0, 0, PI] },
      { g: cylX(0.31, 0.08, 8), p: [0.3, 0.34, 0] },
    ],
    crestY: 0.66, crestScale: 0.6,
  };
};

const BASIC: Partial<Record<UnitKind, () => KindSpecs>> = { scout, tank, drone, torpedo };
const cacheMap = new Map<string, UnitModel>();

export function getUnitModel(kind: UnitKind, team: number): UnitModel {
  const key = `${kind}:${team}`;
  let m = cacheMap.get(key);
  if (!m) {
    const ks = (BASIC[kind] ?? (() => specialSpecs(kind)))();
    const body = [...ks.body, ...(ks.crestScale > 0 ? crest(team, ks.crestY, ks.crestScale) : [])];
    m = { body: assemble(body), glow: assemble(ks.glow) };
    cacheMap.set(key, m);
  }
  return m;
}

export function disposeUnitModels(): void {
  for (const m of cacheMap.values()) { m.body.dispose(); m.glow.dispose(); }
  cacheMap.clear();
}
