import * as THREE from 'three';
import type { Grid } from '@/types';
import { type FloorTextures } from './textures';
import { fbm, smoothstep } from './noise';
import type { Palette } from './palettes';

const SEG = 4;

const isTerrain = (g: Grid, tx: number, ty: number, t: number): boolean =>
  tx >= 0 && ty >= 0 && tx < g.w && ty < g.h && g.terrain[ty * g.w + tx] === t;

/** Pit depth and rim height contributed by crater tiles around (x, z). */
function craterShape(g: Grid, x: number, z: number): { pit: number; rim: number; d: number } {
  let pit = 0;
  let rim = 0;
  let dMin = 9;
  const tx0 = Math.floor(x);
  const ty0 = Math.floor(z);
  for (let ty = ty0 - 1; ty <= ty0 + 1; ty++) {
    for (let tx = tx0 - 1; tx <= tx0 + 1; tx++) {
      if (!isTerrain(g, tx, ty, 2)) continue;
      const d = Math.hypot(x - tx - 0.5, z - ty - 0.5);
      dMin = Math.min(dMin, d);
      pit = Math.min(pit, -0.38 * smoothstep(0.64, 0.04, d));
      rim = Math.max(rim, 0.07 * Math.exp(-(((d - 0.72) / 0.13) ** 2)));
    }
  }
  return { pit, rim, d: dMin };
}

function cliffDistance(g: Grid, x: number, z: number): number {
  let best = 9;
  const tx0 = Math.floor(x);
  const ty0 = Math.floor(z);
  for (let ty = ty0 - 2; ty <= ty0 + 2; ty++) {
    for (let tx = tx0 - 2; tx <= tx0 + 2; tx++) {
      if (!isTerrain(g, tx, ty, 1)) continue;
      const dx = Math.max(tx - x, 0, x - tx - 1);
      const dz = Math.max(ty - z, 0, z - ty - 1);
      best = Math.min(best, Math.hypot(dx, dz));
    }
  }
  return best;
}

/** Heightfield plateau floor: craters are real depressions; vertex colours bake soft AO and large-scale variation. */
export function buildFloorGeometry(g: Grid, spec: FloorTextures['spec']): THREE.BufferGeometry {
  const nx = g.w * SEG;
  const nz = g.h * SEG;
  const count = (nx + 1) * (nz + 1);
  const pos = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const col = new Float32Array(count * 3);
  let k = 0;
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++, k++) {
      const x = i / SEG;
      const z = j / SEG;
      const c = craterShape(g, x, z);
      pos.set([x, c.pit + c.rim, z], k * 3);
      uv.set([x / spec.tilesX, 1 - z / spec.tilesY], k * 2);
      const macro = 0.88 + 0.24 * fbm(x * 0.12, z * 0.12, 1000, 1000, 3, 11);
      const ao = 1 - 0.4 * smoothstep(1.3, 0.0, cliffDistance(g, x, z));
      const pitDark = 1 - 0.85 * smoothstep(0.75, 0.15, c.d);
      col.fill(macro * ao * pitDark, k * 3, k * 3 + 3);
    }
  }
  const index = new Uint32Array(nx * nz * 6);
  let n = 0;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      index.set([a, c, b, b, c, c + 1], n);
      n += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  return geo;
}

export function createFloorMaterial(p: Palette, t: FloorTextures): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: t.map,
    roughnessMap: t.roughnessMap,
    roughness: 1,
    metalness: p.floor.metalness,
    normalMap: t.normalMap,
    normalScale: new THREE.Vector2(1, 1),
    emissive: 0xffffff,
    emissiveMap: t.emissiveMap,
    emissiveIntensity: p.inlay.intensity,
    vertexColors: true,
  });
}
