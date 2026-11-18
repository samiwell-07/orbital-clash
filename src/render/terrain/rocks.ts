import * as THREE from 'three';
import type { Grid } from '@/types';
import { Bin } from './dispose';
import { hash2 } from './noise';
import type { Palette } from './palettes';
import { createCrystalGeometry, createRockVariants } from './rockGeometry';

export interface RockSet {
  group: THREE.Group;
  /** Pulses crystal glow. */
  update(timeSec: number): void;
}

const blocked = (g: Grid, tx: number, ty: number): boolean =>
  tx < 0 || ty < 0 || tx >= g.w || ty >= g.h || g.terrain[ty * g.w + tx] === 1;

function isInterior(g: Grid, tx: number, ty: number): boolean {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (!blocked(g, tx + dx, ty + dy)) return false;
  return true;
}

/** Cliff tiles become instanced chunky rocks (or armour blocks on metal worlds); a few edge tiles sprout crystals. */
export function buildRocks(g: Grid, p: Palette, bin: Bin): RockSet {
  const group = new THREE.Group();
  group.name = 'rocks';
  const variants = createRockVariants(p);
  const metal = p.rock.style === 'metal';
  const buckets: THREE.Matrix4[][] = variants.map(() => []);
  const tints: THREE.Color[][] = variants.map(() => []);
  const crystalSpots: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let ty = 0; ty < g.h; ty++) {
    for (let tx = 0; tx < g.w; tx++) {
      if (g.terrain[ty * g.w + tx] !== 1) continue;
      const r = (s: number): number => hash2(tx, ty, s);
      const v = Math.floor(r(1) * variants.length);
      const interior = isInterior(g, tx, ty);
      const height = metal ? [0.45, 0.7, 0.95][Math.floor(r(2) * 3)] * (interior ? 1.3 : 1) : (0.55 + 0.75 * r(2)) * (interior ? 1.5 : 1);
      const jitter = metal ? 0 : 0.12;
      const wide = metal ? 1 : 1.0 + 0.2 * r(3);
      q.setFromEuler(e.set(0, metal ? 0 : r(4) * Math.PI * 2, 0));
      m.compose(
        new THREE.Vector3(tx + 0.5 + (r(5) - 0.5) * jitter * 2, metal ? 0 : -0.05, ty + 0.5 + (r(6) - 0.5) * jitter * 2),
        q,
        new THREE.Vector3(wide, height, wide),
      );
      buckets[v].push(m.clone());
      const k = 0.88 + 0.24 * r(7);
      tints[v].push(new THREE.Color(k, k, k));
      if (p.crystal !== null && !interior && r(8) < 0.06) {
        crystalSpots.push(new THREE.Matrix4().compose(
          new THREE.Vector3(tx + 0.5 + (r(9) - 0.5) * 0.4, height * (metal ? 1 : 0.7), ty + 0.5 + (r(10) - 0.5) * 0.4),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r(11) * 6.28, 0)),
          new THREE.Vector3(0.9 + 0.5 * r(12), 0.9 + 0.7 * r(12), 0.9 + 0.5 * r(12)),
        ));
      }
    }
  }
  const mat = bin.add(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: metal ? 0.4 : 0.92, metalness: p.rock.metalness }));
  variants.forEach((geo, i) => {
    bin.add(geo);
    if (!buckets[i].length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, buckets[i].length);
    buckets[i].forEach((mx, n) => {
      mesh.setMatrixAt(n, mx);
      mesh.setColorAt(n, tints[i][n]);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `rocks-${i}`;
    group.add(mesh);
  });
  let crystalMat: THREE.MeshStandardMaterial | null = null;
  if (p.crystal !== null && crystalSpots.length) {
    const geo = bin.add(createCrystalGeometry());
    crystalMat = bin.add(new THREE.MeshStandardMaterial({ color: p.crystal, emissive: p.crystal, emissiveIntensity: 1.8, roughness: 0.2, flatShading: true }));
    const mesh = new THREE.InstancedMesh(geo, crystalMat, crystalSpots.length);
    crystalSpots.forEach((mx, n) => mesh.setMatrixAt(n, mx));
    mesh.name = 'crystals';
    group.add(mesh);
  }
  return {
    group,
    update(t) {
      if (crystalMat) crystalMat.emissiveIntensity = 1.7 + 0.5 * Math.sin(t * 1.6);
    },
  };
}
