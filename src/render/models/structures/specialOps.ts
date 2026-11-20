import { TorusGeometry } from 'three';
import { assemble, box, cached, cyl, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { unitIconColor } from '@/render/instancing/colorTables';
import type { UnitKind } from '@/types';
import { clamp01 } from '../motion';
import { TOP, ViewBuilder } from './common';
import type { GlowRef, StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;
const SPECIALS: readonly UnitKind[] = ['hammer', 'switch', 'thief', 'carrier'];
const LIGHT_POS: readonly (readonly [number, number])[] = [[0.24, 0.1], [0.24, -0.1], [-0.24, 0.1], [-0.24, -0.1]];

export function buildSpecialOps(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0x4a4f5c, 0.75, 0.38);
  const darkMat = b.body(0x2a2d36, 0.8, 0.35);
  const ped = cached('specialOps:ped', () => assemble([
    { g: cyl(0.34, 0.39, 0.14, 8), p: [0, 0.07, 0], c: W },
    { g: box(0.3, 0.32, 0.3), p: [0, 0.3, 0], c: D },
    { g: cyl(0.22, 0.3, 0.05, 8), p: [0, 0.15, 0], c: D },
  ]));
  b.mesh(ped, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('specialOps:ring', () => new TorusGeometry(0.37, 0.02, 4, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);
  b.trim(cached('specialOps:stripe', () => box(0.32, 0.04, 0.32)), b.root, 0, TOP + 0.34, 0);

  const head = b.group(b.root, 0, TOP + 0.56, 0);
  const headGeo = cached('specialOps:head', () => {
    const specs: PartSpec[] = [
      { g: box(0.72, 0.2, 0.34), c: W },
      { g: box(0.12, 0.28, 0.38), p: [0.38, 0, 0], c: D },
      { g: box(0.12, 0.28, 0.38), p: [-0.38, 0, 0], c: D },
      { g: box(0.3, 0.08, 0.2), p: [0, 0.14, 0], c: D },
    ];
    return assemble(specs);
  });
  b.mesh(headGeo, darkMat, head);
  const lights: GlowRef[] = [];
  const lightGeo = cached('specialOps:light', () => sph(0.045, 6, 4));
  SPECIALS.forEach((k, i) => {
    const g = b.glow(unitIconColor(k), 2);
    lights.push(g);
    b.mesh(lightGeo, g.m, head, LIGHT_POS[i][0], 0.13, LIGHT_POS[i][1]);
  });

  return b.toView((s, a) => {
    const idle = Math.sin(a.t * 1.4 + s.id) * 0.015;
    const slam = clamp01(1 - s.cooldown * 3);
    head.position.y = TOP + 0.56 + idle - 0.06 * slam * slam;
    head.rotation.y = Math.sin(a.t * 0.5 + s.id) * 0.12;
    for (let i = 0; i < lights.length; i++) lights[i].base = SPECIALS[i] === s.output ? 5.5 : 1.3;
  });
}
