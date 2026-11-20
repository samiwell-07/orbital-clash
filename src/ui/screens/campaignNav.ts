import type { CometId } from '../../types';
import { COMET_ORDER, EXPANSION_ORDER, AREAS_PER_COMET } from '../../meta/saveSchema';
import { clamp } from '../format';
import type { AreaSummary } from './types';

export interface MapCursor {
  row: number;
  col: number;
}

export interface MapNode {
  cometId: CometId;
  /** 0..6 for areas; the Resurgence node's own index otherwise. */
  index: number;
  resurgence: boolean;
}

/** Resurgence nodes provided for a comet, sorted; at least one placeholder node is always shown. */
export function resurgenceIndices(areas: readonly AreaSummary[], cometId: CometId): number[] {
  const list = areas.filter((a) => a.cometId === cometId && a.resurgence).map((a) => a.index).sort((a, b) => a - b);
  return list.length ? list : [0];
}

export function rowLengths(areas: readonly AreaSummary[], order: readonly CometId[] = COMET_ORDER): number[] {
  return order.map((id) => AREAS_PER_COMET + resurgenceIndices(areas, id).length);
}

/** Moves the cursor; up/down switch comets (column clamped to the new row), left/right walk the nodes. */
export function moveCursor(c: MapCursor, dx: number, dy: number, lens: readonly number[]): MapCursor {
  const row = clamp(c.row + dy, 0, lens.length - 1);
  return { row, col: clamp(c.col + dx, 0, lens[row] - 1) };
}

export function nodeAt(c: MapCursor, areas: readonly AreaSummary[], order: readonly CometId[] = COMET_ORDER): MapNode {
  const cometId = order[c.row];
  if (c.col < AREAS_PER_COMET) return { cometId, index: c.col, resurgence: false };
  return { cometId, index: resurgenceIndices(areas, cometId)[c.col - AREAS_PER_COMET] ?? 0, resurgence: true };
}

export function findArea(areas: readonly AreaSummary[], n: MapNode): AreaSummary | undefined {
  return areas.find((a) => a.cometId === n.cometId && a.index === n.index && a.resurgence === n.resurgence);
}

/** Regular campaign areas run across both packs. Resurgences are labelled separately. */
export function areaNumber(n: MapNode): number {
  return [...COMET_ORDER, ...EXPANSION_ORDER].indexOf(n.cometId) * AREAS_PER_COMET + n.index + 1;
}

export function placeholderArea(n: MapNode): AreaSummary {
  const comet = n.cometId.charAt(0).toUpperCase() + n.cometId.slice(1);
  return {
    cometId: n.cometId, index: n.index, resurgence: n.resurgence,
    name: n.resurgence ? `${comet} Resurgence` : `${comet} ${n.index + 1}`,
    teaches: null, objectives: ['Destroy the enemy base'], parTimeSec: 300,
  };
}
