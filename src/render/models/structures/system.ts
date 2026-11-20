import { Group, MeshBasicMaterial } from 'three';
import { WEAPON_DEFS } from '@/data';
import type { Structure, WeaponKind, World } from '@/types';
import { teamIndex } from '@/render/instancing/colorTables';
import { clamp01, easeOutBack } from '../motion';
import { crackGlow, damageDarken, flicker, hpRatio, smokeAmount } from '../damage';
import type { FrameInfo, ModelSystem } from '../types';
import { newAnim } from './common';
import type { StructureView } from './common';
import { VIEW_FACTORIES } from './index';
import { maxLevelOf, platformVariant } from './marks';
import { PlatformSet } from './platform';
import type { PlatRec } from './platform';
import { SmokePlume } from './smoke';

const BUILD_SECONDS = 0.7;
const FLASH_SECONDS = 0.25;

interface Rec {
  view: StructureView;
  plat: PlatRec;
  born: number;
  seen: number;
  kind: string;
  team: number;
  smoke: SmokePlume | null;
}

/** 1 right after a weapon fired (cooldown just reset), decaying to 0 over ~0.15 s. */
export function shotPulse(s: Structure): number {
  const w = (WEAPON_DEFS as Record<string, (typeof WEAPON_DEFS)[WeaponKind] | undefined>)[s.kind];
  if (!w) return 0;
  const cd = w.cooldown[Math.min(s.level, w.cooldown.length - 1)];
  const win = Math.min(0.15, cd * 0.5);
  return clamp01((s.cooldown - (cd - win)) / win);
}

/** Diffs world.structures by id into per-structure views + instanced platforms. */
export class StructureSystem implements ModelSystem {
  readonly group = new Group();
  private readonly platforms = new PlatformSet();
  private readonly recs = new Map<number, Rec>();
  private readonly flash = new Map<number, number>();
  private readonly anim = newAnim();
  private readonly smokeMat = new MeshBasicMaterial({ color: 0x15161b, transparent: true, opacity: 0.4, depthWrite: false });
  private fresh = true;
  private stamp = 0;

  constructor() { this.group.add(this.platforms.group); }

  load(_world: World): void {
    for (const id of [...this.recs.keys()]) this.remove(id);
    this.flash.clear();
    this.fresh = true;
  }

  update(f: FrameInfo): void {
    const a = this.anim;
    this.stamp++;
    for (const e of f.events) if (e.t === 'structureHit') this.flash.set(e.id, f.now);
    for (const s of f.world.structures.values()) {
      const team = teamIndex(s.owner);
      let rec = this.recs.get(s.id);
      if (rec && (rec.kind !== s.kind || rec.team !== team)) { this.remove(s.id); rec = undefined; }
      if (!rec) rec = this.create(s, team, f.now);
      rec.seen = this.stamp;
      this.fillAnim(s, rec, f);
      const root = rec.view.root;
      const ease = easeOutBack(a.build);
      const sy = Math.max(0.01, ease);
      const sxz = 0.55 + 0.45 * Math.min(1, ease);
      root.position.set(s.tx + 0.5, 0, s.ty + 0.5);
      root.scale.set(sxz, sy, sxz);
      this.platforms.place(rec.plat, s.tx + 0.5, s.ty + 0.5, platformVariant(s.level, maxLevelOf(s.kind)), sxz, sy, a.darken, team);
      rec.view.update(s, a);
      this.updateSmoke(rec, s, a.ratio, f.now);
    }
    for (const [id, rec] of this.recs) if (rec.seen !== this.stamp) this.remove(id);
    this.fresh = false;
  }

  dispose(): void {
    for (const id of [...this.recs.keys()]) this.remove(id);
    this.platforms.dispose();
    this.smokeMat.dispose();
    this.group.removeFromParent();
  }

  private create(s: Structure, team: number, now: number): Rec {
    const view = VIEW_FACTORIES[s.kind](team);
    this.group.add(view.root);
    const rec: Rec = {
      view, plat: this.platforms.newRec(), born: this.fresh ? now - 10 : now, seen: this.stamp, kind: s.kind, team, smoke: null,
    };
    this.recs.set(s.id, rec);
    return rec;
  }

  private remove(id: number): void {
    const rec = this.recs.get(id);
    if (!rec) return;
    this.platforms.release(rec.plat);
    rec.view.dispose();
    rec.smoke?.group.removeFromParent();
    this.recs.delete(id);
    this.flash.delete(id);
  }

  private fillAnim(s: Structure, rec: Rec, f: FrameInfo): void {
    const a = this.anim;
    a.t = f.now;
    a.dt = f.dt;
    a.team = rec.team;
    a.ratio = hpRatio(s.hp, s.maxHp);
    a.darken = damageDarken(a.ratio);
    a.crack = crackGlow(a.ratio);
    a.flick = flicker(a.ratio, s.id, f.now);
    const ft = this.flash.get(s.id);
    a.flash = ft === undefined ? 0 : clamp01(1 - (f.now - ft) / FLASH_SECONDS);
    let build = clamp01((f.now - rec.born) / BUILD_SECONDS);
    if (s.buildProgress > 0 && s.buildProgress < 1) build = Math.min(build, s.buildProgress);
    a.build = build;
    a.glowMul = 1 + (1 - build) * 2;
    a.hasT = false;
    if (s.targetId !== 0) {
      const p = f.targets.get(s.targetId);
      if (p) { a.hasT = true; a.tx = p.x; a.tz = p.y; }
    }
    a.shot = shotPulse(s);
  }

  private updateSmoke(rec: Rec, s: Structure, ratio: number, now: number): void {
    const amount = smokeAmount(ratio);
    if (amount <= 0) { if (rec.smoke) rec.smoke.group.visible = false; return; }
    if (!rec.smoke) {
      rec.smoke = new SmokePlume(this.smokeMat, s.id);
      rec.view.root.add(rec.smoke.group);
    }
    rec.smoke.group.visible = true;
    rec.smoke.update(now, amount);
  }
}
