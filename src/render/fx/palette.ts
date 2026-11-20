import { ownerColor } from '@/config/playerColors';
import { PLAYER_IDS } from '@/types';

export const FIRE_HOT = 0xfff2a0;
export const FIRE_MID = 0xff7a1a;
export const FIRE_DARK = 0x401000;
export const AMBER = 0xffb347;
export const CYAN = 0x8fe8ff;
export const CYAN_DEEP = 0x33e6ff;
export const WHITE = 0xffffff;
export const THORIUM = 0xd8ff3c;
export const THORIUM_GOLD = 0xffd23c;
export const SMOKE_LIGHT = 0x5a525e;
export const SMOKE_DARK = 0x1a171e;
export const PULSAR = 0xe8d8ff;
export const REPAIR_GREEN = 0x66ff9a;
export const MUZZLE = 0xffd27a;
export const TRACER = 0xffe08a;
export const BOMB_ORANGE = 0xff8a2a;
export const CRYSTAL = 0x7fe9ff;

export function playerColor(owner: number): number {
  return owner >= 0 && owner < PLAYER_IDS.length ? ownerColor(owner) : 0xffffff;
}

/** Linear mix of two 0xRRGGBB colours in sRGB space (t = 0 gives a). */
export function mixHex(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const r = ((a >> 16) & 255) * (1 - k) + ((b >> 16) & 255) * k;
  const g = ((a >> 8) & 255) * (1 - k) + ((b >> 8) & 255) * k;
  const bl = (a & 255) * (1 - k) + (b & 255) * k;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}
