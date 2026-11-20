import * as THREE from 'three';
import { Bin } from './dispose';
import { fbm } from './noise';
import type { Palette } from './palettes';

const ROWS = 8;
const DEPTH = 9;

/** Ring of jagged strata walls that drop from the plateau rim into the void, darkening with depth. */
export function buildSkirt(w: number, h: number, p: Palette, bin: Bin): THREE.Mesh {
  const perimeter: [number, number, number, number][] = [];
  const step = 0.5;
  for (let x = 0; x < w; x += step) perimeter.push([x, 0, 0, -1]);
  for (let z = 0; z < h; z += step) perimeter.push([w, z, 1, 0]);
  for (let x = w; x > 0; x -= step) perimeter.push([x, h, 0, 1]);
  for (let z = h; z > 0; z -= step) perimeter.push([0, z, -1, 0]);
  const cols = perimeter.length;
  const pos = new Float32Array((cols + 1) * (ROWS + 1) * 3);
  const col = new Float32Array((cols + 1) * (ROWS + 1) * 3);
  const top = new THREE.Color(p.skirt.top);
  const bottom = new THREE.Color(p.skirt.bottom);
  const c = new THREE.Color();
  for (let i = 0; i <= cols; i++) {
    const [x, z, nx, nz] = perimeter[i % cols];
    for (let r = 0; r <= ROWS; r++) {
      const t = r / ROWS;
      const jag = (fbm(((i % cols) * 48) / cols, r * 0.9, 48, 64, 3, 21) - 0.5) * 1.6 * t;
      const out = t * 1.2 + jag - 0.15 * (1 - t);
      const k = (i * (ROWS + 1) + r) * 3;
      pos[k] = x + nx * out;
      pos[k + 1] = -t * DEPTH - 0.02 * (1 - t);
      pos[k + 2] = z + nz * out;
      const strata = 0.85 + 0.3 * fbm(((i % cols) * 24) / cols, r * 1.7, 24, 64, 2, 8);
      c.copy(top).lerp(bottom, Math.min(1, t * 1.15) ** 0.8).multiplyScalar(strata);
      col[k] = c.r;
      col[k + 1] = c.g;
      col[k + 2] = c.b;
    }
  }
  const index: number[] = [];
  for (let i = 0; i < cols; i++) {
    for (let r = 0; r < ROWS; r++) {
      const a = i * (ROWS + 1) + r;
      const b = (i + 1) * (ROWS + 1) + r;
      // winding: outward-facing walls for the clockwise perimeter walk
      index.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = bin.add(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mat = bin.add(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: p.rock.metalness * 0.5, side: THREE.DoubleSide }));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'skirt';
  mesh.receiveShadow = true;
  return mesh;
}
