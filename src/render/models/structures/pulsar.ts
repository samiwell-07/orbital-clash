import { AdditiveBlending, Color, MeshBasicMaterial, RingGeometry, TorusGeometry } from 'three';
import { WEAPON_DEFS } from '@/data';
import { assemble, cached, cyl, octa, sph } from '@/render/instancing/kit';
import { clamp01 } from '../motion';
import { TOP, ViewBuilder } from './common';
import type { StructureView } from './common';

const W = 0xffffff;
const D = 0x4a4e58;
const VIOLET = 0xb890ff;

export function buildPulsar(team: number): StructureView {
  const b = new ViewBuilder(team);
  const bodyMat = b.body(0xa9b0be, 0.7, 0.4);
  const drum = cached('pulsar:drum', () => assemble([
    { g: cyl(0.3, 0.35, 0.22, 10), p: [0, 0.11, 0], c: W },
    { g: cyl(0.22, 0.26, 0.05, 10), p: [0, 0.245, 0], c: D },
    { g: cyl(0.06, 0.09, 0.2, 6), p: [0, 0.35, 0], c: D },
  ]));
  b.mesh(drum, bodyMat, b.root, 0, TOP, 0);
  b.trim(cached('pulsar:ring', () => new TorusGeometry(0.325, 0.018, 5, 10).rotateX(Math.PI / 2)), b.root, 0, TOP + 0.12, 0);

  const coilGlow = b.glow(VIOLET, 1.6);
  const coil = b.mesh(cached('pulsar:coil', () => new TorusGeometry(0.27, 0.05, 6, 14).rotateX(Math.PI / 2)), coilGlow.m, b.root, 0, TOP + 0.3, 0);
  const inner = b.group(b.root, 0, TOP + 0.42, 0);
  b.mesh(cached('pulsar:inner', () => new TorusGeometry(0.17, 0.03, 5, 12).rotateX(Math.PI / 2)), coilGlow.m, inner);
  const nodes = b.group(inner, 0, 0, 0);
  const nodeGeo = cached('pulsar:node', () => {
    const parts = [0, 1, 2, 3].map((i) => ({ g: octa(0.05), p: [Math.cos(i * 1.5708) * 0.17, 0, Math.sin(i * 1.5708) * 0.17] as const }));
    return assemble(parts);
  });
  b.mesh(nodeGeo, coilGlow.m, nodes);
  const orbGlow = b.glow(VIOLET, 2);
  const orb = b.mesh(cached('pulsar:orb', () => sph(0.1, 10, 7)), orbGlow.m, b.root, 0, TOP + 0.45, 0);

  const wave = b.own(new MeshBasicMaterial({
    color: new Color(VIOLET).multiplyScalar(2), transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false,
  }));
  const waveMesh = b.mesh(cached('pulsar:wave', () => new RingGeometry(0.9, 1, 24).rotateX(-Math.PI / 2)), wave, b.root, 0, TOP + 0.16, 0);
  waveMesh.castShadow = false;
  waveMesh.visible = false;

  return b.toView((s, a) => {
    const cd = WEAPON_DEFS.pulsar.cooldown[Math.min(s.level, 3)];
    const charge = clamp01(1 - s.cooldown / cd);
    const spin = a.t * (1.2 + 3.5 * charge);
    inner.rotation.y = spin;
    nodes.rotation.y = -spin * 1.6;
    coil.rotation.y = -a.t * 0.4;
    coilGlow.base = 1.2 + 1.2 * charge + 2.5 * a.shot;
    orbGlow.base = 1.6 + 2 * charge + 0.5 * Math.sin(a.t * 6 + s.id);
    orb.scale.setScalar(0.85 + 0.35 * charge + 0.4 * a.shot);
    waveMesh.visible = a.shot > 0.02;
    if (waveMesh.visible) {
      waveMesh.scale.setScalar(0.3 + (1 - a.shot) * 1.7);
      wave.opacity = a.shot * 0.9;
    }
  });
}
