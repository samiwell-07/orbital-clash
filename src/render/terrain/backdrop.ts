import * as THREE from 'three';
import { Bin } from './dispose';
import { hash2 } from './noise';
import type { Palette } from './palettes';

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aTint;
uniform float uTime;
uniform float uScale;
varying vec3 vColor;
void main() {
  vColor = aTint * (0.8 + 0.5 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0));
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale;
  gl_Position = projectionMatrix * mv;
}`;

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vColor * a, a);
}`;

const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uNebula;
uniform float uTime;
varying vec3 vDir;
float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float n3(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  vec3 d = normalize(vDir);
  float g = smoothstep(-0.9, 0.9, d.y);
  vec3 col = mix(uA, uB, g);
  vec3 q = d * 2.2 + vec3(uTime * 0.004, 0.0, 0.0);
  float n = n3(q) * 0.55 + n3(q * 2.1) * 0.3 + n3(q * 4.3) * 0.15;
  float cloud = smoothstep(0.5, 0.85, n);
  col += uNebula * cloud * 0.34;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface Backdrop {
  group: THREE.Group;
  update(timeSec: number, viewportHeightPx: number): void;
}

/** Starfield void around the plateau: gradient nebula dome plus twinkling star points. */
export function buildBackdrop(p: Palette, cx: number, cz: number, bin: Bin, starCount = 2600): Backdrop {
  const group = new THREE.Group();
  group.name = 'backdrop';
  group.position.set(cx, -4, cz);
  const nebulaUniforms = {
    uA: { value: new THREE.Color(p.space.a) },
    uB: { value: new THREE.Color(p.space.b) },
    uNebula: { value: new THREE.Color(p.space.nebula) },
    uTime: { value: 0 },
  };
  const dome = new THREE.Mesh(
    bin.add(new THREE.SphereGeometry(300, 32, 20)),
    bin.add(new THREE.ShaderMaterial({ uniforms: nebulaUniforms, vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG, side: THREE.BackSide, depthWrite: false, fog: false })),
  );
  dome.renderOrder = -20;
  dome.frustumCulled = false;
  group.add(dome);

  const pos = new Float32Array(starCount * 3);
  const size = new Float32Array(starCount);
  const phase = new Float32Array(starCount);
  const tint = new Float32Array(starCount * 3);
  const neb = new THREE.Color(p.space.nebula);
  for (let i = 0; i < starCount; i++) {
    const u = hash2(i, 1, 99) * 2 - 1;
    const a = hash2(i, 2, 99) * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 200 + 40 * hash2(i, 3, 99);
    pos.set([Math.cos(a) * s * r, u * r, Math.sin(a) * s * r], i * 3);
    const bright = hash2(i, 4, 99) ** 3;
    size[i] = 1.2 + bright * 3.2;
    phase[i] = hash2(i, 5, 99);
    const warm = hash2(i, 6, 99);
    const k = 0.35 + bright * 1.1;
    const c = new THREE.Color(1, 1, 1).lerp(warm < 0.3 ? new THREE.Color(0.7, 0.8, 1) : warm > 0.8 ? new THREE.Color(1, 0.85, 0.7) : neb, 0.35);
    tint.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  const geo = bin.add(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  const starUniforms = { uTime: { value: 0 }, uScale: { value: 1 } };
  const stars = new THREE.Points(
    geo,
    bin.add(new THREE.ShaderMaterial({ uniforms: starUniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  stars.renderOrder = -19;
  stars.frustumCulled = false;
  group.add(stars);

  return {
    group,
    update(t, viewportHeightPx) {
      nebulaUniforms.uTime.value = t;
      starUniforms.uTime.value = t;
      starUniforms.uScale.value = Math.max(0.6, viewportHeightPx / 1080);
    },
  };
}
