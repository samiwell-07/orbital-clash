import { describe, expect, it } from 'vitest';
import { InstancedPool, SlotAllocator } from '@/render/instancing/InstancedPool';
import {
  TEAM_BODY, TEAM_GLINT, TEAM_GLOW, UNIT_ICON_COLORS, hash01, hexToRgb, jitterFactor, laserColor, lerpHex, unitIconColor,
} from '@/render/instancing/colorTables';
import { PLAYER_COLORS, ALL_UNITS } from '@/types';
import { GROWN_VARIANT, maxLevelOf, platformVariant, upgradeMarks } from '@/render/models/structures/marks';
import { crackGlow, damageDarken, flicker, hpRatio, shieldRing, smokeAmount, storageGlow } from '@/render/models/damage';
import { angleDiff, approachAngle, bobHeight, snakeBobPhase } from '@/render/models/motion';
import { BoxGeometry, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import type { Material, MeshStandardMaterial } from 'three';
import { buildShipCraft } from '@/render/models/ship';
import { createShipPreview } from '@/render/preview';

describe('SlotAllocator / InstancedPool', () => {
  it('reuses released indices before growing the high-water mark', () => {
    const a = new SlotAllocator();
    expect([a.alloc(), a.alloc(), a.alloc()]).toEqual([0, 1, 2]);
    a.release(1);
    expect(a.alloc()).toBe(1);
    expect(a.highWater).toBe(3);
    expect(a.used).toBe(3);
  });

  it('ignores double release and invalid indices', () => {
    const a = new SlotAllocator();
    a.alloc();
    expect(a.release(0)).toBe(true);
    expect(a.release(0)).toBe(false);
    expect(a.release(5)).toBe(false);
    expect(a.alloc()).toBe(0);
    expect(a.alloc()).toBe(1);
  });

  it('grows capacity while preserving matrices and colours', () => {
    const pool = new InstancedPool(new BoxGeometry(), new MeshBasicMaterial(), 2);
    const m = new Matrix4().makeTranslation(1, 2, 3);
    pool.begin();
    pool.push(m, 0.5, 0.25, 0.125);
    for (let i = 0; i < 9; i++) pool.push(new Matrix4().makeTranslation(i, 0, 0));
    pool.end();
    expect(pool.capacity).toBeGreaterThanOrEqual(10);
    expect(pool.count).toBe(10);
    const arr = pool.mesh.instanceMatrix.array as Float32Array;
    expect(arr[12]).toBe(1);
    expect(arr[13]).toBe(2);
    expect(pool.mesh.instanceColor!.array[0]).toBe(0.5);
    expect(pool.mesh.instanceColor!.array[2]).toBe(0.125);
  });

  it('hides freed slots and hands them out again', () => {
    const pool = new InstancedPool(new BoxGeometry(), new MeshBasicMaterial(), 4);
    const i = pool.alloc();
    pool.setAt(i, new Matrix4().makeTranslation(5, 5, 5));
    pool.free(i);
    const arr = pool.mesh.instanceMatrix.array as Float32Array;
    expect(arr[i * 16 + 12]).toBe(0);
    expect(arr[i * 16 + 0]).toBe(0);
    expect(pool.alloc()).toBe(i);
  });
});

describe('colour tables', () => {
  it('has one entry per palette colour, keeps the original four, and glow equals PLAYER_COLORS', () => {
    expect(TEAM_BODY).toHaveLength(PLAYER_COLORS.length);
    expect(TEAM_GLINT).toHaveLength(PLAYER_COLORS.length);
    expect(TEAM_BODY.slice(0, 4)).toEqual([0x2a9fd8, 0xc0222b, 0x9b44e6, 0xffc21a]);
    expect(TEAM_GLINT.slice(0, 4)).toEqual([0x8fe8ff, 0xf0f0f0, 0xe9d6ff, 0xff7a1a]);
    expect(TEAM_GLOW).toEqual(PLAYER_COLORS);
  });

  it('gives every unit kind an icon colour and a grey fallback', () => {
    for (const k of ALL_UNITS) expect(UNIT_ICON_COLORS[k]).toBeGreaterThan(0);
    expect(unitIconColor('tank')).toBe(UNIT_ICON_COLORS.tank);
    expect(unitIconColor(null)).not.toBe(UNIT_ICON_COLORS.scout);
  });

  it('jitters lightness within +-8 % deterministically', () => {
    for (let id = 0; id < 500; id++) {
      const j = jitterFactor(id);
      expect(j).toBeGreaterThanOrEqual(0.92);
      expect(j).toBeLessThanOrEqual(1.08);
      expect(j).toBe(jitterFactor(id));
      const h = hash01(id);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });

  it('converts and interpolates hex colours; laser colour runs cyan to pink', () => {
    const out = [0, 0, 0];
    hexToRgb(0xffffff, out);
    expect(out).toEqual([1, 1, 1]);
    expect(lerpHex(0x000000, 0xff0000, 0.5)).toBe(0x800000);
    expect(laserColor(0, 3)).toBe(0x4dd8ff);
    expect(laserColor(3, 3)).toBe(0xff4dd2);
    expect(laserColor(0, 0)).toBe(0x4dd8ff);
  });
});

describe('ship craft', () => {
  it('builds hull, trim, engine and canopy with the trim in the given colour', () => {
    const mats: Material[] = [];
    const craft = buildShipCraft(0x3ee07a, (m) => { mats.push(m); return m; });
    const meshes = craft.children.filter((c): c is Mesh => c instanceof Mesh);
    expect(meshes).toHaveLength(4);
    expect(mats).toHaveLength(4);
    const trim = meshes[1].material as MeshStandardMaterial;
    expect(trim.color.getHex()).toBe(0x3ee07a);
    expect(trim.emissive.getHex()).toBe(0x3ee07a);
    const other = buildShipCraft(0xff5fc8).children[1] as Mesh;
    expect((other.material as MeshStandardMaterial).emissive.getHex()).toBe(0xff5fc8);
  });

  it('returns no preview (instead of throwing) without WebGL', () => {
    expect(createShipPreview(64)).toBeNull();
  });
});

describe('upgrade level -> platform marks', () => {
  it('shows one mark per level and grows at max level', () => {
    expect(upgradeMarks(0, 3)).toEqual({ marks: 0, grown: false });
    expect(upgradeMarks(1, 3)).toEqual({ marks: 1, grown: false });
    expect(upgradeMarks(2, 3)).toEqual({ marks: 2, grown: false });
    expect(upgradeMarks(3, 3)).toEqual({ marks: 3, grown: true });
  });

  it('never grows structures without upgrades', () => {
    expect(upgradeMarks(0, 0)).toEqual({ marks: 0, grown: false });
    expect(platformVariant(0, 0)).toBe(0);
  });

  it('maps to geometry variants and reads max levels from the data defs', () => {
    expect(platformVariant(2, 3)).toBe(2);
    expect(platformVariant(3, 3)).toBe(GROWN_VARIANT);
    expect(maxLevelOf('turret')).toBe(3);
    expect(maxLevelOf('specialOps')).toBe(2);
    expect(maxLevelOf('harvester')).toBe(3);
    expect(maxLevelOf('researchLab')).toBe(0);
  });
});

describe('damage maths', () => {
  it('darkens monotonically as hp falls', () => {
    expect(damageDarken(1)).toBe(1);
    expect(damageDarken(0)).toBeCloseTo(0.45, 5);
    expect(damageDarken(0.5)).toBeGreaterThan(damageDarken(0.2));
    expect(hpRatio(50, 0)).toBe(1);
    expect(hpRatio(150, 100)).toBe(1);
  });

  it('shows cracks below 40 % and smoke below 25 %', () => {
    expect(crackGlow(0.5)).toBe(0);
    expect(crackGlow(0)).toBe(1);
    expect(smokeAmount(0.3)).toBe(0);
    expect(smokeAmount(0.125)).toBeCloseTo(0.5, 5);
  });

  it('only flickers when badly damaged and stays within 0.4..1', () => {
    expect(flicker(0.9, 3, 1.234)).toBe(1);
    for (let t = 0; t < 5; t += 0.07) {
      const v = flicker(0.05, 7, t);
      expect(v).toBeGreaterThanOrEqual(0.4);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('dims base shield rings from the outside as hits approach maxHits', () => {
    expect(shieldRing(0, 3, 0, 10)).toBe(1);
    expect(shieldRing(2, 3, 0, 10)).toBe(1);
    expect(shieldRing(2, 3, 5, 10)).toBeLessThan(shieldRing(0, 3, 5, 10));
    expect(shieldRing(0, 3, 10, 10)).toBeCloseTo(0.12, 5);
    expect(storageGlow(0, 1000)).toBeLessThan(storageGlow(10, 1000));
    expect(storageGlow(1000, 1000)).toBeCloseTo(1, 5);
  });
});

describe('motion helpers', () => {
  it('offsets bob phase along the train and keeps hop height within amplitude', () => {
    expect(snakeBobPhase(3, 7, 1)).not.toBe(snakeBobPhase(4, 7, 1));
    expect(snakeBobPhase(3, 7, 1)).toBeLessThan(snakeBobPhase(2, 7, 1));
    for (let t = 0; t < 4; t += 0.05) {
      const h = bobHeight(snakeBobPhase(5, 11, t), 0.05);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0.05);
    }
  });

  it('turns the short way round', () => {
    expect(angleDiff(0.1, -0.1)).toBeCloseTo(-0.2, 6);
    expect(angleDiff(3.0, -3.0)).toBeCloseTo(2 * Math.PI - 6, 6);
    expect(approachAngle(0, 1, 0.25)).toBeCloseTo(0.25, 6);
    expect(approachAngle(0, 0.1, 0.25)).toBeCloseTo(0.1, 6);
  });
});
