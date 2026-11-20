import { TorusGeometry } from 'three';
import { assemble, box, cached, cyl, cylX, coneX, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { beamMat } from '../materials';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;

export function buildMissileSilo(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xa7adb9, 0.65, 0.42);
  const base = cached('silo:base', () => assemble([
    { g: cyl(0.38, 0.42, 0.1, 6), p: [0, 0.05, 0], c: W },
    { g: cyl(0.3, 0.3, 0.03, 6), p: [0, 0.11, 0], c: 0x14161b },
    { g: box(0.06, 0.34, 0.06), p: [0.3, 0.27, 0.26], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('silo:ring', () => new TorusGeometry(0.4, 0.018, 4, 6).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);
  const doorGeo = cached('silo:door', () => assemble([{ g: box(0.3, 0.04, 0.56), p: [0.15, 0, 0], c: W }, { g: box(0.2, 0.05, 0.1), p: [0.15, 0.02, 0], c: D }]));
  const doorL = b.group(b.root, -0.3, TOP + 0.14, 0);
  const doorR = b.group(b.root, 0.3, TOP + 0.14, 0);
  doorR.rotation.y = Math.PI;
  b.mesh(doorGeo, bodyMat, doorL);
  b.mesh(doorGeo, bodyMat, doorR);

  const missile = b.group(b.root, 0, TOP + 0.04, 0);
  const missileBody = b.body(0xf2f4ff, 0.3, 0.35, false);
  b.mesh(cached('silo:missile', () => cyl(0.05, 0.05, 0.5, 8).translate(0, 0.25, 0)), missileBody, missile);
  const tip = b.glow(0xff3a2a, 2.2);
  b.mesh(cached('silo:tip', () => coneX(0.05, 0.16, 8).rotateZ(Math.PI / 2).translate(0, 0.58, 0)), tip.m, missile);
  const warn = b.glow(0xff8a2a, 4);
  b.mesh(cached('silo:warn', () => sph(0.04, 6, 4)), warn.m, b.root, 0.3, TOP + 0.46, 0.26);
  let open = 0;

  return b.toView((s, a) => {
    const want = s.targetId !== 0 ? 1 : 0.1 + (Math.sin(a.t * 2 + s.id) > 0.8 ? 0.05 : 0);
    open += Math.max(-1, Math.min(1, (want - open) * 6)) * a.dt * 2.5;
    doorL.rotation.z = -open * 1.25;
    doorR.rotation.z = -open * 1.25;
    missile.position.y = TOP + 0.04 + open * open * 0.12;
    missile.visible = open > 0.15;
    warn.base = Math.sin(a.t * (s.targetId ? 14 : 4) + s.id) > 0 ? 5 : 0.6;
    tip.base = 1.6 + open * 2;
  });
}

export function buildMissileDefense(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0x9ea6b4, 0.7, 0.4);
  const base = cached('mdef:base', () => assemble([
    { g: cyl(0.3, 0.35, 0.14, 8), p: [0, 0.07, 0], c: W },
    { g: cyl(0.12, 0.2, 0.22, 8), p: [0, 0.25, 0], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('mdef:ring', () => new TorusGeometry(0.325, 0.018, 4, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.12, 0);
  const head = b.group(b.root, 0, TOP + 0.4, 0);
  const headGeo = cached('mdef:head', () => {
    const specs: PartSpec[] = [{ g: box(0.3, 0.14, 0.34), p: [-0.02, 0, 0], c: W }];
    for (const z of [0.1, -0.1]) {
      specs.push({ g: cylX(0.045, 0.42, 6), p: [0.27, 0.01, z], c: D });
      specs.push({ g: cyl(0.075, 0.045, 0.1, 6), p: [0.5, 0.01, z], r: [0, 0, Math.PI / 2], c: W });
    }
    return assemble(specs);
  });
  b.mesh(headGeo, bodyMat, head);
  const eye = b.glow(0x6fd8ff, 3.5);
  b.mesh(cached('mdef:eye', () => sph(0.045, 6, 4)), eye.m, head, 0.14, 0.1, 0);
  const laser = b.own(beamMat(0x6fd8ff, 2.4, 0.8));
  const laserMesh = b.mesh(cached('mdef:laser', () => cylX(0.008, 1, 4)), laser, head, 0.5, 0.01, 0);
  laserMesh.castShadow = false;
  laserMesh.visible = false;

  return b.toView((s, a) => {
    head.rotation.y = -b.track(a, s, 9);
    laserMesh.visible = a.hasT;
    if (a.hasT) {
      const d = Math.min(8, Math.hypot(a.tx - b.root.position.x, a.tz - b.root.position.z)) - 0.5;
      laserMesh.scale.x = Math.max(0.1, d);
      laserMesh.position.x = 0.5 + laserMesh.scale.x / 2;
    }
    head.position.x = 0 - 0.05 * a.shot;
    eye.base = a.hasT ? 6 : 2.5 + Math.sin(a.t * 3 + s.id);
  });
}
