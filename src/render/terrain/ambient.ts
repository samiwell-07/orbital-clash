import * as THREE from 'three';
import { Bin } from './dispose';
import { hash2 } from './noise';
import type { Palette } from './palettes';

const VERT = /* glsl */ `
attribute float aPhase;
uniform float uTime;
uniform vec3 uBounds;
uniform float uScale;
varying float vA;
void main() {
  vec3 p = position + vec3(0.35, 0.05, 0.22) * uTime * (0.5 + aPhase);
  p.x = mod(p.x, uBounds.x);
  p.z = mod(p.z, uBounds.z);
  p.y = 0.25 + mod(p.y + 0.1 * sin(uTime * 0.7 + aPhase * 20.0), uBounds.y);
  vA = 0.25 + 0.5 * (0.5 + 0.5 * sin(uTime * (0.8 + aPhase) + aPhase * 30.0));
  gl_PointSize = (2.0 + 4.0 * aPhase) * uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d) * vA;
  gl_FragColor = vec4(uColor * a, a);
}`;

export interface Dust {
  points: THREE.Points;
  update(timeSec: number, bufferHeightPx: number): void;
}

/** Slowly drifting dust motes that wrap around the plateau (animated entirely on the GPU). */
export function buildDust(w: number, h: number, p: Palette, bin: Bin, count = 220): Dust {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([hash2(i, 1, 5) * w, hash2(i, 2, 5) * 2.4, hash2(i, 3, 5) * h], i * 3);
    phase[i] = hash2(i, 4, 5);
  }
  const geo = bin.add(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const uniforms = {
    uTime: { value: 0 },
    uBounds: { value: new THREE.Vector3(w, 2.4, h) },
    uScale: { value: 1 },
    uColor: { value: new THREE.Color(p.dust).multiplyScalar(0.9) },
  };
  const mat = bin.add(
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  const points = new THREE.Points(geo, mat);
  points.name = 'dust';
  points.frustumCulled = false;
  return {
    points,
    update(t, bufferHeightPx) {
      uniforms.uTime.value = t;
      uniforms.uScale.value = Math.max(0.6, bufferHeightPx / 1080);
    },
  };
}
