import * as THREE from 'three';

export type QuadMode = 'beam' | 'tracer' | 'ring';

const VERT = /* glsl */ `
attribute vec4 iA;  // a.xyz, aux (tracer length)
attribute vec3 iB;
attribute vec4 iT;  // spawnTime, life, width0, width1
attribute vec4 iC;  // rgb, alpha
uniform float uTime;
uniform float uFadePow;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float age = uTime - iT.x;
  float t = age / iT.y;
  if (age < 0.0 || t >= 1.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vCol = vec4(0.0);
    vUv = vec2(0.0);
    return;
  }
  float w = mix(iT.z, iT.w, t);
  vec3 p;
  #ifdef RING
    vec2 l = vec2(position.x * 2.0 - 1.0, position.y);
    p = iA.xyz + vec3(l.x, 0.0, l.y) * w;
    vUv = l * 0.5 + 0.5;
    float a = iC.w * smoothstep(0.0, 0.06, t) * pow(1.0 - t, uFadePow);
  #else
    vec3 s = iA.xyz;
    vec3 e = iB;
    #ifdef TRACER
      vec3 d = iB - iA.xyz;
      float len = max(length(d), 0.0001);
      vec3 dir = d / len;
      float head = t * len;
      e = iA.xyz + dir * head;
      s = iA.xyz + dir * max(head - iA.w, 0.0);
    #endif
    vec3 axis = e - s;
    vec3 side = cross(axis, cameraPosition - (s + e) * 0.5);
    side = side / max(length(side), 0.0001);
    p = mix(s, e, position.x) + side * position.y * w;
    vUv = vec2(position.x, position.y * 0.5 + 0.5);
    float a = iC.w * pow(1.0 - t, uFadePow);
  #endif
  vCol = vec4(iC.rgb, a);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uGain;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  if (vCol.a <= 0.002) discard;
  float m = texture2D(uMap, vUv).a;
  gl_FragColor = vec4(vCol.rgb * uGain, vCol.a * m);
  #include <colorspace_fragment>
}`;

export function createQuadMaterial(mode: QuadMode, map: THREE.Texture, fadePow: number, gain: number): THREE.ShaderMaterial {
  const defines: Record<string, string> = {};
  if (mode === 'ring') defines.RING = '';
  if (mode === 'tracer') defines.TRACER = '';
  return new THREE.ShaderMaterial({
    defines,
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uMap: { value: map },
      uTime: { value: 0 },
      uFadePow: { value: fadePow },
      uGain: { value: gain },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}
