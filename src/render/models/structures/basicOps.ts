import { AdditiveBlending, Color, CylinderGeometry, MeshBasicMaterial, TorusGeometry } from 'three';
import { assemble, box, cached, cyl, octa } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { unitIconColor } from '@/render/instancing/colorTables';
import type { UnitKind } from '@/types';
import { clamp01 } from '../motion';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;

export function buildBasicOps(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xaab1be, 0.65, 0.4);
  const pad = cached('basicOps:pad', () => {
    const specs: PartSpec[] = [
      { g: cyl(0.38, 0.42, 0.1, 6), p: [0, 0.05, 0], c: W },
      { g: cyl(0.3, 0.3, 0.025, 6), p: [0, 0.105, 0], c: D },
      { g: cyl(0.16, 0.2, 0.08, 8), p: [0, 0.14, 0], c: D },
    ];
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 6 + (i * Math.PI * 2) / 3;
      specs.push({ g: box(0.07, 0.42, 0.07), p: [Math.cos(a) * 0.32, 0.26, Math.sin(a) * 0.32], c: D });
    }
    return assemble(specs);
  });
  b.mesh(pad, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('basicOps:ring', () => new TorusGeometry(0.4, 0.018, 4, 6).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.1, 0);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 6 + (i * Math.PI * 2) / 3;
    b.trim(cached('basicOps:tip', () => octa(0.045)), b.root, Math.cos(a) * 0.32, TOP + 0.5, Math.sin(a) * 0.32);
  }

  const tube = b.own(new MeshBasicMaterial({
    color: new Color(0x9fe8ff), transparent: true, opacity: 0.16, depthWrite: false, blending: AdditiveBlending,
  }));
  const tubeMesh = b.mesh(cached('basicOps:tube', () => new CylinderGeometry(0.14, 0.14, 0.62, 12, 1, true)), tube, b.root, 0, TOP + 0.47, 0);
  tubeMesh.castShadow = false;
  const beam = b.own(new MeshBasicMaterial({
    color: new Color(0xd8f6ff).multiplyScalar(2), transparent: true, opacity: 0.6, depthWrite: false, blending: AdditiveBlending,
  }));
  const beamMesh = b.mesh(cached('basicOps:beam', () => new CylinderGeometry(0.08, 0.08, 1, 8, 1, true)), beam, b.root, 0, TOP + 0.5, 0);
  beamMesh.castShadow = false;
  const band = b.glow(0xffffff, 3.2);
  b.mesh(cached('basicOps:band', () => new TorusGeometry(0.15, 0.03, 5, 14).rotateX(Math.PI / 2)), band.m, b.root, 0, TOP + 0.3, 0);
  const icon = b.glow(0xffffff, 3.6);
  const iconMesh = b.mesh(cached('basicOps:icon', () => octa(0.075)), icon.m, b.root, 0, TOP + 0.86, 0);
  let lastOut: UnitKind | null | undefined;

  return b.toView((s, a) => {
    if (s.output !== lastOut) {
      lastOut = s.output;
      const c = unitIconColor(s.output);
      band.m.emissive.setHex(c);
      icon.m.emissive.setHex(c);
      band.m.color.setHex(c).multiplyScalar(0.25);
      icon.m.color.setHex(c).multiplyScalar(0.25);
    }
    const ready = clamp01(1 - s.cooldown) ** 2;
    const pulse = 0.85 + 0.15 * Math.sin(a.t * 7 + s.id);
    beamMesh.scale.set(1 + 0.5 * ready, (0.5 + 0.35 * ready) * pulse, 1 + 0.5 * ready);
    beamMesh.position.y = TOP + 0.2 + beamMesh.scale.y * 0.5;
    beam.opacity = (0.4 + 0.5 * ready) * (s.output ? 1 : 0.4);
    tube.opacity = 0.2 + 0.15 * ready;
    iconMesh.rotation.y = a.t * 1.8;
    iconMesh.position.y = TOP + 0.86 + Math.sin(a.t * 2.4 + s.id) * 0.03;
    band.base = 2.6 + 2.2 * ready;
    icon.base = s.output ? 3.4 : 0.6;
  });
}
