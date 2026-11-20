import { CylinderGeometry, Group, SphereGeometry, TorusGeometry } from 'three';
import type { Mesh } from 'three';
import { STORAGE_CAP } from '@/config/constants';
import type { Player, UnitKind, World } from '@/types';
import { assemble, box, cached, coneX, cyl, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { TEAM_GLOW, teamIndex } from '@/render/instancing/colorTables';
import { beamMat } from './materials';
import { clamp01 } from './motion';
import { shieldRing, storageGlow } from './damage';
import { ViewBuilder, newAnim } from './structures/common';
import type { GlowRef } from './structures/common';
import type { FrameInfo, ModelSystem } from './types';

/** Tile radius of the fortress footprint (it spills over neighbouring tiles by design: it is the big thing). */
export const BASE_RADIUS = 1.0;
const RINGS = 3;
const W = 0xffffff;
const D = 0x4a4e58;

const ownerSlot = (owner: number): number => (owner >= 0 && owner < 4 ? owner | 0 : 0);

interface BaseView {
  b: ViewBuilder;
  rings: GlowRef[];
  ringMeshes: Mesh[];
  core: GlowRef;
  coreMesh: Mesh;
  column: Mesh;
  dome: { opacity: number };
}

function fortressGeometry() {
  const specs: PartSpec[] = [
    { g: cyl(1.0, 1.1, 0.16, 6), p: [0, 0.08, 0], c: 0x6a707a },
    { g: cyl(0.82, 0.92, 0.14, 6), p: [0, 0.23, 0], c: W },
    { g: cyl(0.58, 0.7, 0.2, 6), p: [0, 0.4, 0], c: D },
    { g: cyl(0.3, 0.4, 0.3, 6), p: [0, 0.65, 0], c: W },
    { g: cyl(0.22, 0.28, 0.05, 6), p: [0, 0.83, 0], c: D },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = Math.cos(a) * 0.95;
    const z = Math.sin(a) * 0.95;
    specs.push({ g: box(0.3, 0.3, 0.3), p: [x, 0.3, z], r: [0, -a, 0], c: W });
    specs.push({ g: coneX(0.09, 0.34, 4), p: [x, 0.58, z], r: [0, 0, Math.PI / 2], c: D });
    specs.push({ g: box(0.16, 0.1, 0.5), p: [Math.cos(a + 0.52) * 0.7, 0.5, Math.sin(a + 0.52) * 0.7], r: [0, -a - 0.52, 0], c: D });
  }
  return assemble(specs);
}

/** Player bases: hex fortress, shield rings that dim with hits taken, and a core glowing with the stored unit count. */
export class BaseSystem implements ModelSystem {
  readonly group = new Group();
  private readonly views: (BaseView | undefined)[] = [];
  private readonly flash: number[] = [-99, -99, -99, -99];
  private readonly anim = newAnim();

  load(_world: World): void {
    for (const v of this.views) v?.b.dispose();
    this.views.length = 0;
    this.flash.fill(-99);
  }

  update(f: FrameInfo): void {
    for (const e of f.events) if (e.t === 'baseHit') this.flash[ownerSlot(e.target)] = f.now;
    const players = f.world.players;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      let v = this.views[i];
      if (p.controller === 'none' || !p.baseBuilt) { if (v) v.b.root.visible = false; continue; }
      if (!v) v = this.create(i);
      v.b.root.visible = true;
      this.pose(v, p, f);
    }
  }

  dispose(): void {
    for (const v of this.views) v?.b.dispose();
    this.views.length = 0;
    this.group.removeFromParent();
  }

  private pose(v: BaseView, p: Player, f: FrameInfo): void {
    const a = this.anim;
    const idx = ownerSlot(p.id);
    v.b.root.position.set(p.baseTx + 0.5, 0, p.baseTy + 0.5);
    const alive = p.alive;
    const flash = clamp01(1 - (f.now - this.flash[idx]) / 0.35);
    a.t = f.now; a.dt = f.dt; a.team = teamIndex(p.id);
    a.darken = alive ? 1 : 0.35;
    a.crack = alive ? 0 : 0.5;
    a.flash = flash * 0.5;
    a.flick = alive ? 1 : 0.5 + 0.3 * Math.sin(f.now * 17);
    a.glowMul = 1;
    for (let i = 0; i < RINGS; i++) {
      const lvl = alive ? shieldRing(i, RINGS, p.hits, p.maxHits) : 0;
      v.rings[i].base = 0.2 + lvl * 3.2 + flash * 4 * lvl;
      v.ringMeshes[i].rotation.y = f.now * (0.35 + i * 0.15) * (i % 2 ? -1 : 1);
      v.ringMeshes[i].visible = alive;
    }
    let stored = 0;
    for (const k in p.stored) stored += p.stored[k as UnitKind] ?? 0;
    const glow = alive ? storageGlow(stored, STORAGE_CAP) : 0.05;
    v.core.base = 0.8 + 5 * glow + 1.2 * Math.sin(f.now * 3 + idx);
    v.coreMesh.scale.setScalar(0.8 + 0.5 * glow + flash * 0.3);
    v.column.scale.set(1, 0.2 + glow * 2.2, 1);
    v.column.position.y = 0.9 + v.column.scale.y * 0.45;
    v.column.visible = alive;
    v.dome.opacity = alive ? 0.03 + 0.07 * shieldRing(0, 1, p.hits, p.maxHits) + flash * 0.2 : 0;
    v.b.finish(a);
  }

  private create(i: number): BaseView {
    const team = teamIndex(i);
    const hex = TEAM_GLOW[team];
    const b = new ViewBuilder(team);
    const body = b.body(0x9ea5b2, 0.7, 0.42);
    b.mesh(cached('base:fortress', fortressGeometry), body);
    b.trim(cached('base:ring', () => new TorusGeometry(1.02, 0.035, 4, 6).rotateX(Math.PI / 2)), b.root, 0, 0.17, 0);
    b.trim(cached('base:ring2', () => new TorusGeometry(0.6, 0.03, 4, 6).rotateX(Math.PI / 2)), b.root, 0, 0.52, 0);
    const rings: GlowRef[] = [];
    const ringMeshes: Mesh[] = [];
    for (let r = 0; r < RINGS; r++) {
      const g = b.glow(hex, 3);
      rings.push(g);
      ringMeshes.push(b.mesh(cached(`base:shield${r}`, () => new TorusGeometry(1.12 + r * 0.17, 0.028, 5, 48).rotateX(Math.PI / 2)), g.m, b.root, 0, 0.5 + r * 0.18, 0));
      ringMeshes[r].castShadow = false;
    }
    const core = b.glow(hex, 4);
    const coreMesh = b.mesh(cached('base:core', () => sph(0.2, 12, 8)), core.m, b.root, 0, 0.98, 0);
    const colMat = b.own(beamMat(hex, 2, 0.5));
    const column = b.mesh(cached('base:column', () => new CylinderGeometry(0.05, 0.09, 1, 8, 1, true)), colMat, b.root, 0, 1.2, 0);
    column.castShadow = false;
    const domeMat = b.own(beamMat(hex, 1, 0.08));
    const dome = b.mesh(cached('base:dome', () => new SphereGeometry(1.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.55, 1)), domeMat, b.root, 0, 0.3, 0);
    dome.castShadow = false;
    this.group.add(b.root);
    const view: BaseView = { b, rings, ringMeshes, core, coreMesh, column, dome: domeMat };
    this.views[i] = view;
    return view;
  }
}
