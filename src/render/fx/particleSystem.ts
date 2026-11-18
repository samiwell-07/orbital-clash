import * as THREE from 'three';
import { FloatRing } from './pool';
import { createPointMaterial, hexToLinear, type PointMaterialOptions } from './particleMaterial';
import type { PointSink } from './types';

const DEAD = -1e9;

export interface PointSystem extends PointSink {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  readonly buffers: FloatRing;
  update(time: number, pixelScale: number): void;
  reset(): void;
  dispose(): void;
}

/**
 * One THREE.Points draw call. Particles are simulated entirely in the vertex shader from
 * spawn data, so the CPU only writes a slot on spawn and uploads the dirty range.
 */
export function createPointSystem(capacity: number, opts: PointMaterialOptions): PointSystem {
  const buffers = new FloatRing(capacity, [3, 3, 4, 4, 4]);
  const [p0, vel, tm, c0, c1] = buffers.arrays;
  for (let i = 0; i < capacity; i++) tm[i * 4] = DEAD;
  const geometry = new THREE.BufferGeometry();
  const names = ['position', 'aV', 'aT', 'aC0', 'aC1'];
  const attrs = buffers.arrays.map((arr, k) => {
    const a = new THREE.BufferAttribute(arr, [3, 3, 4, 4, 4][k]);
    a.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(names[k], a);
    return a;
  });
  geometry.setDrawRange(0, capacity);
  const material = createPointMaterial(opts);
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const ring = buffers.ring;

  return {
    points,
    material,
    buffers,
    emit(spawn, x, y, z, vx, vy, vz, life, size0, size1, color0, color1, alpha, accelY) {
      const i = ring.alloc();
      const i3 = i * 3;
      const i4 = i * 4;
      p0[i3] = x; p0[i3 + 1] = y; p0[i3 + 2] = z;
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      tm[i4] = spawn; tm[i4 + 1] = life; tm[i4 + 2] = size0; tm[i4 + 3] = size1;
      hexToLinear(c0, i4, color0); c0[i4 + 3] = alpha;
      hexToLinear(c1, i4, color1); c1[i4 + 3] = accelY;
    },
    update(time, pixelScale) {
      material.uniforms.uTime.value = time;
      material.uniforms.uScale.value = pixelScale;
      if (!ring.dirty) return;
      const start = ring.dirtyStart;
      const n = ring.dirtyCount;
      for (const a of attrs) {
        a.clearUpdateRanges();
        a.addUpdateRange(start * a.itemSize, n * a.itemSize);
        a.needsUpdate = true;
      }
      ring.clearDirty();
    },
    reset() {
      for (let i = 0; i < capacity; i++) tm[i * 4] = DEAD;
      ring.reset();
      ring.markAll();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
