import { DoubleSide, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three';
import { assemble, box, cached, coneX, cyl, ico, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;
const GOLD = 0xffd23c;
const ICE = 0xbfe9ff;

export function buildHarvester(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xb2aa96, 0.6, 0.45);
  const base = cached('harvester:base', () => assemble([
    { g: cyl(0.3, 0.34, 0.12, 8), p: [0, 0.06, 0], c: W },
    { g: cyl(0.08, 0.12, 0.3, 6), p: [0, 0.27, 0], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('harvester:ring', () => new TorusGeometry(0.325, 0.018, 4, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);

  const dishMat = b.body(0xc9c0a8, 0.55, 0.4, false);
  dishMat.side = DoubleSide;
  const spin = b.group(b.root, 0, TOP + 0.42, 0);
  const tilt = b.group(spin, 0, 0, 0);
  tilt.rotation.x = 0.28;
  b.mesh(cached('harvester:dish', () => new SphereGeometry(0.42, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI).scale(1, 0.38, 1)), dishMat, tilt, 0, 0.04, 0);
  const rim = b.glow(GOLD, 2.2);
  b.mesh(cached('harvester:rim', () => new TorusGeometry(0.42, 0.02, 4, 16).rotateX(Math.PI / 2)), rim.m, tilt, 0, 0.16, 0);
  const core = b.glow(GOLD, 3.2);
  b.mesh(cached('harvester:core', () => sph(0.1, 8, 6)), core.m, tilt, 0, 0.05, 0);
  const claw = b.group(b.root, 0, TOP + 0.62, 0);
  const clawMat = b.body(0x8a8470, 0.7, 0.4);
  b.mesh(cached('harvester:claw', () => {
    const specs: PartSpec[] = [{ g: cyl(0.03, 0.03, 0.2, 5), p: [0, 0.05, 0], c: D }];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      specs.push({ g: coneX(0.035, 0.26, 4), p: [Math.cos(a) * 0.07, -0.05, Math.sin(a) * 0.07], c: W, r: [0, -a, -Math.PI / 2 - 0.35] });
    }
    return assemble(specs);
  }), clawMat, claw);

  return b.toView((s, a) => {
    spin.rotation.y = a.t * 0.5 + s.id;
    claw.rotation.y = -a.t * 1.6;
    core.base = 2.6 + 1.2 * Math.sin(a.t * 3 + s.id);
    rim.base = 1.8 + 0.6 * Math.sin(a.t * 2);
  });
}

export function buildResearchLab(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xaeb8c6, 0.6, 0.4);
  const base = cached('lab:base', () => assemble([
    { g: cyl(0.32, 0.36, 0.12, 8), p: [0, 0.06, 0], c: W },
    { g: box(0.08, 0.2, 0.08), p: [0.26, 0.2, 0.26], c: D },
    { g: box(0.08, 0.2, 0.08), p: [-0.26, 0.2, -0.26], c: D },
  ]));
  b.mesh(base, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('lab:ring', () => new TorusGeometry(0.345, 0.018, 4, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);
  const glass = b.own(new MeshStandardMaterial({
    color: 0x9fd4ff, emissive: ICE, emissiveIntensity: 0.35, transparent: true, opacity: 0.38,
    metalness: 0.2, roughness: 0.08, envMapIntensity: 1.6, depthWrite: false,
  }));
  const dome = b.mesh(cached('lab:dome', () => new SphereGeometry(0.28, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2)), glass, b.root, 0, TOP + 0.12, 0);
  dome.castShadow = false;
  const core = b.glow(ICE, 3.5);
  const coreMesh = b.mesh(cached('lab:core', () => ico(0.1, 0)), core.m, b.root, 0, TOP + 0.27, 0);
  const orbit = b.group(b.root, 0, TOP + 0.3, 0);
  orbit.rotation.z = 0.5;
  const ring = b.glow(ICE, 2.6);
  b.mesh(cached('lab:orbit', () => new TorusGeometry(0.34, 0.016, 4, 20).rotateX(Math.PI / 2)), ring.m, orbit);
  const sat = b.glow(0xffffff, 5);
  const satMesh = b.mesh(cached('lab:sat', () => sph(0.045, 6, 4)), sat.m, orbit);

  return b.toView((s, a) => {
    const ang = a.t * 1.6 + s.id;
    orbit.rotation.y = a.t * 0.4;
    satMesh.position.set(Math.cos(ang) * 0.34, 0, Math.sin(ang) * 0.34);
    coreMesh.rotation.y = a.t * 1.2;
    coreMesh.rotation.x = a.t * 0.7;
    core.base = 3 + 1.2 * Math.sin(a.t * 2.4 + s.id);
  });
}
