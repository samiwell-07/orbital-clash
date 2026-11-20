import type { Ctx } from '../theme';
import { STATUS_ICONS } from '../icons/status';
import { STRUCTURE_ICONS } from '../icons/structures';
import { UNIT_ICONS } from '../icons/units';
import { drawShapes, type Shape } from '../icons/shapes';

export type StatusIconId = keyof typeof STATUS_ICONS;

const TABLE: Record<string, readonly Shape[]> = { ...STATUS_ICONS, ...STRUCTURE_ICONS, ...UNIT_ICONS };

export function hasIcon(id: string): boolean {
  return id in TABLE;
}

/** Draws an icon (status, structure kind or unit kind id) centred at (cx, cy), `size` px across. */
export function drawIcon(ctx: Ctx, id: string, cx: number, cy: number, size: number, color: string): void {
  const shapes = TABLE[id];
  if (shapes) drawShapes(ctx, shapes, cx, cy, size, color);
}
