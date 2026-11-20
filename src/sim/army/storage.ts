import type { Player, PlayerId, UnitKind, World } from '@/types';
import { ALL_UNITS } from '@/types';
import { PIP_VALUES, STORAGE_CAP } from '@/config/constants';

export function storedOf(p: Player, kind: UnitKind): number {
  return p.stored[kind] ?? 0;
}

export function storedTotal(p: Player): number {
  let n = 0;
  for (const k of ALL_UNITS) n += p.stored[k] ?? 0;
  return n;
}

export function storageFull(p: Player): boolean {
  return storedTotal(p) >= STORAGE_CAP;
}

/** Adds up to n units to the base; returns how many fit under STORAGE_CAP. */
export function addStored(w: World, owner: PlayerId, kind: UnitKind, n = 1): number {
  const p = w.players[owner];
  const accepted = Math.max(0, Math.min(n, STORAGE_CAP - storedTotal(p)));
  if (accepted > 0) p.stored[kind] = storedOf(p, kind) + accepted;
  return accepted;
}

/** Removes up to n stored units of a kind; returns how many were taken. */
export function takeStored(p: Player, kind: UnitKind, n = 1): number {
  const taken = Math.max(0, Math.min(n, storedOf(p, kind)));
  if (taken > 0) p.stored[kind] = storedOf(p, kind) - taken;
  return taken;
}

/** HUD: units waiting in the player's base, every kind present (0 when none). */
export function unitCounts(w: World, player: PlayerId, out?: Record<UnitKind, number>): Record<UnitKind, number> {
  const res = out ?? ({} as Record<UnitKind, number>);
  const p = w.players[player];
  for (const k of ALL_UNITS) res[k] = p.stored[k] ?? 0;
  return res;
}

/** HUD: units of the player currently on the map (not dead), by kind. */
export function fieldCounts(w: World, player: PlayerId): Record<UnitKind, number> {
  const res = {} as Record<UnitKind, number>;
  for (const k of ALL_UNITS) res[k] = 0;
  for (const u of w.units) if (u.owner === player && u.state !== 'dead') res[u.kind]++;
  return res;
}

export interface Pips {
  white: number;
  blue: number;
  red: number;
}

/** Attack-menu pips for a count: red = 100, blue = 10, white = 1 (PIP_VALUES). */
export function pipCounts(n: number): Pips {
  let rest = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  const red = Math.floor(rest / PIP_VALUES[2]);
  rest -= red * PIP_VALUES[2];
  const blue = Math.floor(rest / PIP_VALUES[1]);
  rest -= blue * PIP_VALUES[1];
  return { white: Math.floor(rest / PIP_VALUES[0]), blue, red };
}
