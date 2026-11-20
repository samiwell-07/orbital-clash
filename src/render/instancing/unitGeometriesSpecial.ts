import type { UnitKind } from '@/types';
import { box, coneX, cyl, cylX, ico, octa, slab, sph, W, D } from './kit';
import type { KindSpecs, PartSpec } from './kit';

const PI = Math.PI;

const hammer = (): KindSpecs => ({
  body: [
    { g: box(1.5, 0.4, 1.3), p: [0, 0.25, 0], c: D },
    { g: box(0.9, 0.5, 0.9), p: [-0.25, 0.68, 0], c: W },
    { g: cylX(0.13, 1.1, 6), p: [0.35, 0.82, 0], c: D },
    { g: box(0.6, 0.85, 1.6), p: [0.98, 0.78, 0], c: W },
    { g: coneX(0.16, 0.55, 4), p: [1.5, 0.78, 0.5], c: D },
    { g: coneX(0.16, 0.55, 4), p: [1.5, 0.78, -0.5], c: D },
    { g: box(0.7, 0.14, 1.7), p: [0.98, 1.24, 0], c: D },
  ],
  glow: [
    { g: box(0.05, 0.12, 1.3), p: [1.3, 0.8, 0] },
    { g: sph(0.09, 6, 4), p: [-0.55, 0.95, 0.3] },
    { g: sph(0.09, 6, 4), p: [-0.55, 0.95, -0.3] },
  ],
  crestY: 0.95, crestScale: 0.9,
});

const sw = (): KindSpecs => ({
  body: [
    { g: octa(0.5), p: [0, 0.5, 0], s: [1.1, 1.1, 1], c: W },
    { g: coneX(0.12, 0.9, 4), p: [0.85, 0.35, 0.38], r: [0, -0.3, 0], c: D },
    { g: coneX(0.12, 0.9, 4), p: [0.85, 0.35, -0.38], r: [0, 0.3, 0], c: D },
    { g: cyl(0.35, 0.45, 0.15, 6), p: [0, 0.08, 0], c: D },
  ],
  glow: [
    { g: box(0.7, 0.04, 0.1), p: [0, 0.98, 0.3] },
    { g: box(0.78, 0.04, 0.1), p: [0, 0.98, 0], r: [0, 0.9, 0] },
    { g: box(0.7, 0.04, 0.1), p: [0, 0.98, -0.3] },
    { g: sph(0.14, 6, 4), p: [0, 0.5, 0] },
  ],
  crestY: 0.95, crestScale: 0.6,
});

const thief = (): KindSpecs => ({
  body: [
    { g: cyl(0.04, 0.45, 1.0, 5), p: [-0.1, 0.5, 0], c: W },
    { g: sph(0.3, 6, 4), p: [0.12, 0.98, 0], s: [1.1, 0.9, 0.9], c: D },
    { g: slab([[-0.2, 0.45], [-1.1, 0.25], [-0.9, 0], [-1.1, -0.25], [-0.2, -0.45]], 0.05), p: [0, 0.42, 0], r: [0, 0, -0.35], c: D },
    { g: coneX(0.07, 0.8, 3), p: [0.75, 0.38, 0.34], r: [0, 0, -0.4], c: D },
    { g: coneX(0.07, 0.8, 3), p: [0.75, 0.38, -0.34], r: [0, 0, -0.4], c: D },
  ],
  glow: [
    { g: sph(0.06, 4, 3), p: [0.38, 1.0, 0.12] },
    { g: sph(0.06, 4, 3), p: [0.38, 1.0, -0.12] },
    { g: octa(0.12), p: [-0.4, 0.62, 0] },
  ],
  crestY: 1.18, crestScale: 0.5,
});

const carrier = (): KindSpecs => {
  const lights: PartSpec[] = [];
  for (let i = -2; i <= 2; i++) lights.push({ g: box(0.12, 0.05, 0.08), p: [-0.1, 0.57, i * 0.11] });
  return {
    body: [
      { g: slab([[1, 0], [0.1, 0.75], [-0.9, 1], [-0.7, 0.3], [-0.8, 0], [-0.7, -0.3], [-0.9, -1], [0.1, -0.75]], 0.14), p: [0, 0.3, 0], c: W },
      { g: box(1.7, 0.28, 0.5), p: [0, 0.42, 0], c: D },
      { g: box(0.8, 0.18, 0.6), p: [-0.1, 0.5, 0], c: D },
      { g: cylX(0.16, 0.7, 6), p: [-0.7, 0.3, 0.6], c: D },
      { g: cylX(0.16, 0.7, 6), p: [-0.7, 0.3, -0.6], c: D },
      { g: coneX(0.18, 0.5, 4), p: [1.0, 0.4, 0], c: W },
    ],
    glow: [
      ...lights,
      { g: sph(0.13, 5, 3), p: [-1.08, 0.3, 0.6] },
      { g: sph(0.13, 5, 3), p: [-1.08, 0.3, -0.6] },
      { g: sph(0.09, 5, 3), p: [1.2, 0.4, 0] },
    ],
    crestY: 0.6, crestScale: 0,
  };
};

const snake = (): KindSpecs => {
  const body: PartSpec[] = [{ g: ico(0.5, 0), p: [0, 0.32, 0], s: [1.5, 0.65, 0.75], c: W }];
  const glow: PartSpec[] = [{ g: box(1.4, 0.05, 0.3), p: [0, 0.06, 0] }];
  for (let i = -1; i <= 1; i++) {
    body.push({ g: coneX(0.1, 0.45, 4), p: [i * 0.5, 0.66, 0], r: [0, 0, PI / 2 + i * 0.25], c: D });
    body.push({ g: box(0.34, 0.07, 1.0), p: [i * 0.5, 0.3, 0], r: [0, 0, i * 0.12], c: D });
    glow.push({ g: sph(0.1, 5, 3), p: [i * 0.5, 0.52, 0] });
  }
  body.push({ g: cylX(0.12, 0.6, 5), p: [-1.0, 0.3, 0], c: D });
  body.push({ g: coneX(0.12, 0.35, 4), p: [1.0, 0.3, 0.2], c: D });
  body.push({ g: coneX(0.12, 0.35, 4), p: [1.0, 0.3, -0.2], c: D });
  return { body, glow, crestY: 0.62, crestScale: 0.55 };
};

const dragon = (): KindSpecs => {
  const body: PartSpec[] = [
    { g: ico(0.4, 0), p: [-0.1, 0.1, 0], s: [1.7, 0.8, 0.8], c: W },
    { g: coneX(0.2, 0.8, 5), p: [0.8, 0.2, 0], r: [0, 0, 0.35], c: W },
    { g: octa(0.3), p: [1.25, 0.38, 0], s: [1.4, 0.7, 0.8], c: W },
    { g: coneX(0.2, 1.1, 5), p: [-1.15, 0, 0], r: [0, 0, PI - 0.15], c: D },
    { g: coneX(0.07, 0.55, 3), p: [1.05, 0.62, 0.15], r: [0, 0, 0.9], c: D },
    { g: coneX(0.07, 0.55, 3), p: [1.05, 0.62, -0.15], r: [0, 0, 0.9], c: D },
  ];
  const glow: PartSpec[] = [{ g: sph(0.1, 5, 3), p: [1.5, 0.32, 0] }];
  for (const sg of [1, -1]) {
    const wing = [[0.4, 0.2], [-0.1, 1.95], [-0.55, 1.5], [-0.95, 1.7], [-0.9, 0.2]] as const;
    body.push({ g: slab(wing.map(([x, z]) => [x, z * sg] as const), 0.035), p: [0, 0.18, 0], r: [-0.22 * sg, 0, 0], c: W });
    glow.push({ g: slab([[0.4, 0.2 * sg], [-0.1, 1.95 * sg], [0.0, 1.95 * sg], [0.5, 0.2 * sg]], 0.05), p: [0, 0.18, 0], r: [-0.22 * sg, 0, 0] });
    glow.push({ g: sph(0.06, 4, 3), p: [0.5, 0.45, 0.12 * sg] });
  }
  for (let i = 0; i < 4; i++) glow.push({ g: octa(0.07), p: [0.5 - i * 0.4, 0.5, 0] });
  return { body, glow, crestY: 0, crestScale: 0 };
};

const TABLE: Partial<Record<UnitKind, () => KindSpecs>> = { hammer, switch: sw, thief, carrier, snake, dragon };

export function specialSpecs(kind: UnitKind): KindSpecs {
  return (TABLE[kind] ?? snake)();
}
