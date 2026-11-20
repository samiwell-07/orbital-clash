import { BoxGeometry, CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Player, Rock, World } from '@/types';
import { SHIP_MAX_SPEED, TICK_DT } from '@/config/constants';
import { assemble, box, cached, coneX, cylX, slab, sph } from '@/render/instancing/kit';
import type { PartSpec } from '@/render/instancing/kit';
import { TEAM_GLOW, teamIndex } from '@/render/instancing/colorTables';
import { beamMat, glowMat, stdMat } from './materials';
import { approachAngle, clamp01 } from './motion';
import type { FrameInfo, ModelSystem } from './types';

const HOVER_Y = 1.0;
const SHIP_SCALE = 0.4;
const D = 0x30343e;
const W = 0xffffff;
const X_AXIS = new Vector3(1, 0, 0);

const hullGeometry = (): BufferGeometry => assemble([
  { g: coneX(0.3, 1.6, 5), p: [0.15, 0, 0], r: [Math.PI / 5, 0, 0], c: 0xc9ced8 },
  { g: sph(0.3, 8, 5), p: [-0.35, 0.02, 0], s: [1.6, 0.55, 0.9], c: 0x9aa0ac, smooth: true },
  { g: cylX(0.16, 0.5, 8), p: [-0.8, 0, 0.42], c: D },
  { g: cylX(0.16, 0.5, 8), p: [-0.8, 0, -0.42], c: D },
  { g: box(0.5, 0.05, 0.1), p: [-0.55, 0, 0.22], c: D },
  { g: box(0.5, 0.05, 0.1), p: [-0.55, 0, -0.22], c: D },
]);

const trimGeometry = (): BufferGeometry => {
  const specs: PartSpec[] = [
    { g: slab([[0.45, 0.12], [-0.7, 1.05], [-0.95, 0.95], [-0.55, 0.12]], 0.06), p: [0, -0.04, 0], c: W },
    { g: slab([[0.45, -0.12], [-0.7, -1.05], [-0.95, -0.95], [-0.55, -0.12]], 0.06), p: [0, -0.04, 0], c: W },
    { g: box(0.5, 0.32, 0.04), p: [-0.8, 0.3, 0], c: W },
    { g: coneX(0.06, 0.3, 4), p: [1.0, 0, 0], c: W },
  ];
  return assemble(specs);
};

const engineGeometry = (): BufferGeometry => assemble([
  { g: sph(0.13, 6, 4), p: [-1.08, 0, 0.42], s: [1.6, 1, 1], smooth: true },
  { g: sph(0.13, 6, 4), p: [-1.08, 0, -0.42], s: [1.6, 1, 1], smooth: true },
]);

export interface ShipCraft {
  craft: Group;
  engine: Mesh;
}

/**
 * The player craft (hull, trim in `colorHex`, engine, canopy) at unit model scale; shared by the in-game ship and
 * the lobby preview. `own` receives every material created (for disposal); geometries are shared via `cached`.
 */
export function buildShipCraftParts(colorHex: number, own: <T extends Material>(m: T) => T = (m) => m): ShipCraft {
  const craft = new Group();
  const trimMat = own(stdMat(colorHex, 0.5, 0.35));
  trimMat.emissive = new Color(colorHex);
  trimMat.emissiveIntensity = 0.9;
  const engineMat = own(glowMat(0x9fe0ff, 3.8));
  const canopyMat = own(glowMat(0x9fe0ff, 1.3));
  const parts: [BufferGeometry, Material][] = [
    [cached('ship:hull', hullGeometry), own(stdMat(0xffffff, 0.75, 0.32))],
    [cached('ship:trim', trimGeometry), trimMat],
    [cached('ship:engine', engineGeometry), engineMat],
    [cached('ship:canopy', () => sph(0.17, 8, 5).scale(1.5, 0.7, 0.8).translate(0.25, 0.16, 0)), canopyMat],
  ];
  let engine!: Mesh;
  for (const [g, m] of parts) {
    const mesh = new Mesh(g, m);
    mesh.castShadow = true;
    craft.add(mesh);
    if (m === engineMat) engine = mesh;
  }
  return { craft, engine };
}

export function buildShipCraft(colorHex: number, own?: <T extends Material>(m: T) => T): Group {
  return buildShipCraftParts(colorHex, own).craft;
}

interface ShipView {
  root: Group;
  craft: Group;
  engine: Mesh;
  beam: Group;
  beamCore: Mesh;
  shadow: Mesh;
  yaw: number;
  roll: number;
  lastYaw: number;
}

/** One hovering craft per live player (banking from velocity, engine glow) plus a tractor beam to the carried rock. */
export class ShipSystem implements ModelSystem {
  readonly group = new Group();
  private readonly views: (ShipView | undefined)[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private readonly dir = new Vector3();
  private readonly quat = new Quaternion();

  load(_world: World): void {
    for (const v of this.views) { v?.root.removeFromParent(); v?.beam.removeFromParent(); }
    this.views.length = 0;
    for (const d of this.owned) d.dispose();
    this.owned.length = 0;
  }

  update(f: FrameInfo): void {
    const players = f.world.players;
    const alpha = clamp01(f.alpha);
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const live = p.controller !== 'none' && p.alive;
      let v = this.views[i];
      if (!live) {
        if (v) { v.root.visible = false; v.beam.visible = false; }
        continue;
      }
      if (!v) v = this.create(i);
      v.root.visible = true;
      this.pose(v, p, f, alpha);
    }
  }

  dispose(): void {
    for (const d of this.owned) d.dispose();
    this.owned.length = 0;
    this.views.length = 0;
    this.group.removeFromParent();
  }

  private pose(v: ShipView, p: Player, f: FrameInfo, alpha: number): void {
    const s = p.ship;
    const x = s.x + s.vx * alpha * TICK_DT;
    const z = s.y + s.vy * alpha * TICK_DT;
    const speed = Math.hypot(s.vx, s.vy);
    const hover = Math.sin(f.now * 2.4 + p.id) * 0.05;
    const y = HOVER_Y + hover;
    v.root.position.set(x, y, z);
    if (speed > 0.4) v.yaw = approachAngle(v.yaw, Math.atan2(s.vy, s.vx), 9 * f.dt);
    const turn = (v.yaw - v.lastYaw) / Math.max(1e-3, f.dt);
    v.lastYaw = v.yaw;
    v.roll += (Math.max(-0.7, Math.min(0.7, turn * 0.12)) - v.roll) * Math.min(1, f.dt * 8);
    const k = Math.min(1, speed / SHIP_MAX_SPEED);
    v.craft.rotation.set(v.roll, -v.yaw, -k * 0.22, 'YZX');
    v.engine.scale.set(1 + k * 0.5, 1 + 0.12 * Math.sin(f.now * 40 + p.id), 1);
    v.shadow.position.y = 0.03 - y;
    v.shadow.scale.setScalar(0.4 - hover);
    this.updateBeam(v, p, f, x, y, z);
  }

  private updateBeam(v: ShipView, p: Player, f: FrameInfo, x: number, y: number, z: number): void {
    const rocks: readonly Rock[] = f.world.rocks;
    let rock: Rock | undefined;
    if (p.ship.carrying !== 0) {
      for (let i = 0; i < rocks.length; i++) if (rocks[i].id === p.ship.carrying) { rock = rocks[i]; break; }
    }
    v.beam.visible = rock !== undefined;
    if (!rock) return;
    const tx = rock.x - x;
    const ty = 0.85 - y;
    const tz = rock.y - z;
    const len = Math.max(1e-3, Math.hypot(tx, ty, tz));
    this.dir.set(tx / len, ty / len, tz / len);
    this.quat.setFromUnitVectors(X_AXIS, this.dir);
    v.beam.position.set(x + tx / 2, y + ty / 2, z + tz / 2);
    v.beam.quaternion.copy(this.quat);
    v.beam.scale.set(len, 1, 1);
    const w = 0.75 + 0.25 * Math.sin(f.now * 25);
    v.beamCore.scale.set(1, w, w);
  }

  private create(i: number): ShipView {
    const team = teamIndex(i);
    const own = <T extends Material>(m: T): T => { this.owned.push(m); return m; };
    const root = new Group();
    const { craft, engine } = buildShipCraftParts(TEAM_GLOW[team], own);
    craft.scale.setScalar(SHIP_SCALE);
    root.add(craft);
    const shadowMat = own(new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    const shadow = new Mesh(cached('ship:shadow', () => new CircleGeometry(1, 16).rotateX(-Math.PI / 2)), shadowMat);
    root.add(shadow);

    const beam = new Group();
    const beamCore = new Mesh(cached('ship:beamcore', () => new BoxGeometry(1, 0.035, 0.035)), own(beamMat(0xeaffef, 3, 0.95)));
    const beamHalo = new Mesh(cached('ship:beamhalo', () => new BoxGeometry(1, 0.14, 0.14)), own(beamMat(0x9dffb0, 2, 0.35)));
    beam.add(beamCore, beamHalo);
    beam.visible = false;
    this.group.add(root, beam);
    const v: ShipView = { root, craft, engine, beam, beamCore, shadow, yaw: -Math.PI / 2, roll: 0, lastYaw: -Math.PI / 2 };
    this.views[i] = v;
    return v;
  }
}
