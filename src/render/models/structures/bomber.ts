import { TorusGeometry } from 'three';
import { assemble, box, cached, cyl, cylX, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;

export function buildBomber(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xb4a89a, 0.65, 0.45);
  const darkMat = b.body(0x6a6258, 0.7, 0.4);
  const base = cached('bomber:base', () => assemble([
    { g: cyl(0.3, 0.34, 0.14, 8), p: [0, 0.07, 0], c: W },
    { g: cyl(0.14, 0.2, 0.18, 8), p: [0, 0.22, 0], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('bomber:ring', () => new TorusGeometry(0.325, 0.018, 5, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.12, 0);

  const drum = cached('bomber:drum', () => assemble([
    { g: cyl(0.14, 0.14, 0.34, 10), r: [Math.PI / 2, 0, 0], c: D },
    { g: cyl(0.16, 0.16, 0.05, 10), p: [0, 0, 0.12], r: [Math.PI / 2, 0, 0], c: W },
    { g: cyl(0.16, 0.16, 0.05, 10), p: [0, 0, -0.12], r: [Math.PI / 2, 0, 0], c: W },
  ]));
  b.mesh(drum, darkMat, b.root, -0.17, TOP + 0.17, 0);
  const bands = b.glow(0xff8a2a, 2.4);
  b.mesh(cached('bomber:bands', () => assemble([
    { g: cyl(0.145, 0.145, 0.03, 10), p: [0, 0, 0.06], r: [Math.PI / 2, 0, 0], smooth: true },
    { g: cyl(0.145, 0.145, 0.03, 10), p: [0, 0, -0.06], r: [Math.PI / 2, 0, 0], smooth: true },
  ])), bands.m, b.root, -0.17, TOP + 0.17, 0);

  const pivot = b.group(b.root, 0.02, TOP + 0.32, 0);
  const elev = b.group(pivot, 0, 0, 0);
  elev.rotation.z = 0.95;
  const pod = cached('bomber:pod', () => {
    const specs: PartSpec[] = [
      { g: box(0.3, 0.2, 0.24), p: [0, 0, 0], c: D },
      { g: cyl(0.22, 0.12, 0.1, 10), p: [-0.12, 0, 0], r: [0, 0, Math.PI / 2], c: W },
    ];
    for (const y of [0.055, -0.055]) for (const z of [0.055, -0.055]) specs.push({ g: cylX(0.05, 0.5, 6), p: [0.3, y, z], c: W });
    return assemble(specs);
  });
  b.mesh(pod, bodyMat, elev);
  const shell = b.glow(0xff8a2a, 3);
  b.mesh(cached('bomber:tips', () => assemble([0.055, -0.055].flatMap((y) => [0.055, -0.055].map((z) => ({ g: sph(0.045, 6, 4), p: [0.55, y, z] as const }))))), shell.m, elev);

  return b.toView((s, a) => {
    pivot.rotation.y = -b.track(a, s, 5);
    const dist = Math.hypot(a.tx - b.root.position.x, a.tz - b.root.position.z);
    elev.rotation.z = a.hasT ? 0.7 + Math.min(0.5, dist * 0.07) : 1.05;
    elev.position.x = -0.07 * a.shot;
    shell.base = 2 + 5 * a.shot + (a.hasT ? 1.2 : 0);
    bands.base = 1.8 + 0.6 * Math.sin(a.t * 2 + s.id);
  });
}
