import { AdditiveBlending, Color, MeshBasicMaterial, TorusGeometry } from 'three';
import { assemble, box, cached, coneX, cyl, octa, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { laserColor } from '@/render/instancing/colorTables';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';
import { maxLevelOf } from './marks';

const W = 0xffffff;
const D = 0x4a4e58;

export function buildLaser(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xaeb6c4, 0.7, 0.35);
  const ped = cached('laser:pedestal', () => {
    const specs: PartSpec[] = [
      { g: cyl(0.22, 0.3, 0.12, 8), p: [0, 0.06, 0], c: W },
      { g: cyl(0.1, 0.17, 0.2, 6), p: [0, 0.22, 0], c: D },
    ];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      specs.push({ g: box(0.05, 0.3, 0.13), p: [Math.cos(a) * 0.17, 0.3, Math.sin(a) * 0.17], c: W, r: [0, -a, 0.35] });
    }
    return assemble(specs);
  });
  b.mesh(ped, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('laser:ring', () => new TorusGeometry(0.28, 0.018, 5, 8).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);

  const emitter = b.group(b.root, 0, TOP + 0.58, 0);
  const crystal = b.glow(laserColor(0, 3), 4);
  const crystalMesh = b.mesh(cached('laser:crystal', () => octa(0.15).scale(0.8, 1.8, 0.8)), crystal.m, emitter);
  const lensGlow = b.glow(laserColor(0, 3), 2.6);
  const ring = b.mesh(cached('laser:lens', () => new TorusGeometry(0.2, 0.016, 5, 16).rotateX(Math.PI / 2)), lensGlow.m, emitter, 0, -0.08, 0);
  const lens = b.group(emitter, 0, 0, 0);
  b.mesh(cached('laser:prism', () => assemble([{ g: coneX(0.07, 0.3, 6), c: W }])), bodyMat, lens, 0.2, 0, 0);
  const halo = b.own(new MeshBasicMaterial({
    color: new Color(0xffffff), transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false,
  }));
  const haloMesh = b.mesh(cached('laser:halo', () => sph(0.2, 10, 8)), halo, emitter);
  haloMesh.castShadow = false;
  let lastLevel = -1;

  return b.toView((s, a) => {
    if (s.level !== lastLevel) {
      lastLevel = s.level;
      const c = laserColor(s.level, maxLevelOf('laser'));
      crystal.m.emissive.setHex(c);
      lensGlow.m.emissive.setHex(c);
      halo.color.setHex(c);
    }
    lens.rotation.y = -b.track(a, s, 7);
    crystalMesh.rotation.y = a.t * 1.4;
    ring.rotation.y = -a.t * 0.9;
    emitter.position.y = TOP + 0.58 + Math.sin(a.t * 2.2 + s.id) * 0.02;
    const pulse = 0.8 + 0.2 * Math.sin(a.t * 3.4 + s.id);
    crystal.base = (a.hasT ? 6 : 3.6) * pulse + 4 * a.shot;
    lensGlow.base = 2.2 + 2.5 * a.shot;
    halo.opacity = (0.07 + 0.05 * pulse + 0.25 * a.shot) * (a.hasT ? 1.4 : 1);
  });
}
