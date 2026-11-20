import type { VideoLayout } from '../meta/settings';
import { PLAYER_IDS } from '../types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const inset = (r: Rect, d: number): Rect => ({ x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d });
export const right = (r: Rect): number => r.x + r.w;
export const bottom = (r: Rect): number => r.y + r.h;
export const contains = (r: Rect, px: number, py: number): boolean =>
  px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

export interface HudLayout {
  mode: VideoLayout;
  /** Pixels per design unit; design height is 1080. */
  s: number;
  safe: Rect;
  timer: Rect;
  panels: Rect[];
  objectives: Rect;
  banner: Rect;
  /** Wordmark strip (4:3 only), null in 16:9. */
  wordmark: Rect | null;
  /** Everything not covered by the sidebar/strip: where the playfield is visible. */
  play: Rect;
}

/** Design resolution of the menu screens for a layout. */
export function designSize(mode: VideoLayout): { w: number; h: number } {
  return mode === '16:9' ? { w: 1920, h: 1080 } : { w: 1440, h: 1080 };
}

/** The layout the HUD uses when the shell gives no explicit setting: by canvas aspect. */
export function autoMode(w: number, h: number): VideoLayout {
  return w / Math.max(1, h) < 1.5 ? '4:3' : '16:9';
}

/** Largest rect of the layout's aspect ratio centred in the canvas, then inset by a title-safe margin. */
export function safeArea(w: number, h: number, mode: VideoLayout): Rect {
  const aspect = mode === '16:9' ? 16 / 9 : 4 / 3;
  const sw = Math.min(w, h * aspect);
  const sh = sw / aspect;
  const mx = sw * 0.025;
  const my = sh * 0.03;
  return { x: (w - sw) / 2 + mx, y: (h - sh) / 2 + my, w: sw - 2 * mx, h: sh - 2 * my };
}

export function computeHudLayout(w: number, h: number, mode: VideoLayout, panelCount: number): HudLayout {
  const safe = safeArea(w, h, mode);
  const s = safe.h / 1030;
  const n = Math.max(0, Math.min(PLAYER_IDS.length, panelCount));
  const panels: Rect[] = [];

  if (mode === '16:9') {
    const sw = 290 * s;
    const timer = { x: safe.x, y: safe.y, w: sw, h: 88 * s };
    for (let i = 0; i < n; i++) panels.push({ x: safe.x, y: bottom(timer) + (10 + i * 114) * s, w: sw, h: 104 * s });
    const top = panels.length ? bottom(panels[panels.length - 1]) + 14 * s : bottom(timer) + 14 * s;
    const play = { x: safe.x + sw + 12 * s, y: safe.y, w: safe.w - sw - 12 * s, h: safe.h };
    return {
      mode, s, safe, timer, panels, play,
      objectives: { x: safe.x, y: top, w: sw, h: Math.max(0, bottom(safe) - top) },
      banner: { x: play.x + (play.w - 680 * s) / 2, y: safe.y + 8 * s, w: 680 * s, h: 44 * s },
      wordmark: null,
    };
  }

  const stripH = 112 * s;
  const timerW = 250 * s;
  const stripY = bottom(safe) - stripH;
  const gap = 8 * s;
  const panelW = n ? Math.min(300 * s, (safe.w - timerW - gap * (n + 1)) / n) : 0;
  for (let i = 0; i < n; i++) panels.push({ x: safe.x + i * (panelW + gap), y: stripY, w: panelW, h: stripH });
  const timer = { x: right(safe) - timerW, y: stripY, w: timerW, h: stripH };
  return {
    mode, s, safe, timer, panels,
    play: { x: safe.x, y: safe.y + 40 * s, w: safe.w, h: stripY - safe.y - 40 * s - gap },
    objectives: { x: safe.x, y: safe.y + 48 * s, w: 340 * s, h: 150 * s },
    banner: { x: safe.x + (safe.w - 680 * s) / 2, y: safe.y + 52 * s, w: 680 * s, h: 44 * s },
    wordmark: { x: safe.x, y: safe.y, w: safe.w, h: 40 * s },
  };
}

/** Default tile -> screen mapping: the map fitted into the play rect (near-orthographic camera approximation). */
export function fitProjection(play: Rect, gridW: number, gridH: number): (x: number, y: number) => { x: number; y: number } {
  const k = Math.min(play.w / Math.max(1, gridW), play.h / Math.max(1, gridH));
  const ox = play.x + (play.w - gridW * k) / 2;
  const oy = play.y + (play.h - gridH * k) / 2;
  return (x, y) => ({ x: ox + x * k, y: oy + y * k });
}

/** Keeps a popup of size (w,h) with preferred top-left (x,y) fully inside the bounds. */
export function clampRect(x: number, y: number, w: number, h: number, bounds: Rect): Rect {
  return {
    x: Math.min(Math.max(x, bounds.x), Math.max(bounds.x, right(bounds) - w)),
    y: Math.min(Math.max(y, bounds.y), Math.max(bounds.y, bottom(bounds) - h)),
    w, h,
  };
}
