import type { Grid, MapDef } from '@/types';
import { createGrid, occupy, DIRS4, inBounds } from '@/sim/core';
import { reachableFrom } from '@/sim/core/reach';

export interface Tile {
  tx: number;
  ty: number;
}

/**
 * Tracks occupied tiles while an area script is authored, so every authored structure sits on free
 * floor, keeps spacing and never seals a base away from the other.
 */
export class Layout {
  readonly grid: Grid;
  private readonly placed: Tile[] = [];
  private nextId = 1;
  constructor(readonly map: MapDef) {
    this.grid = createGrid(map);
  }

  get human(): Tile {
    return this.map.baseTiles[0] as Tile;
  }

  get enemy(): Tile {
    return this.map.baseTiles[1] as Tile;
  }

  private floor(t: Tile): boolean {
    return inBounds(this.grid, t.tx, t.ty) && this.grid.terrain[t.ty * this.grid.w + t.tx] === 0;
  }

  private touches(seen: Uint8Array, t: Tile): boolean {
    const g = this.grid;
    if (seen[t.ty * g.w + t.tx]) return true;
    return DIRS4.some(([dx, dy]) => inBounds(g, t.tx + dx, t.ty + dy) && seen[(t.ty + dy) * g.w + t.tx + dx]);
  }

  private connected(): boolean {
    const seen = reachableFrom(this.grid, this.human.tx, this.human.ty);
    return this.touches(seen, this.enemy) && this.placed.every((t) => this.touches(seen, t));
  }

  /** Occupies a tile (used for preplaced and scripted structures). Returns false if it is unusable or would seal a path. */
  claim(t: Tile): boolean {
    if (!this.floor(t) || this.grid.occupant[t.ty * this.grid.w + t.tx] !== 0) return false;
    if ((t.tx === this.human.tx && t.ty === this.human.ty) || (t.tx === this.enemy.tx && t.ty === this.enemy.ty)) return false;
    occupy(this.grid, t.tx, t.ty, this.nextId++);
    this.placed.push(t);
    if (this.connected()) return true;
    this.placed.pop();
    this.grid.occupant[t.ty * this.grid.w + t.tx] = 0;
    return false;
  }

  /**
   * Picks up to n tiles around `center` between rMin and rMax (Chebyshev), at least 2 apart from every
   * placed structure. `front` orders them toward the opposing base first, otherwise away from it.
   */
  pick(n: number, center: Tile, rMin: number, rMax: number, front: boolean, toward: Tile = this.human): Tile[] {
    const cand: Tile[] = [];
    for (let ty = center.ty - rMax; ty <= center.ty + rMax; ty++) {
      for (let tx = center.tx - rMax; tx <= center.tx + rMax; tx++) {
        const r = Math.max(Math.abs(tx - center.tx), Math.abs(ty - center.ty));
        if (r < rMin || !this.floor({ tx, ty })) continue;
        if (this.placed.some((p) => Math.max(Math.abs(p.tx - tx), Math.abs(p.ty - ty)) < 2)) continue;
        cand.push({ tx, ty });
      }
    }
    const d = (t: Tile) => Math.hypot(t.tx - toward.tx, t.ty - toward.ty);
    cand.sort((a, b) => (front ? d(a) - d(b) : d(b) - d(a)) || a.ty - b.ty || a.tx - b.tx);
    const out: Tile[] = [];
    for (const t of cand) {
      if (out.length >= n) break;
      if (out.every((o) => Math.max(Math.abs(o.tx - t.tx), Math.abs(o.ty - t.ty)) >= 2) && this.claim(t)) out.push(t);
    }
    return out;
  }
}
