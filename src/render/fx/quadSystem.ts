import * as THREE from 'three';
import { FloatRing } from './pool';
import { hexToLinear } from './particleMaterial';
import { createQuadMaterial, type QuadMode } from './quadMaterial';
import type { LiveSink, QuadSink } from './types';

const DEAD = -1e9;

export interface QuadSystem extends QuadSink {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  update(time: number): void;
  reset(): void;
  dispose(): void;
}

export interface LiveSystem extends QuadSystem, LiveSink {}

function unitQuad(): THREE.InstancedBufferGeometry {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

function build(capacity: number, mode: QuadMode, map: THREE.Texture, fadePow: number, gain: number) {
  const buffers = new FloatRing(capacity, [4, 3, 4, 4]);
  const [a, b, t, c] = buffers.arrays;
  for (let i = 0; i < capacity; i++) t[i * 4] = DEAD;
  const geometry = unitQuad();
  geometry.instanceCount = capacity;
  const attrs = buffers.arrays.map((arr, k) => {
    const size = [4, 3, 4, 4][k];
    const at = new THREE.InstancedBufferAttribute(arr, size);
    at.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(['iA', 'iB', 'iT', 'iC'][k], at);
    return at;
  });
  const material = createQuadMaterial(mode, map, fadePow, gain);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const ring = buffers.ring;

  const write = (i: number, spawn: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number,
    life: number, w0: number, w1: number, color: number, alpha: number, aux: number) => {
    const i3 = i * 3;
    const i4 = i * 4;
    a[i4] = ax; a[i4 + 1] = ay; a[i4 + 2] = az; a[i4 + 3] = aux;
    b[i3] = bx; b[i3 + 1] = by; b[i3 + 2] = bz;
    t[i4] = spawn; t[i4 + 1] = life; t[i4 + 2] = w0; t[i4 + 3] = w1;
    hexToLinear(c, i4, color); c[i4 + 3] = alpha;
    ring.mark(i);
  };

  const base: QuadSystem = {
    mesh,
    material,
    emit(spawn, ax, ay, az, bx, by, bz, life, w0, w1, color, alpha, aux) {
      write(ring.alloc(), spawn, ax, ay, az, bx, by, bz, life, w0, w1, color, alpha, aux);
    },
    update(time) {
      material.uniforms.uTime.value = time;
      if (!ring.dirty) return;
      const start = ring.dirtyStart;
      const n = ring.dirtyCount;
      for (const at of attrs) {
        at.clearUpdateRanges();
        at.addUpdateRange(start * at.itemSize, n * at.itemSize);
        at.needsUpdate = true;
      }
      ring.clearDirty();
    },
    reset() {
      for (let i = 0; i < capacity; i++) t[i * 4] = DEAD;
      ring.reset();
      ring.markAll();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
  return { base, write };
}

export function createQuadSystem(capacity: number, mode: QuadMode, map: THREE.Texture, fadePow: number, gain: number): QuadSystem {
  return build(capacity, mode, map, fadePow, gain).base;
}

/** Fixed slots, two quads each (coloured halo + white core), rewritten by the caller every frame. */
export function createLiveSystem(slots: number, map: THREE.Texture, gain: number): LiveSystem {
  const { base, write } = build(slots * 2, 'beam', map, 0, gain);
  return {
    ...base,
    capacity: slots,
    set(slot, ax, ay, az, bx, by, bz, width, color, alpha) {
      write(slot * 2, 0, ax, ay, az, bx, by, bz, 1e9, width, width, color, alpha, 0);
      write(slot * 2 + 1, 0, ax, ay, az, bx, by, bz, 1e9, width * 0.22, width * 0.22, 0xffffff, alpha, 0);
    },
    clear(slot) {
      write(slot * 2, DEAD, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
      write(slot * 2 + 1, DEAD, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
    },
  };
}
