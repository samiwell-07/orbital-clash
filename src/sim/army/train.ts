import type { Structure, Unit, UnitKind, Vec2 } from '@/types';
import { UNIT_DEFS } from '@/data';
import { MIN_SPACING, SPACING_PER_RADIUS, TRAIN_STEP } from './constants';

/**
 * Shared route of a launched column. The head extends the polyline; followers sample it at their own
 * travelled distance. Points sit at exact multiples of TRAIN_STEP of arc length (pts[2k], pts[2k+1]);
 * (hx, hy) is the tip at arc length `len`. Solo trains (record = false) keep only the tip.
 */
export interface Train {
  record: boolean;
  pts: Float64Array;
  count: number;
  len: number;
  hx: number;
  hy: number;
  /** Structure the head is currently chewing through (set by the head each tick). */
  chewS: Structure | null;
}

/** A unit's place in its train: `prev` is the unit ahead (null for the head). */
export interface Link {
  train: Train;
  prev: Link | null;
  unit: Unit;
}

const links = new WeakMap<Unit, Link>();
const spacings = new Map<UnitKind, number>();

export function createTrain(x: number, y: number, record: boolean): Train {
  const pts = new Float64Array(record ? 256 : 2);
  pts[0] = x;
  pts[1] = y;
  return { record, pts, count: 1, len: 0, hx: x, hy: y, chewS: null };
}

export function linkOf(u: Unit): Link | undefined {
  return links.get(u);
}

export function attachUnit(unit: Unit, train: Train, prev: Link | null): Link {
  const link: Link = { train, prev, unit };
  links.set(unit, link);
  return link;
}

/** Fixed centre-to-centre gap between consecutive units of a kind in a train. */
export function spacingFor(kind: UnitKind): number {
  let s = spacings.get(kind);
  if (s === undefined) {
    s = Math.max(MIN_SPACING, UNIT_DEFS[kind].radius * SPACING_PER_RADIUS);
    spacings.set(kind, s);
  }
  return s;
}

function push(t: Train, x: number, y: number): void {
  const i = t.count * 2;
  if (i + 2 > t.pts.length) {
    const bigger = new Float64Array(t.pts.length * 2);
    bigger.set(t.pts);
    t.pts = bigger;
  }
  t.pts[i] = x;
  t.pts[i + 1] = y;
  t.count++;
}

/** Moves the tip in a straight line to (nx, ny), recording the points passed. */
export function extendTrain(t: Train, nx: number, ny: number): void {
  const dx = nx - t.hx;
  const dy = ny - t.hy;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 0) return;
  const len0 = t.len;
  const len1 = len0 + d;
  if (t.record) {
    while (t.count * TRAIN_STEP <= len1) {
      const f = (t.count * TRAIN_STEP - len0) / d;
      push(t, t.hx + dx * f, t.hy + dy * f);
    }
  }
  t.hx = nx;
  t.hy = ny;
  t.len = len1;
}

/** Position at arc length s along the train's route (clamped to the tip). */
export function sampleTrain(t: Train, s: number, out: Vec2): Vec2 {
  if (!t.record || s >= t.len) {
    out.x = t.hx;
    out.y = t.hy;
    return out;
  }
  const k = Math.max(0, Math.floor(s / TRAIN_STEP));
  const base = k * TRAIN_STEP;
  const ax = t.pts[k * 2];
  const ay = t.pts[k * 2 + 1];
  let bx = t.hx;
  let by = t.hy;
  let seg = t.len - base;
  if (k + 1 < t.count) {
    bx = t.pts[k * 2 + 2];
    by = t.pts[k * 2 + 3];
    seg = TRAIN_STEP;
  }
  const f = seg > 0 ? Math.min(1, Math.max(0, (s - base) / seg)) : 0;
  out.x = ax + (bx - ax) * f;
  out.y = ay + (by - ay) * f;
  return out;
}
