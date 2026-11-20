import { Group, Matrix4, TorusGeometry } from 'three';
import type { BufferGeometry } from 'three';
import { InstancedPool } from '@/render/instancing/InstancedPool';
import { assemble, cached, composeYaw, cyl, slab } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { platformMat, teamTrimMat } from '../materials';
import { GROWN_VARIANT } from './marks';

const PI8 = Math.PI / 8;
const GROWN_SCALE = 1.12;

function platformGeometry(variant: number): BufferGeometry {
  const specs: PartSpec[] = [
    { g: cyl(0.47, 0.5, 0.1, 8), p: [0, 0.05, 0], r: [0, PI8, 0], c: 0x4a4f57 },
    { g: cyl(0.44, 0.45, 0.025, 8), p: [0, 0.1075, 0], r: [0, PI8, 0], c: 0x8a9099 },
    { g: cyl(0.3, 0.3, 0.004, 16), p: [0, 0.121, 0], c: 0x6c727b, smooth: true },
  ];
  const grown = variant === GROWN_VARIANT;
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rot = [0, -a, 0] as const;
    if (grown) {
      const wedge = slab([[0.13, 0], [0.03, 0.15], [-0.13, 0.1], [-0.13, -0.1], [0.03, -0.15]], 0.012);
      specs.push({ g: wedge, p: [ca * 0.31, 0.126, sa * 0.31], r: rot, c: 0x040507 });
      continue;
    }
    for (let i = 0; i < variant; i++) {
      const off = (i - (variant - 1) / 2) * 0.1;
      const tri = slab([[0.07, 0], [-0.05, 0.045], [-0.05, -0.045]], 0.012);
      specs.push({ g: tri, p: [ca * 0.32 - sa * off, 0.126, sa * 0.32 + ca * off], r: rot, c: 0x101218 });
    }
  }
  return assemble(specs);
}

const ringGeometry = (): BufferGeometry =>
  cached('platform:ring', () => new TorusGeometry(0.435, 0.02, 4, 8).rotateX(Math.PI / 2).rotateY(PI8).translate(0, 0.122, 0));

export interface PlatRec { variant: number; idx: number; ringTeam: number; ringIdx: number }

/** All platform bases + team rings of every structure, drawn as a handful of instanced meshes. */
export class PlatformSet {
  readonly group = new Group();
  private readonly pools: (InstancedPool | undefined)[] = [];
  private readonly rings: (InstancedPool | undefined)[] = [];
  private readonly m = new Matrix4();

  newRec(): PlatRec { return { variant: -1, idx: -1, ringTeam: -1, ringIdx: -1 }; }

  place(rec: PlatRec, x: number, z: number, variant: number, sxz: number, sy: number, darken: number, team: number): void {
    if (rec.variant !== variant) {
      this.releaseBase(rec);
      let pool = this.pools[variant];
      if (!pool) {
        pool = new InstancedPool(cached(`platform:${variant}`, () => platformGeometry(variant)), platformMat(), 64, true);
        pool.mesh.receiveShadow = true;
        this.pools[variant] = pool;
        this.group.add(pool.mesh);
      }
      rec.variant = variant;
      rec.idx = pool.alloc();
    }
    if (rec.ringTeam !== team) {
      this.releaseRing(rec);
      let ring = this.rings[team];
      if (!ring) {
        ring = new InstancedPool(ringGeometry(), teamTrimMat(team), 32);
        this.rings[team] = ring;
        this.group.add(ring.mesh);
      }
      rec.ringTeam = team;
      rec.ringIdx = ring.alloc();
    }
    const k = variant === GROWN_VARIANT ? GROWN_SCALE : 1;
    composeYaw(this.m, x, 0, z, 1, 0, sxz * k, sy, sxz * k);
    this.pools[variant]!.setAt(rec.idx, this.m, darken, darken, darken);
    this.rings[team]!.setAt(rec.ringIdx, this.m);
  }

  release(rec: PlatRec): void { this.releaseBase(rec); this.releaseRing(rec); }

  dispose(): void {
    for (const p of this.pools) p?.dispose();
    for (const p of this.rings) p?.dispose();
    this.pools.length = 0;
    this.rings.length = 0;
    this.group.removeFromParent();
  }

  private releaseBase(rec: PlatRec): void {
    if (rec.variant >= 0) this.pools[rec.variant]?.free(rec.idx);
    rec.variant = -1;
    rec.idx = -1;
  }

  private releaseRing(rec: PlatRec): void {
    if (rec.ringTeam >= 0) this.rings[rec.ringTeam]?.free(rec.ringIdx);
    rec.ringTeam = -1;
    rec.ringIdx = -1;
  }
}
