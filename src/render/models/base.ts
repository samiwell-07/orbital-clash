import { Group, TorusGeometry } from 'three';
import type { MeshBasicMaterial } from 'three';
import type { Player, World } from '@/types';
import { PLAYER_IDS } from '@/types';
import { cached, cyl, sph } from '@/render/instancing/kit';
import { TEAM_GLOW, teamIndex } from '@/render/instancing/colorTables';
import { beamMat } from './materials';
import { clamp01 } from './motion';
import { ViewBuilder, newAnim } from './structures/common';
import type { GlowRef } from './structures/common';
import type { FrameInfo, ModelSystem } from './types';

/** Tile radius of the base sphere (diameter one tile). */
export const BASE_RADIUS = 0.5;
const CORE_FULL = 4.2;
const HALO_OPACITY = 0.22;
/** Seconds the sphere stays fully lit after its owner launched units. */
const LAUNCH_HOLD = 0.4;

const ownerSlot = (owner: number): number => (owner >= 0 && owner < PLAYER_IDS.length ? owner | 0 : 0);

interface BaseView {
  b: ViewBuilder;
  core: GlowRef;
  halo: MeshBasicMaterial;
  level: number;
}

/** True while the player is releasing units (recent launch event, or a locked attack with stock left). */
function attacking(p: Player, now: number, lastLaunch: number): boolean {
  if (now - lastLaunch <= LAUNCH_HOLD) return true;
  const k = p.attack.selected;
  return p.attack.locked && k !== null && (p.stored[k] ?? 0) > 0;
}

/** Target sphere brightness 0..1: 1 while attacking or healing (`ship.healing`), a dim slow pulse at idle. */
export function baseBrightness(p: Player, now: number, lastLaunch: number): number {
  if (!p.alive) return 0.06;
  if (p.ship.healing || attacking(p, now, lastLaunch)) return 1;
  return 0.1 + 0.03 * Math.sin(now * 1.6 + p.id);
}

/** Player bases: a one-tile LED sphere in the team glow, dim at idle and fully lit while attacking or healing. */
export class BaseSystem implements ModelSystem {
  readonly group = new Group();
  private readonly views: (BaseView | undefined)[] = [];
  private readonly flash: number[] = PLAYER_IDS.map(() => -99);
  private readonly launch: number[] = PLAYER_IDS.map(() => -99);
  private readonly anim = newAnim();

  load(_world: World): void {
    for (const v of this.views) v?.b.dispose();
    this.views.length = 0;
    this.flash.fill(-99);
    this.launch.fill(-99);
  }

  update(f: FrameInfo): void {
    for (const e of f.events) {
      if (e.t === 'baseHit') this.flash[ownerSlot(e.target)] = f.now;
      else if (e.t === 'unitLaunched') this.launch[ownerSlot(e.owner)] = f.now;
    }
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
    const want = baseBrightness(p, f.now, this.launch[idx]);
    v.level += (want - v.level) * Math.min(1, f.dt * (want > v.level ? 14 : 5));
    const lvl = Math.min(1.4, v.level + flash * 0.6);
    a.t = f.now; a.dt = f.dt; a.team = teamIndex(p.id);
    a.darken = alive ? 1 : 0.35;
    a.crack = alive ? 0 : 0.5;
    a.flash = flash * 0.5;
    a.flick = alive ? 1 : 0.5 + 0.3 * Math.sin(f.now * 17);
    a.glowMul = 1;
    v.core.base = CORE_FULL * lvl;
    v.halo.opacity = alive ? HALO_OPACITY * lvl : 0;
    v.b.finish(a);
  }

  private create(i: number): BaseView {
    const team = teamIndex(i);
    const hex = TEAM_GLOW[team];
    const b = new ViewBuilder(team);
    b.mesh(cached('base:plinth', () => cyl(0.4, 0.46, 0.06, 24)), b.body(0x9ea5b2, 0.7, 0.42, false), b.root, 0, 0.03, 0);
    b.trim(cached('base:footring', () => new TorusGeometry(0.43, 0.02, 4, 32).rotateX(Math.PI / 2)), b.root, 0, 0.065, 0);
    const core = b.glow(hex, CORE_FULL);
    b.mesh(cached('base:sphere', () => sph(BASE_RADIUS, 32, 20)), core.m, b.root, 0, BASE_RADIUS, 0);
    const halo = b.own(beamMat(hex, 1.6, HALO_OPACITY));
    b.mesh(cached('base:halo', () => sph(0.62, 24, 14)), halo, b.root, 0, BASE_RADIUS, 0).castShadow = false;
    this.group.add(b.root);
    const view: BaseView = { b, core, halo, level: 0.1 };
    this.views[i] = view;
    return view;
  }
}