import { describe, expect, it } from 'vitest';
import { approach, formatTime, formatTimeTenths, humanize, pipsFor, sumStored } from '../../src/ui/format';
import { computeHudLayout, fitProjection, safeArea, designSize, autoMode, clampRect } from '../../src/ui/layout';
import { segmentsFor, digitsWidth } from '../../src/ui/widgets/digits';

describe('format helpers', () => {
  it('formats mm:ss and widens past 99 minutes', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(61.9)).toBe('01:01');
    expect(formatTime(18 * 60 + 31)).toBe('18:31');
    expect(formatTime(100 * 60 + 5)).toBe('100:05');
    expect(formatTime(-4)).toBe('00:00');
    expect(formatTime(NaN)).toBe('00:00');
    expect(formatTimeTenths(75.34)).toBe('01:15.3');
  });

  it('decomposes counts into white=1, blue=10, red=100 pips', () => {
    expect(pipsFor(0)).toEqual({ white: 0, blue: 0, red: 0 });
    expect(pipsFor(538)).toEqual({ white: 8, blue: 3, red: 5 });
    expect(pipsFor(1000)).toEqual({ white: 0, blue: 0, red: 10 });
    expect(pipsFor(99)).toEqual({ white: 9, blue: 9, red: 0 });
  });

  it('approach converges without overshoot and snaps when close', () => {
    let v = 0;
    for (let i = 0; i < 60; i++) v = approach(v, 100, 1 / 60, 0.07);
    expect(v).toBe(100);
    expect(approach(50, 100, 0.01, 0.07)).toBeLessThan(100);
    expect(approach(5, 5, 1, 0.1)).toBe(5);
  });

  it('sums stored units and humanizes ids', () => {
    expect(sumStored({ scout: 5, tank: 7 })).toBe(12);
    expect(humanize('basicOps')).toBe('Basic Ops');
  });
});

describe('seven-segment font', () => {
  it('lights the right segments', () => {
    expect(segmentsFor('8')).toHaveLength(7);
    expect(segmentsFor('1').join('')).toBe('bc');
    expect(segmentsFor('7').join('')).toBe('abc');
    expect(segmentsFor('x')).toEqual([]);
  });
  it('measures text width proportional to height', () => {
    expect(digitsWidth('', 10)).toBe(0);
    expect(digitsWidth('88', 100)).toBeGreaterThan(digitsWidth('8', 100));
    expect(digitsWidth('88', 200)).toBeCloseTo(digitsWidth('88', 100) * 2, 5);
  });
});

describe('HUD layout', () => {
  const inside = (r: { x: number; y: number; w: number; h: number }, o: { x: number; y: number; w: number; h: number }): boolean =>
    r.x >= o.x - 0.01 && r.y >= o.y - 0.01 && r.x + r.w <= o.x + o.w + 0.01 && r.y + r.h <= o.y + o.h + 0.01;
  const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('16:9: sidebar stacks timer and up to four panels inside the safe area', () => {
    const l = computeHudLayout(1920, 1080, '16:9', 4);
    expect(l.panels).toHaveLength(4);
    for (const p of l.panels) expect(inside(p, l.safe)).toBe(true);
    for (let i = 1; i < 4; i++) expect(l.panels[i].y).toBeGreaterThan(l.panels[i - 1].y + l.panels[i - 1].h - 0.01);
    expect(overlap(l.timer, l.panels[0])).toBe(false);
    expect(overlap(l.panels[3], l.play)).toBe(false);
    expect(l.wordmark).toBeNull();
    expect(l.objectives.y).toBeGreaterThan(l.panels[3].y + l.panels[3].h);
  });

  it('4:3: panels become a bottom strip with the timer bottom-right and a wordmark on top', () => {
    const l = computeHudLayout(1440, 1080, '4:3', 4);
    expect(l.wordmark).not.toBeNull();
    for (const p of l.panels) {
      expect(inside(p, l.safe)).toBe(true);
      expect(overlap(p, l.timer)).toBe(false);
      expect(p.y).toBeCloseTo(l.timer.y, 3);
    }
    expect(l.timer.x).toBeGreaterThan(l.panels[3].x);
    expect(overlap(l.play, l.panels[0])).toBe(false);
  });

  it('safe area keeps the chosen aspect even on a mismatched canvas', () => {
    const wide = safeArea(1920, 1080, '4:3');
    expect(wide.w / wide.h).toBeGreaterThan(1.25);
    expect(wide.w).toBeLessThan(1500);
    const tall = safeArea(1000, 1000, '16:9');
    expect(tall.h).toBeLessThan(600);
    expect(designSize('4:3')).toEqual({ w: 1440, h: 1080 });
    expect(autoMode(1024, 768)).toBe('4:3');
    expect(autoMode(1920, 1080)).toBe('16:9');
  });

  it('fits a map into the play rect and clamps popups', () => {
    const proj = fitProjection({ x: 100, y: 0, w: 960, h: 600 }, 48, 30);
    expect(proj(0, 0)).toEqual({ x: 100, y: 0 });
    expect(proj(48, 30)).toEqual({ x: 1060, y: 600 });
    const r = clampRect(990, 590, 100, 50, { x: 0, y: 0, w: 1000, h: 600 });
    expect(r.x + r.w).toBeLessThanOrEqual(1000);
    expect(r.y + r.h).toBeLessThanOrEqual(600);
  });
});
