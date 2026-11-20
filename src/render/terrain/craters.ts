import * as THREE from 'three';
import type { Grid } from '@/types';
import { Bin } from './dispose';
import type { Palette } from './palettes';

const VERT = /* glsl */ `
attribute float aEdge;
varying float vEdge;
varying float vPhase;
void main() {
  vEdge = aEdge;
  vPhase = position.x * 0.7 + position.z * 1.3;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vEdge;
varying float vPhase;
void main() {
  // vEdge: +1 at the outer fade, -1 towards the pit centre, glow peaks near 0 (the lip).
  float k = vEdge < 0.0 ? 1.0 + vEdge * 1.4 : 1.0 - vEdge;
  float glow = pow(max(k, 0.0), 2.2);
  float pulse = 1.0 + 0.35 * sin(uTime * 1.8 + vPhase);
  gl_FragColor = vec4(uColor * (1.2 * pulse), glow * 0.85);
}`;

export interface CraterSet {
  group: THREE.Group;
  update(timeSec: number): void;
}

const isCrater = (g: Grid, tx: number, ty: number): boolean =>
  tx >= 0 && ty >= 0 && tx < g.w && ty < g.h && g.terrain[ty * g.w + tx] === 2;

/** Glowing lip along the outline of every crater region (the pit itself is sculpted into the floor mesh). */
export function buildCraterGlow(g: Grid, p: Palette, bin: Bin): CraterSet {
  const group = new THREE.Group();
  group.name = 'craters';
  const pos: number[] = [];
  const edge: number[] = [];
  const out = 0.2;
  const inn = 0.12;
  const quad = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number): void => {
    // a->b runs along the tile side; (nx, nz) points out of the crater.
    const pts: [number, number, number][] = [
      [ax + nx * out, az + nz * out, 1],
      [bx + nx * out, bz + nz * out, 1],
      [bx - nx * inn, bz - nz * inn, -1],
      [ax - nx * inn, az - nz * inn, -1],
    ];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      pos.push(pts[i][0], 0.1, pts[i][1]);
      edge.push(pts[i][2]);
    }
  };
  for (let ty = 0; ty < g.h; ty++) {
    for (let tx = 0; tx < g.w; tx++) {
      if (!isCrater(g, tx, ty)) continue;
      if (!isCrater(g, tx, ty - 1)) quad(tx, ty, tx + 1, ty, 0, -1);
      if (!isCrater(g, tx, ty + 1)) quad(tx, ty + 1, tx + 1, ty + 1, 0, 1);
      if (!isCrater(g, tx - 1, ty)) quad(tx, ty, tx, ty + 1, -1, 0);
      if (!isCrater(g, tx + 1, ty)) quad(tx + 1, ty, tx + 1, ty + 1, 1, 0);
    }
  }
  const uniforms = { uColor: { value: new THREE.Color(p.craterGlow) }, uTime: { value: 0 } };
  if (!pos.length) return { group, update: () => undefined };
  const geo = bin.add(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edge, 1));
  const mat = bin.add(
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  group.add(mesh);
  return {
    group,
    update(t) {
      uniforms.uTime.value = t;
    },
  };
}
