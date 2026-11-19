import { Color, Float32BufferAttribute, Group, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { TICK_DT } from '@/config/constants';
import type { Rock, RockState, World } from '@/types';
import { InstancedPool } from '@/render/instancing/InstancedPool';
import { assemble, coneX, ico } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { hash01 } from '@/render/instancing/colorTables';
import { glowMat } from './materials';
import { clamp01 } from './motion';
import type { FrameInfo, ModelSystem } from './types';

/** World radius per rock size (mechanics.md tuned rock model). */
export const ROCK_RADIUS: readonly number[] = [0.4, 0.7, 1.1];
const STATES: readonly RockState[] = ['drifting', 'landed', 'grabbed', 'harvesting', 'smashed'];
/** Base emissive of the thorium veins per state; grabbed/harvesting/smashed also pulse. */
const GLOW: Readonly<Record<RockState, number>> = { drifting: 1.4, landed: 1.9, grabbed: 3.4, harvesting: 4.2, smashed: 5 };
const THORIUM = 0xd8ff3c;

function rockBody(): BufferGeometry {
  const g = ico(1, 1);
  const pos = g.getAttribute('position');
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n = hash01(Math.round(v.x * 997) * 31 + Math.round(v.y * 991) * 17 + Math.round(v.z * 983));
    pos.setXYZ(i, v.x * (0.74 + 0.26 * n), v.y * (0.72 + 0.28 * n) * 0.9, v.z * (0.74 + 0.26 * n));
  }
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  const col = new Float32Array(pos.count * 3);
  const c = new Color();
  for (let f = 0; f < pos.count; f += 3) {
    const k = 0.7 + 0.5 * hash01(f * 7 + 3);
    c.set(0x59626f).multiplyScalar(k);
    for (let j = 0; j < 3; j++) { col[(f + j) * 3] = c.r; col[(f + j) * 3 + 1] = c.g; col[(f + j) * 3 + 2] = c.b; }
  }
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g;
}

function crystals(): BufferGeometry {
  const specs: PartSpec[] = [];
  const dir = new Vector3();
  for (let i = 0; i < 15; i++) {
    const a = hash01(i * 13 + 1) * Math.PI * 2;
    const b = Math.acos(1 - 2 * hash01(i * 29 + 5));
    dir.set(Math.sin(b) * Math.cos(a), Math.cos(b) * 0.85, Math.sin(b) * Math.sin(a));
    const len = 0.4 + 0.4 * hash01(i * 7 + 2);
    const yaw = Math.atan2(dir.z, dir.x);
    const pitch = Math.asin(Math.max(-1, Math.min(1, dir.y / dir.length())));
    specs.push({
      g: coneX(0.12 + 0.07 * hash01(i), len, 5),
      p: [dir.x * 0.74, dir.y * 0.74, dir.z * 0.74],
      r: [0, -yaw, pitch],
      c: i % 3 === 0 ? 0xffffff : 0xb8e830,
    });
  }
  return assemble(specs);
}

/** Faceted thorium-veined asteroids: one body pool + one crystal pool per state (so each state glows differently). */
export class RockSystem implements ModelSystem {
  readonly group = new Group();
  private readonly body: InstancedPool;
  private readonly veins: InstancedPool[];
  private readonly mats: MeshStandardMaterial[];
  private readonly bodyMat = new MeshStandardMaterial({ vertexColors: true, color: 0xffffff, metalness: 0.15, roughness: 0.9 });
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly axis = new Vector3();
  private readonly pos = new Vector3();
  private readonly scl = new Vector3();

  constructor() {
    this.body = new InstancedPool(rockBody(), this.bodyMat, 32, true);
    this.group.add(this.body.mesh);
    const vg = crystals();
    this.mats = STATES.map((s) => glowMat(THORIUM, GLOW[s], true));
    this.veins = this.mats.map((mat) => {
      const p = new InstancedPool(vg, mat, 16);
      this.group.add(p.mesh);
      return p;
    });
  }

  load(_world: World): void { this.body.clear(); for (const v of this.veins) v.clear(); }

  update(f: FrameInfo): void {
    this.body.begin();
    for (const v of this.veins) v.begin();
    const rocks = f.world.rocks;
    const alpha = clamp01(f.alpha);
    const dt = alpha * TICK_DT;
    for (let i = 0; i < rocks.length; i++) this.place(rocks[i], f.now, dt);
    this.body.end();
    for (const v of this.veins) v.end();
    for (let s = 0; s < STATES.length; s++) {
      const st = STATES[s];
      const fast = st === 'grabbed' ? 9 : st === 'harvesting' ? 14 : st === 'smashed' ? 20 : 0;
      const pulse = fast > 0 ? 0.75 + 0.25 * Math.sin(f.now * fast) : 0.9 + 0.1 * Math.sin(f.now * 2.5);
      this.mats[s].emissiveIntensity = GLOW[st] * pulse;
    }
  }

  dispose(): void {
    this.body.mesh.geometry.dispose();
    this.body.dispose();
    this.veins[0]?.mesh.geometry.dispose();
    for (const v of this.veins) v.dispose();
    for (const m of this.mats) m.dispose();
    this.bodyMat.dispose();
    this.group.removeFromParent();
  }

  private place(r: Rock, now: number, dt: number): void {
    const rad = ROCK_RADIUS[Math.max(0, Math.min(2, r.size - 1))];
    const h = hash01(r.id);
    this.axis.set(hash01(r.id * 3 + 1) - 0.5, hash01(r.id * 5 + 2) - 0.5, hash01(r.id * 7 + 3) - 0.5);
    if (this.axis.lengthSq() < 1e-4) this.axis.set(0, 1, 0);
    this.axis.normalize();
    const grabbed = r.state === 'grabbed';
    const harvesting = r.state === 'harvesting';
    const rate = grabbed ? 1.8 : harvesting ? 2.6 : 0.35 + 0.5 * h;
    this.q.setFromAxisAngle(this.axis, r.spin + now * rate);
    const bob = Math.sin(now * 0.9 + h * 6.28) * 0.04;
    const lift = grabbed ? 0.85 : rad * 0.55 + (r.state === 'landed' ? 0 : harvesting ? 0.3 : 0.12);
    this.pos.set(r.x + r.vx * dt, lift + bob, r.y + r.vy * dt);
    const squash = r.state === 'smashed' ? 0.85 : 1;
    this.scl.set(rad * (0.9 + 0.2 * h) * squash, rad * (0.85 + 0.25 * hash01(r.id + 9)) * squash, rad * (0.9 + 0.2 * hash01(r.id + 4)) * squash);
    this.m.compose(this.pos, this.q, this.scl);
    const j = 0.85 + 0.3 * hash01(r.id + 11);
    this.body.push(this.m, j, j, j);
    this.veins[Math.max(0, STATES.indexOf(r.state))].push(this.m);
  }
}
