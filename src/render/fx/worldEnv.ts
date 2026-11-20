import type { World } from '@/types';
import type { Pos, RouteEnv } from './eventRouter';

/**
 * RouteEnv over a World. Structure positions are cached because structures may already be gone
 * from the world by the time their recycle/upgrade events reach the renderer.
 */
export class WorldEnv implements RouteEnv {
  private world: World | null = null;
  private readonly cache = new Map<number, number>();
  private nextRefresh = 0;

  bind(world: World): void {
    this.world = world;
    this.cache.clear();
    this.nextRefresh = 0;
  }

  /** Refreshes the position cache at ~4 Hz. */
  tick(now: number): void {
    if (!this.world || now < this.nextRefresh) return;
    this.nextRefresh = now + 0.25;
    for (const s of this.world.structures.values()) this.cache.set(s.id, s.tx * 4096 + s.ty);
    if (this.cache.size > 4000) this.cache.clear();
  }

  remember(id: number, tx: number, ty: number): void {
    this.cache.set(id, tx * 4096 + ty);
  }

  structurePos(id: number, out: Pos): boolean {
    const s = this.world?.structures.get(id);
    if (s) {
      out.x = s.tx + 0.5;
      out.y = s.ty + 0.5;
      return true;
    }
    const packed = this.cache.get(id);
    if (packed === undefined) return false;
    out.x = Math.floor(packed / 4096) + 0.5;
    out.y = (packed % 4096) + 0.5;
    return true;
  }

  basePos(owner: number, out: Pos): boolean {
    const p = this.world?.players[owner];
    if (!p || !p.baseBuilt) return false;
    out.x = p.baseTx + 0.5;
    out.y = p.baseTy + 0.5;
    return true;
  }

  shipPos(owner: number, out: Pos): boolean {
    const p = this.world?.players[owner];
    if (!p) return false;
    if (p.ship.dead) return this.basePos(owner, out);
    out.x = p.ship.x;
    out.y = p.ship.y;
    return true;
  }

  hitsFrac(owner: number): number {
    const p = this.world?.players[owner];
    if (!p || p.maxHits <= 0) return 1;
    return Math.max(0, Math.min(1, (p.maxHits - p.hits) / p.maxHits));
  }
}
