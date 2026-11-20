import * as THREE from 'three';
import type { Grid } from '@/types';
import { Bin } from './dispose';
import { FLOOR_SEGMENTS_PER_TILE as SEG } from './floor';
import type { Palette } from './palettes';

/** Outline each build tile; a dark stroke reads better than additive light on ice. */
export function buildGridLines(g: Grid, surface: THREE.BufferGeometry, p: Palette, bin: Bin, opacity = 0.42): THREE.LineSegments {
  const floor = (tx: number, ty: number): boolean => tx >= 0 && ty >= 0 && tx < g.w && ty < g.h && g.terrain[ty * g.w + tx] === 0;
  const v: number[] = [];
  const pos = surface.getAttribute('position');
  const stride = g.w * SEG + 1;
  const seg = (x0: number, z0: number, x1: number, z1: number): void => {
    // Trace the actual heightfield around crater lips; collapse flat runs to one segment.
    const dx = x1 - x0, dz = z1 - z0;
    const index = (x0 + z0 * stride) * SEG;
    let x = x0, z = z0, h = pos.getY(index);
    for (let i = 1; i <= SEG; i++) {
      const next = index + i * (dx + dz * stride);
      const nh = pos.getY(next);
      if (i !== SEG && nh === h && pos.getY(next + dx + dz * stride) === h) continue;
      const nx = x0 + dx * i / SEG, nz = z0 + dz * i / SEG;
      v.push(x, h, z, nx, nh, nz);
      x = nx; z = nz; h = nh;
    }
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
    new THREE.LineBasicMaterial({ color: p.pattern === 'ice' ? p.floor.seam : p.grid, transparent: true, opacity, depthWrite: false }),
  );
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.y = 0.009;
  lines.name = 'grid';
  return lines;
}
