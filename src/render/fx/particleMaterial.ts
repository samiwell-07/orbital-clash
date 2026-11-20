import * as THREE from 'three';

const LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB 0xRRGGBB to linear floats, written to out[o..o+2]. */
export function hexToLinear(out: Float32Array, o: number, hex: number): void {
  out[o] = LINEAR[(hex >> 16) & 255];
  out[o + 1] = LINEAR[(hex >> 8) & 255];
  out[o + 2] = LINEAR[hex & 255];
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** CPU mirrors of the vertex-shader life curves (used by tests and by CPU-driven live effects). */
export function lifeT(age: number, life: number): number {
  return age / life;
}

export function lifeAlpha(t: number, peak: number, fadePow: number, fadeIn = 0.08): number {
  if (t < 0 || t >= 1) return 0;
  return peak * smoothstep(0, fadeIn, t) * Math.pow(1 - t, fadePow);
}

export function lifeSize(s0: number, s1: number, t: number): number {
  return s0 + (s1 - s0) * t;
}

/** Colour-over-life: blends c0 -> c1 by t, finishing at colorEnd (fraction of life). */
export function lifeColor(out: Float32Array, c0: ArrayLike<number>, c1: ArrayLike<number>, t: number, colorEnd: number): void {
  const k = smoothstep(0, colorEnd, t);
  out[0] = c0[0] + (c1[0] - c0[0]) * k;
  out[1] = c0[1] + (c1[1] - c0[1]) * k;
  out[2] = c0[2] + (c1[2] - c0[2]) * k;
}

const VERT = /* glsl */ `
attribute vec3 aV;
attribute vec4 aT;   // spawnTime, life, size0, size1
attribute vec4 aC0;  // rgb start, peak alpha
attribute vec4 aC1;  // rgb end, vertical acceleration
uniform float uTime;
uniform float uScale;
uniform float uDrag;
uniform float uFadePow;
uniform float uColorEnd;
uniform float uMaxSize;
varying vec4 vCol;
varying float vRot;
void main() {
  float age = uTime - aT.x;
  float t = age / aT.y;
  if (age < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vCol = vec4(0.0);
    vRot = 0.0;
    return;
  }
  float f = uDrag > 0.001 ? (1.0 - exp(-uDrag * age)) / uDrag : age;
  vec3 p = position + aV * f;
  p.y += 0.5 * aC1.w * age * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(mix(aT.z, aT.w, t) * uScale / max(-mv.z, 0.1), uMaxSize);
  float a = aC0.w * smoothstep(0.0, 0.08, t) * pow(1.0 - t, uFadePow);
  vCol = vec4(mix(aC0.rgb, aC1.rgb, smoothstep(0.0, uColorEnd, t)), a);
  vRot = fract(sin(dot(position.xz, vec2(12.9898, 78.233)) + aT.x * 3.1) * 43758.5453) * 6.2831;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uGain;
varying vec4 vCol;
varying float vRot;
void main() {
  if (vCol.a <= 0.002) discard;
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vRot);
  float co = cos(vRot);
  vec2 uv = vec2(co * c.x - s * c.y, s * c.x + co * c.y) + 0.5;
  float m = texture2D(uMap, uv).a;
  gl_FragColor = vec4(vCol.rgb * uGain, vCol.a * m);
  #include <colorspace_fragment>
}`;

export interface PointMaterialOptions {
  map: THREE.Texture;
  additive: boolean;
  drag: number;
  fadePow: number;
  colorEnd: number;
  gain: number;
  maxSize: number;
}

export function createPointMaterial(o: PointMaterialOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: o.map },
      uTime: { value: 0 },
      uScale: { value: 600 },
      uDrag: { value: o.drag },
      uFadePow: { value: o.fadePow },
      uColorEnd: { value: o.colorEnd },
      uGain: { value: o.gain },
      uMaxSize: { value: o.maxSize },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
  });
}
