import { Color, Group, Mesh } from 'three';
import type { BufferGeometry, MeshStandardMaterial, Object3D, Material } from 'three';
import type { Structure } from '@/types';
import { hash01 } from '@/render/instancing/colorTables';
import { approachAngle } from '../motion';
import { glowMat, stdMat, teamTrimMat } from '../materials';

/** Y of the platform top; towers stand on it. */
export const TOP = 0.12;

/** Per-structure frame state, computed once per structure per frame by the system (reused object). */
export interface Anim {
  t: number;
  dt: number;
  ratio: number;
  darken: number;
  crack: number;
  flick: number;
  build: number;
  flash: number;
  team: number;
  hasT: boolean;
  /** Target position in tile units. */
  tx: number;
  tz: number;
  /** 1 right after a shot, decaying to 0 (recoil / muzzle flash). */
  shot: number;
  glowMul: number;
}

export function newAnim(): Anim {
  return { t: 0, dt: 0, ratio: 1, darken: 1, crack: 0, flick: 1, build: 1, flash: 0, team: 0, hasT: false, tx: 0, tz: 0, shot: 0, glowMul: 1 };
}

export interface StructureView {
  readonly root: Group;
  update(s: Structure, a: Anim): void;
  dispose(): void;
}

export interface GlowRef { m: MeshStandardMaterial; base: number }
interface Tint { m: MeshStandardMaterial; base: Color }

/** Helper that owns the per-structure materials (tintable body, flickering glows) of one view. */
export class ViewBuilder {
  readonly root = new Group();
  yaw = -Math.PI / 2;

  constructor(readonly team: number) {}
  private readonly tints: Tint[] = [];
  private readonly glows: GlowRef[] = [];
  private readonly owned: Material[] = [];

  /** Tintable body material: darkens and heats up with damage. */
  body(hex: number, metal = 0.6, rough = 0.45, vertexColors = true): MeshStandardMaterial {
    const m = stdMat(hex, metal, rough, vertexColors);
    m.emissive = new Color(0, 0, 0);
    this.tints.push({ m, base: m.color.clone() });
    this.owned.push(m);
    return m;
  }

  glow(hex: number, intensity: number, vertexColors = false): GlowRef {
    const ref = { m: glowMat(hex, intensity, vertexColors), base: intensity };
    this.glows.push(ref);
    this.owned.push(ref.m);
    return ref;
  }

  /** Glowing owner-colour accent (shared material, never tinted by damage). */
  trim(geo: BufferGeometry, parent: Object3D = this.root, x = 0, y = 0, z = 0): Mesh {
    const m = new Mesh(geo, teamTrimMat(this.team));
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  own<T extends Material>(m: T): T { this.owned.push(m); return m; }

  mesh(geo: BufferGeometry, mat: Material, parent: Object3D = this.root, x = 0, y = 0, z = 0): Mesh {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  }

  group(parent: Object3D, x = 0, y = 0, z = 0): Group {
    const g = new Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }

  /** Smoothly turns this.yaw toward the target (or an idle sweep) and returns it. */
  track(a: Anim, s: Structure, rate: number): number {
    const sx = this.root.position.x;
    const sz = this.root.position.z;
    const idle = hash01(s.id) * 6.283 + 0.7 * Math.sin(a.t * 0.35 + s.id);
    const want = a.hasT ? Math.atan2(a.tz - sz, a.tx - sx) : idle;
    this.yaw = approachAngle(this.yaw, want, rate * (a.hasT ? 1 : 0.25) * a.dt);
    return this.yaw;
  }

  /** Applies damage tint, crack heat, hit flash and glow flicker to all owned materials. */
  finish(a: Anim): void {
    const cr = a.crack * 0.55;
    for (const t of this.tints) {
      t.m.color.copy(t.base).multiplyScalar(a.darken);
      t.m.emissive.setRGB(cr + a.flash * 0.7, cr * 0.32 + a.flash * 0.7, cr * 0.04 + a.flash * 0.7);
    }
    const k = a.flick * a.glowMul;
    for (const g of this.glows) g.m.emissiveIntensity = g.base * k;
  }

  dispose(): void {
    for (const m of this.owned) m.dispose();
    this.owned.length = 0;
    this.root.removeFromParent();
  }

  toView(update: (s: Structure, a: Anim) => void): StructureView {
    return {
      root: this.root,
      update: (s, a) => { update(s, a); this.finish(a); },
      dispose: () => this.dispose(),
    };
  }
}
