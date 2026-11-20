import type { Ship } from '../types';

export interface TileXY {
  tx: number;
  ty: number;
}

/** Tile under a ship position (tile t covers [t, t + 1)). */
export function tileUnderShip(ship: Pick<Ship, 'x' | 'y'>): TileXY {
  return { tx: Math.floor(ship.x), ty: Math.floor(ship.y) };
}

export function clampTile(t: TileXY, w: number, h: number): TileXY {
  return { tx: Math.max(0, Math.min(w - 1, t.tx)), ty: Math.max(0, Math.min(h - 1, t.ty)) };
}

/** Builds the `getCursor` callback for createInput from any list of players that own a ship. */
export function cursorFromPlayers(
  getPlayers: () => readonly { ship: Pick<Ship, 'x' | 'y'> }[],
): (player: number) => TileXY {
  return (player) => {
    const p = getPlayers()[player];
    return p ? tileUnderShip(p.ship) : { tx: 0, ty: 0 };
  };
}
