import * as THREE from 'three';
import type { Grid } from '@/types';
import { Bin } from './dispose';
import { hash2 } from './noise';
import type { Palette } from './palettes';
import { createCrystalGeometry, createRockVariants, createWallRidge } from './rockGeometry';

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
  // Fit every cap inside its cell, even after the natural variants are rotated.
  const widths = variants.map(geo => {
    const pos = geo.getAttribute('position');
    let extent = 0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      extent = Math.max(extent, metal ? Math.max(Math.abs(x), Math.abs(z)) : Math.hypot(x, z));
    }
    return 0.49 / extent;
  });
  const buckets: THREE.Matrix4[][] = variants.map(() => []);
  const tints: THREE.Color[][] = variants.map(() => []);
  const crystalSpots: THREE.Matrix4[] = [];
  const ridges: THREE.Matrix4[] = [];
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
      const wide = widths[v];
      q.setFromEuler(e.set(0, metal ? 0 : r(4) * Math.PI * 2, 0));
      m.compose(
        new THREE.Vector3(tx + 0.5, metal ? 0 : -0.05, ty + 0.5),
        q,
        new THREE.Vector3(wide, height, wide),
      );
      buckets[v].push(m.clone());
      const k = 0.88 + 0.24 * r(7);
      tints[v].push(new THREE.Color(k, k, k));
      for (const east of [true, false]) {
        const dx = east ? 1 : 0, dz = east ? 0 : 1;
        if (tx + dx >= g.w || ty + dz >= g.h || g.terrain[(ty + dz) * g.w + tx + dx] !== 1) continue;
        ridges.push(new THREE.Matrix4().compose(
          new THREE.Vector3(tx + 0.5 + dx / 2, 0, ty + 0.5 + dz / 2),
          q.setFromEuler(e.set(0, east ? Math.PI / 2 : 0, 0)),
          new THREE.Vector3(1, (metal ? 0.42 : 0.31) + 0.08 * r(15 + dx), 1),
        ));
      }
      if (p.crystal !== null && !interior && r(8) < 0.06) {
        crystalSpots.push(new THREE.Matrix4().compose(
          new THREE.Vector3(tx + 0.5, height * (metal ? 0.9 : 0.6), ty + 0.5),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r(11) * 6.28, 0)),
          new THREE.Vector3(0.9, 0.9 + 0.7 * r(12), 0.9),
        ));
      }
    }
  }
  const mat = bin.add(new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: metal ? 0.4 : 0.92, metalness: p.rock.metalness }));
  variants.forEach((geo, i) => {
    bin.add(geo);
    if (!buckets[i].length) return;
    const mesh = bin.add(new THREE.InstancedMesh(geo, mat, buckets[i].length));
    buckets[i].forEach((mx, n) => {
      mesh.setMatrixAt(n, mx);
      mesh.setColorAt(n, tints[i][n]);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `rocks-${i}`;
    group.add(mesh);
  });
  if (ridges.length) {
    const mesh = bin.add(new THREE.InstancedMesh(bin.add(createWallRidge(p)), mat, ridges.length));
    ridges.forEach((mx, i) => mesh.setMatrixAt(i, mx));
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = 'wall-ridges';
    group.add(mesh);
  }
  let crystalMat: THREE.MeshStandardMaterial | null = null;
  if (p.crystal !== null && crystalSpots.length) {
    const geo = bin.add(createCrystalGeometry());
    crystalMat = bin.add(new THREE.MeshStandardMaterial({ color: p.crystal, emissive: p.crystal, emissiveIntensity: 1.8, roughness: 0.2, flatShading: true }));
    const mesh = bin.add(new THREE.InstancedMesh(geo, crystalMat, crystalSpots.length));
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
