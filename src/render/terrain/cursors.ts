import * as THREE from 'three';
import { Bin } from './dispose';

export interface TerrainCursor {
  /** Tile under the ship (integer tile coordinates). */
  tx: number;
  ty: number;
  /** Team / player colour (0xRRGGBB). */
  color: number;
  /** Range of the structure under the cursor in tiles; omitted or 0 draws no ring. */
  range?: number;
  /** Ring colour override (default red, as in the manual). */
  ringColor?: number;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const TILE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying vec2 vUv;
void main() {
  vec2 p = abs(vUv - 0.5) * 2.0;
  float half_ = 0.76;
  float d = max(p.x, p.y);
  float edge = smoothstep(0.07, 0.0, abs(d - half_));
  float corner = edge * step(0.5, min(p.x, p.y));
  float fill = step(d, half_) * 0.1;
  float pulse = 1.4 + 0.5 * sin(uTime * 5.0);
  float a = clamp(edge * 0.4 + corner * 0.8 + fill, 0.0, 1.0);
  gl_FragColor = vec4(uColor * pulse, a);
}`;

const RING_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 v = (vUv - 0.5) * 2.0;
  float r = length(v);
  float ang = atan(v.y, v.x) + uTime * 0.35;
  float dash = smoothstep(0.35, 0.5, abs(fract(ang * 14.0 / 6.2831853) - 0.5) * 2.0);
  float line = smoothstep(0.022, 0.0, abs(r - uRadius));
  float fill = smoothstep(uRadius, uRadius - 0.25, r) * step(r, uRadius) * 0.03;
  float a = clamp(line * (1.0 - dash * 0.95) + fill, 0.0, 1.0);
  gl_FragColor = vec4(uColor * 1.6, a);
}`;

const MAX_CURSORS = 8;

interface Slot {
  group: THREE.Group;
  tile: THREE.Mesh;
  ring: THREE.Mesh;
  tileU: { uColor: { value: THREE.Color }; uTime: { value: number } };
  ringU: { uColor: { value: THREE.Color }; uTime: { value: number }; uRadius: { value: number } };
}

export interface CursorMarkers {
  group: THREE.Group;
  set(cursors: readonly TerrainCursor[]): void;
  update(timeSec: number): void;
}

function material(frag: string, uniforms: Record<string, THREE.IUniform>, bin: Bin): THREE.ShaderMaterial {
  return bin.add(
    new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
  );
}

/** Pool of tile highlights with an optional dashed range ring, driven by TerrainLayer.setCursors. */
export function buildCursorMarkers(bin: Bin): CursorMarkers {
  const group = new THREE.Group();
  group.name = 'cursors';
  const quad = bin.add(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const slots: Slot[] = [];
  for (let i = 0; i < MAX_CURSORS; i++) {
    const tileU = { uColor: { value: new THREE.Color() }, uTime: { value: 0 } };
    const ringU = { uColor: { value: new THREE.Color() }, uTime: { value: 0 }, uRadius: { value: 0.9 } };
    const tile = new THREE.Mesh(quad, material(TILE_FRAG, tileU, bin));
    const ring = new THREE.Mesh(quad, material(RING_FRAG, ringU, bin));
    tile.scale.set(1.35, 1, 1.35);
    tile.position.y = 0.06;
    ring.position.y = 0.055;
    tile.renderOrder = ring.renderOrder = 10;
    const slot = new THREE.Group();
    slot.visible = false;
    slot.add(ring, tile);
    group.add(slot);
    slots.push({ group: slot, tile, ring, tileU, ringU });
  }
  return {
    group,
    set(cursors) {
      slots.forEach((s, i) => {
        const c = cursors[i];
        s.group.visible = !!c;
        if (!c) return;
        s.group.position.set(c.tx + 0.5, 0, c.ty + 0.5);
        s.tileU.uColor.value.set(c.color);
        const range = c.range ?? 0;
        s.ring.visible = range > 0;
        if (range > 0) {
          const half = range + 0.25;
          s.ring.scale.set(half * 2, 1, half * 2);
          s.ringU.uRadius.value = range / half;
          s.ringU.uColor.value.set(c.ringColor ?? 0xff4a4a);
        }
      });
    },
    update(t) {
      for (const s of slots) {
        s.tileU.uTime.value = t;
        s.ringU.uTime.value = t;
      }
    },
  };
}
