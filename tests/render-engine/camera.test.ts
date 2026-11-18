import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W } from '@/config/constants';
import { cameraPose, computeFitDistance } from '@/render/engine/camera';
import { QualityScaler } from '@/render/engine/quality';
import { ShakeState, SHAKE } from '@/render/engine/shake';

const FOV = 28;
const PITCH = 62;

/** Project a ground point with the camera produced by cameraPose; returns NDC. */
function ndc(distance: number, aspect: number, dx: number, dz: number): { x: number; y: number; depth: number } {
  const p = (PITCH * Math.PI) / 180;
  const depth = distance - dz * Math.cos(p);
  const t = Math.tan((FOV * Math.PI) / 360);
  return { x: dx / (depth * t * aspect), y: (-dz * Math.sin(p)) / (depth * t), depth };
}

describe('camera fit', () => {
  for (const [name, aspect] of [['16:9', 16 / 9], ['4:3', 4 / 3], ['21:9', 21 / 9]] as const) {
    it(`keeps the whole map inside the frustum at ${name}, and not much further`, () => {
      const d = computeFitDistance({ aspect, mapW: MAP_W, mapH: MAP_H, margin: 1 });
      let maxExtent = 0;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const q = ndc(d, aspect, (sx * MAP_W) / 2, (sz * MAP_H) / 2);
          expect(Math.abs(q.x)).toBeLessThanOrEqual(1 + 1e-9);
          expect(Math.abs(q.y)).toBeLessThanOrEqual(1 + 1e-9);
          maxExtent = Math.max(maxExtent, Math.abs(q.x), Math.abs(q.y));
        }
      }
      expect(maxExtent).toBeGreaterThan(0.999);
    });
  }

  it('matches the style guide distance (~64 tiles) at 16:9 and is further at 4:3', () => {
    const wide = computeFitDistance({ aspect: 16 / 9, mapW: MAP_W, mapH: MAP_H });
    const boxy = computeFitDistance({ aspect: 4 / 3, mapW: MAP_W, mapH: MAP_H });
    expect(wide).toBeGreaterThan(58);
    expect(wide).toBeLessThan(70);
    expect(boxy).toBeGreaterThan(wide);
  });

  it('places the eye south of and above the map centre at the given pitch', () => {
    const pose = cameraPose(24, 15, 64);
    expect(pose.x).toBe(24);
    expect(pose.y).toBeCloseTo(64 * Math.sin((PITCH * Math.PI) / 180), 6);
    expect(pose.z).toBeCloseTo(15 + 64 * Math.cos((PITCH * Math.PI) / 180), 6);
    expect(pose.y).toBeCloseTo(56.5, 1);
  });
});

describe('shake', () => {
  it('decays to zero and stays within the style-guide maximum', () => {
    const s = new ShakeState();
    s.add(5);
    expect(s.trauma).toBe(1);
    const out = { x: 0, y: 0, roll: 0 };
    for (let t = 0; t < 2; t += 0.01) {
      s.offset(t, out);
      expect(Math.abs(out.x)).toBeLessThanOrEqual(SHAKE.maxOffset);
    }
    for (let i = 0; i < 100; i++) s.step(0.01);
    expect(s.trauma).toBe(0);
    s.offset(1.234, out);
    expect(out.x).toBe(0);
  });
});

describe('quality scaler', () => {
  it('steps down only after sustained slow frames: high, medium, low, no shadows', () => {
    const q = new QualityScaler('high', 24, 10, 5);
    const seen: string[] = [];
    for (let i = 0; i < 400; i++) {
      const s = q.push(40);
      if (s) seen.push(`${s.level}${s.shadowsEnabled ? '' : '-noshadow'}`);
    }
    expect(seen).toEqual(['medium', 'low', 'low-noshadow']);
  });

  it('ignores healthy frames and tab-switch spikes', () => {
    const q = new QualityScaler('high', 24, 10, 5);
    for (let i = 0; i < 200; i++) expect(q.push(i % 50 === 0 ? 900 : 16.7)).toBeNull();
    expect(q.state.level).toBe('high');
  });
});
