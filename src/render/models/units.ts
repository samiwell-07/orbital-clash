import { CircleGeometry, Group, Matrix4, MeshBasicMaterial } from 'three';
import { UNIT_DEFS } from '@/data';
import { TICK_DT } from '@/config/constants';
import { PALETTE_SIZE } from '@/config/playerColors';
import type { UnitKind, World } from '@/types';
import { ALL_UNITS } from '@/types';
import { InstancedPool } from '@/render/instancing/InstancedPool';
import { composeYaw } from '@/render/instancing/kit';
import { VIS, getUnitModel, disposeUnitModels } from '@/render/instancing/unitGeometries';
import { jitterFactor, teamIndex, unitTint } from '@/render/instancing/colorTables';
import { bobHeight, clamp01, snakeBobPhase } from './motion';
import { unitBodyMat, unitGlowMat } from './materials';
import type { FrameInfo, ModelSystem } from './types';

/** Hover altitude (tiles) of airborne / floating kinds. */
const HOVER: Partial<Record<UnitKind, number>> = { drone: 0.55, dragon: 0.95, carrier: 0.7 };
const BOB_AMP = 0.05;
/** Above this many units only the first trainIndex < BOB_LOD_TRAIN units keep their hop animation. */
const BOB_LOD_UNITS = 1000;
const BOB_LOD_TRAIN = 20;
const KIND_COUNT = ALL_UNITS.length;
const KIND_INDEX = new Map<UnitKind, number>(ALL_UNITS.map((k, i) => [k, i]));

interface UnitSet { body: InstancedPool; glow: InstancedPool }

/** Every unit kind x team is two InstancedMeshes (lit body + emissive glow) fed from world.units each frame. */
export class UnitSystem implements ModelSystem {
  readonly group = new Group();
  private readonly sets: (UnitSet | undefined)[] = new Array(KIND_COUNT * PALETTE_SIZE).fill(undefined);
  private readonly shadow: InstancedPool;
  private readonly m = new Matrix4();
  private readonly shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false });

  constructor() {
    this.shadow = new InstancedPool(new CircleGeometry(1, 14).rotateX(-Math.PI / 2), this.shadowMat, 128);
    this.shadow.mesh.renderOrder = -1;
    this.group.add(this.shadow.mesh);
  }

  load(_world: World): void { /* pools are created lazily */ }

  update(f: FrameInfo): void {
    const units = f.world.units;
    const n = units.length;
    const alpha = clamp01(f.alpha);
    const lod = n > BOB_LOD_UNITS;
    for (const s of this.sets) if (s) { s.body.begin(); s.glow.begin(); }
    this.shadow.begin();
    const m = this.m;
    for (let i = 0; i < n; i++) {
      const u = units[i];
      if (u.state === 'dead') continue;
      const def = UNIT_DEFS[u.kind];
      const team = teamIndex(u.owner);
      const key = (KIND_INDEX.get(u.kind) ?? 0) * PALETTE_SIZE + team;
      const set = this.sets[key] ?? this.makeSet(u.kind, team, key);
      const step = u.state === 'marching' ? def.speed * alpha * TICK_DT : 0;
      const ch = Math.cos(u.heading);
      const sh = Math.sin(u.heading);
      const hover = HOVER[u.kind];
      let y = u.z;
      if (hover !== undefined) {
        y = Math.max(u.z, hover) + Math.sin(f.now * 2.2 + u.id) * 0.03;
      } else if (!lod || u.trainIndex < BOB_LOD_TRAIN) {
        y += bobHeight(snakeBobPhase(u.trainIndex, u.id, f.now), BOB_AMP);
      }
      const px = u.x + ch * step;
      const pz = u.y + sh * step;
      const sc = def.radius * VIS[u.kind];
      composeYaw(m, px, y, pz, ch, sh, sc, sc, sc);
      const j = jitterFactor(u.id);
      const hp = u.maxHp > 0 ? 0.55 + 0.45 * clamp01(u.hp / u.maxHp) : 1;
      const t = unitTint(u.kind);
      set.body.push(m, j * hp * t[0], j * hp * t[1], j * hp * t[2]);
      set.glow.push(m, j, j, j);
      if (hover !== undefined || u.layer === 'air') {
        const sr = def.radius * 0.85 * (1 - Math.min(0.4, y * 0.25));
        composeYaw(m, px + y * 0.25, 0.03, pz + y * 0.35, 1, 0, sr, 1, sr);
        this.shadow.push(m);
      }
    }
    for (const s of this.sets) if (s) { s.body.end(); s.glow.end(); }
    this.shadow.end();
  }

  dispose(): void {
    for (const s of this.sets) if (s) { s.body.dispose(); s.glow.dispose(); }
    this.sets.fill(undefined);
    this.shadow.dispose();
    this.shadowMat.dispose();
    this.shadow.mesh.geometry.dispose();
    disposeUnitModels();
    this.group.removeFromParent();
  }

  private makeSet(kind: UnitKind, team: number, key: number): UnitSet {
    const model = getUnitModel(kind, team);
    const body = new InstancedPool(model.body, unitBodyMat(team), 128);
    const glow = new InstancedPool(model.glow, unitGlowMat(team), 128);
    this.group.add(body.mesh, glow.mesh);
    const set = { body, glow };
    this.sets[key] = set;
    return set;
  }
}
