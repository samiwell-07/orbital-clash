import { drawControlsTable } from '../menus/controlsTable';
import { drawFooter, drawHeader } from './common';
import type { Screen } from './types';

export function createControlsScreen(): Screen {
  return {
    id: 'controls',
    update: (nav) => (nav.back || nav.confirm ? { t: 'pop' } : null),
    draw(g, size, _now, ctx) {
      const display = ctx.data.save.settings.controlsDisplay;
      drawHeader(g, size.w, 'Controls', 'Gamepad and keyboard bindings');
      drawControlsTable(g, { x: 70, y: 180, w: size.w - 140, h: size.h - 300 }, display);
      drawFooter(g, size.h, display, [{ key: 'back', label: 'Back' }]);
    },
  };
}
