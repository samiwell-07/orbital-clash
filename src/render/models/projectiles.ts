import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Group, Matrix4, MeshBasicMaterial, DoubleSide, TorusGeometry } from 'three';
import type { Projectile } from '@/types';
import { TICK_DT } from '@/config/constants';
import { InstancedPool } from '@/render/instancing/InstancedPool';
import { assemble, coneX, cylX, composeYaw, octa, slab, sph } from '@/render/instancing/kit';
import { TEAM_GLOW, hexToRgb, teamIndex } from '@/render/instancing/colorTables';
import type { FrameInfo, ModelSystem } from './types';

type Kind = Projectile['kind'];
const KINDS: readonly Kind[] = ['bullet', 'pulse', 'bomb', 'torpedo', 'missile'];

interface Look { color: number; boost: number; trailWidth: number; trailLen: number }
const LOOKS: Readonly<Record<Kind, Look>> = {
  bullet: { color: 0xffe08a, boost: 3, trailWidth: 0.07, trailLen: 0.9 },
  pulse: { color: 0xe8d8ff, boost: 2.8, trailWidth: 0.2, trailLen: 0.4 },
  bomb: { color: 0xff8a2a, boost: 2.6, trailWidth: 0.2, trailLen: 0.7 },
  torpedo: { color: 0x6fd8ff, boost: 2.6, trailWidth: 0.15, trailLen: 0.8 },
  missile: { color: 0xffffff, boost: 2.2, trailWidth: 0.12, trailLen: 1 },
};

function bodyGeometry(kind: Kind): BufferGeometry {
  const W = 0xffffff;
  switch (kind) {
    case 'bullet': return assemble([{ g: cylX(0.025, 0.26, 5), c: W }, { g: coneX(0.025, 0.08, 5), p: [0.17, 0, 0], c: W }]);
    case 'pulse': return assemble([
      { g: octa(0.1), c: W },
      { g: new TorusGeometry(0.15, 0.014, 4, 12).rotateY(Math.PI / 2), c: 0xc0a8ff },
    ]);
    case 'bomb': return assemble([
      { g: sph(0.12, 8, 6), c: W, smooth: true },
      { g: slab([[-0.05, 0], [-0.2, 0.1], [-0.2, -0.1]], 0.02), p: [0, 0, 0], c: 0xffc27a },
    ]);
    case 'torpedo': return assemble([
      { g: cylX(0.05, 0.4, 7), c: W },
      { g: coneX(0.05, 0.14, 7), p: [0.27, 0, 0], c: 0xffffff },
      { g: coneX(0.06, 0.12, 6), p: [-0.25, 0, 0], r: [0, 0, Math.PI], c: 0x9fe8ff },
    ]);
    default: return assemble([
      { g: cylX(0.035, 0.34, 6), c: W },
      { g: coneX(0.035, 0.12, 6), p: [0.23, 0, 0], c: 0xff2a1a },
      { g: slab([[-0.08, 0], [-0.2, 0.09], [-0.2, -0.09]], 0.015), c: 0xdadde8 },
    ]);
  }
}

/** Two crossed triangles tapering from full width at the head (x = 0) to a point at x = -1, fading to black. */
function trailGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0.5, 0, 0, -0.5, -1, 0, 0,
    0, 0.5, 0, 0, -0.5, 0, -1, 0, 0,
  ], 3));
  g.setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0], 3));
  return g;
}

const TEAM_TINT: readonly (readonly number[])[] = TEAM_GLOW.map((hex) => {
  const c = [1, 1, 1];
  hexToRgb(hex, c);
  return c.map((v) => 0.65 + 0.35 * v);
});
const KIND_RGB = {} as Record<Kind, readonly number[]>;
for (const k of KINDS) { const c = [1, 1, 1]; hexToRgb(LOOKS[k].color, c); KIND_RGB[k] = c; }

/** Glowing instanced projectile bodies, one pool per kind, plus one shared pool of stretched trail triangles. */
export class ProjectileSystem implements ModelSystem {
  readonly group = new Group();
  private readonly pools: InstancedPool[];
  private readonly trails: InstancedPool;
  private readonly mats: MeshBasicMaterial[] = [];
  private readonly trailMat: MeshBasicMaterial;
  private readonly m = new Matrix4();

  constructor() {
    this.pools = KINDS.map((k) => {
      const mat = new MeshBasicMaterial({ color: new Color(0xffffff).multiplyScalar(LOOKS[k].boost), vertexColors: true });
      this.mats.push(mat);
      const p = new InstancedPool(bodyGeometry(k), mat, 64);
      this.group.add(p.mesh);
      return p;
    });
    this.trailMat = new MeshBasicMaterial({
      color: new Color(0xffffff).multiplyScalar(2.4), vertexColors: true, transparent: true,
      blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
    });
    this.trails = new InstancedPool(trailGeometry(), this.trailMat, 128);
    this.group.add(this.trails.mesh);
  }

  load(): void { for (const p of this.pools) p.clear(); this.trails.clear(); }

  update(f: FrameInfo): void {
    const list = f.world.projectiles;
    const alpha = f.alpha < 0 ? 0 : f.alpha > 1 ? 1 : f.alpha;
    for (const p of this.pools) p.begin();
    this.trails.begin();
    const m = this.m;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const speed = Math.hypot(p.vx, p.vy);
      const hd = speed > 1e-4 ? Math.atan2(p.vy, p.vx) : 0;
      const ch = speed > 1e-4 ? p.vx / speed : 1;
      const sh = speed > 1e-4 ? p.vy / speed : 0;
      const x = p.x + p.vx * alpha * TICK_DT;
      const z = p.y + p.vy * alpha * TICK_DT;
      const y = 0.25 + p.z;
      const look = LOOKS[p.kind];
      const tint = TEAM_TINT[teamIndex(p.owner)];
      if (p.kind === 'pulse') {
        const a = f.now * 9;
        composeYaw(m, x, y, z, Math.cos(hd + a), Math.sin(hd + a), 1, 1, 1);
      } else composeYaw(m, x, y, z, ch, sh, 1, 1, 1);
      this.pools[KINDS.indexOf(p.kind)].push(m, tint[0], tint[1], tint[2]);
      const len = Math.min(1.2, Math.max(0.25, speed * 0.05)) * look.trailLen;
      const rgb = KIND_RGB[p.kind];
      composeYaw(m, x, y, z, ch, sh, len, look.trailWidth, look.trailWidth);
      this.trails.push(m, rgb[0] * tint[0], rgb[1] * tint[1], rgb[2] * tint[2]);
    }
    for (const p of this.pools) p.end();
    this.trails.end();
  }

  dispose(): void {
    for (const p of this.pools) { p.mesh.geometry.dispose(); p.dispose(); }
    this.trails.mesh.geometry.dispose();
    this.trails.dispose();
    for (const m of this.mats) m.dispose();
    this.trailMat.dispose();
    this.group.removeFromParent();
  }
}
