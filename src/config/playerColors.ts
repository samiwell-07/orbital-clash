import { PLAYER_COLORS } from '../types/ids';

/**
 * Active owner -> palette index map. Rendering and HUD look colours up by owner (player id) through
 * `colorIndexFor`, so a lobby colour choice recolours everything the player owns. Identity by default.
 */
let active: number[] = [0, 1, 2, 3];

export const PALETTE_SIZE = PLAYER_COLORS.length;

/** Sets the map from each player's chosen colour (index = player id). Call when a match world is loaded. */
export function setPlayerColorMap(byOwner: readonly number[]): void {
  active = [0, 1, 2, 3].map((id) => {
    const c = byOwner[id];
    return Number.isInteger(c) && c >= 0 && c < PALETTE_SIZE ? c : id;
  });
}

export function resetPlayerColorMap(): void {
  active = [0, 1, 2, 3];
}

/** Palette index for an owner (player id). Out-of-range owners fall back to 0. */
export function colorIndexFor(owner: number): number {
  return owner >= 0 && owner < 4 ? active[owner | 0] : 0;
}

/** 0xRRGGBB colour for an owner (player id). */
export function ownerColor(owner: number): number {
  return PLAYER_COLORS[colorIndexFor(owner)];
}

/** 0xRRGGBB colour for a palette index (lobby swatches, team colours). */
export function paletteColor(index: number): number {
  return PLAYER_COLORS[((index % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE];
}
