import { ConeGeometry, TorusGeometry } from 'three';
import { assemble, box, cached, cyl, cylX, sph } from '@/render/instancing/kit';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;

export function buildTurret(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xb8bec8, 0.65, 0.4);
  const darkMat = b.body(0x6a707c, 0.7, 0.4);
  const housing = cached('turret:housing', () => assemble([
    { g: cyl(0.28, 0.32, 0.14, 8), p: [0, 0.07, 0], c: W },
    { g: cyl(0.2, 0.24, 0.06, 8), p: [0, 0.17, 0], c: D },
  ]));
  b.mesh(housing, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('turret:ring', () => new TorusGeometry(0.265, 0.018, 5, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.15, 0);

  const head = b.group(b.root, 0, TOP + 0.22, 0);
  const headGeo = cached('turret:head', () => assemble([
    { g: box(0.36, 0.14, 0.3), p: [-0.02, 0, 0], c: W },
    { g: sph(0.16, 8, 5), p: [-0.06, 0.07, 0], s: [1, 0.7, 1], c: D, smooth: true },
    { g: box(0.22, 0.1, 0.07), p: [0.02, -0.01, 0.17], c: D },
    { g: box(0.22, 0.1, 0.07), p: [0.02, -0.01, -0.17], c: D },
  ]));
  b.mesh(headGeo, bodyMat, head);
  b.trim(cached('turret:flag', () => new ConeGeometry(0.035, 0.14, 4)), head, -0.14, 0.2, 0);

  const barrels = b.group(head, 0.1, 0.01, 0);
  const barrelGeo = cached('turret:barrels', () => assemble([
    { g: cylX(0.035, 0.5, 6), p: [0.25, 0, 0.075], c: D },
    { g: cylX(0.035, 0.5, 6), p: [0.25, 0, -0.075], c: D },
    { g: cylX(0.05, 0.1, 6), p: [0.08, 0, 0.075], c: W },
    { g: cylX(0.05, 0.1, 6), p: [0.08, 0, -0.075], c: W },
  ]));
  b.mesh(barrelGeo, darkMat, barrels);
  const muzzle = b.glow(0xffd27a, 1.5);
  const tipGeo = cached('turret:tips', () => assemble([
    { g: sph(0.04, 6, 4), p: [0.52, 0, 0.075], smooth: true },
    { g: sph(0.04, 6, 4), p: [0.52, 0, -0.075], smooth: true },
  ]));
  b.mesh(tipGeo, muzzle.m, barrels);

  return b.toView((s, a) => {
    head.rotation.y = -b.track(a, s, 8);
    barrels.position.x = 0.1 - 0.08 * a.shot;
    barrels.scale.x = s.level >= 3 ? 1.35 : s.level >= 2 ? 1.18 : 1;
    muzzle.base = 1.3 + 5 * a.shot;
  });
}
