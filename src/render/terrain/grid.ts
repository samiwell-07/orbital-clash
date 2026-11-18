import * as THREE from 'three';
import type { Grid } from '@/types';
import { Bin } from './dispose';
import type { Palette } from './palettes';

/** Faint tile outlines over buildable floor (terrain 0) so the build grid stays readable. */
export function buildGridLines(g: Grid, p: Palette, bin: Bin, opacity = 0.06): THREE.LineSegments {
  const floor = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < g.w && ty < g.h && g.terrain[ty * g.w + tx] === 0;
  const v: number[] = [];
  const seg = (x0: number, z0: number, x1: number, z1: number): void => {
    v.push(x0, 0, z0, x1, 0, z1);
  };
  for (let ty = 0; ty < g.h; ty++) {
    for (let tx = 0; tx < g.w; tx++) {
      if (!floor(tx, ty)) continue;
      seg(tx, ty, tx, ty + 1);
      seg(tx, ty, tx + 1, ty);
      if (!floor(tx + 1, ty)) seg(tx + 1, ty, tx + 1, ty + 1);
      if (!floor(tx, ty + 1)) seg(tx, ty + 1, tx + 1, ty + 1);
    }
  }
  const geo = bin.add(new THREE.BufferGeometry());
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  const mat = bin.add(
    new THREE.LineBasicMaterial({ color: p.grid, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.y = 0.025;
  lines.name = 'grid';
  return lines;
}
