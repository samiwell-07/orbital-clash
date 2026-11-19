import { TorusGeometry } from 'three';
import { assemble, cached, cyl, slab, sph } from '@/render/instancing/kit';
import { TEAM_GLOW, paletteIndex } from '@/render/instancing/colorTables';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;
const VIOLET = 0xa06bff;

export function buildGateway(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0x9aa2b2, 0.7, 0.38);
  const base = cached('gate:base', () => assemble([
    { g: cyl(0.3, 0.36, 0.1, 8), p: [0, 0.05, 0], c: W },
    { g: cyl(0.2, 0.2, 0.03, 8), p: [0, 0.11, 0], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('gate:ring', () => new TorusGeometry(0.335, 0.018, 4, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);
  const ringGeo = cached('gate:arch', () => new TorusGeometry(0.3, 0.036, 6, 20));
  const archMat = b.body(0x9aa2b2, 0.7, 0.38, false);
  for (const z of [0.16, -0.16]) b.mesh(ringGeo, archMat, b.root, 0, TOP + 0.4, z);
  const swirl = b.glow(VIOLET, 3.4);
  const swirlGroup = b.group(b.root, 0, TOP + 0.4, 0);
  const arcs = cached('gate:swirl', () => assemble([0, 1, 2].map((i) => ({
    g: new TorusGeometry(0.15 + i * 0.045, 0.02, 4, 12, Math.PI * 1.2), r: [0, 0, (i * Math.PI * 2) / 3] as const, smooth: true,
  }))));
  b.mesh(arcs, swirl.m, swirlGroup);
  const spark = b.glow(0xffffff, 5);
  b.mesh(cached('gate:spark', () => sph(0.05, 6, 4)), spark.m, b.root, 0, TOP + 0.4, 0);

  return b.toView((s, a) => {
    swirlGroup.rotation.z = -a.t * 2.2 + s.id;
    swirl.base = 3 + 1.2 * Math.sin(a.t * 3.2 + s.id);
    spark.base = 4 + 2.5 * Math.sin(a.t * 9 + s.id);
  });
}

export function buildWaypoint(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0x9aa2b2, 0.7, 0.4);
  const base = cached('way:base', () => assemble([
    { g: cyl(0.26, 0.32, 0.08, 8), p: [0, 0.04, 0], c: W },
    { g: cyl(0.1, 0.1, 0.03, 8), p: [0, 0.095, 0], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  const mark = b.glow(TEAM_GLOW[paletteIndex(team)], 3.2);
  const chevron = b.group(b.root, 0, TOP + 0.4, 0);
  const vGeo = cached('way:chevron', () => assemble([0, 0.14].map((x) => ({
    g: slab([[0.3 - x, 0], [-0.1 - x, 0.3], [-0.1 - x, 0.15], [0.05 - x, 0], [-0.1 - x, -0.15], [-0.1 - x, -0.3]], 0.05),
    p: [x * 0.4, 0, 0] as const,
  }))));
  b.mesh(vGeo, mark.m, chevron);

  return b.toView((s, a) => {
    chevron.rotation.y = a.t * 1.1 + s.id;
    chevron.position.y = TOP + 0.4 + Math.sin(a.t * 2.4 + s.id) * 0.05;
    mark.base = 2.6 + 0.8 * Math.sin(a.t * 4 + s.id);
  });
}
