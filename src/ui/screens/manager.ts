import type { Command, Screen, ScreenCtx, UiData, UiNav } from './types';
import { designSize } from '../layout';
import type { Ctx } from '../theme';
import { drawSpace } from './common';

export interface ScreenManager {
  readonly depth: number;
  top(): Screen | null;
  push(screen: Screen): void;
  pop(): void;
  /** Drops the whole stack and shows `screen` (or nothing). */
  reset(screen: Screen | null): void;
  /** Feed one frame of nav; returns the Command the shell must handle, if any. */
  update(nav: UiNav, dt: number): Command | null;
  /** Paints the space backdrop and the top screen. Does nothing when the stack is empty. */
  draw(ctx: Ctx, width: number, height: number, nowSec: number): void;
}

/** Small push/pop screen stack. Screens return pushes/pops; only shell-level Commands are surfaced. */
export function createScreenManager(getData: () => UiData, root: Screen | null = null): ScreenManager {
  const stack: Screen[] = root ? [root] : [];
  const ctxOf = (): ScreenCtx => ({ data: getData() });

  return {
    get depth() {
      return stack.length;
    },
    top: () => stack[stack.length - 1] ?? null,
    push: (s) => void stack.push(s),
    pop: () => void stack.pop(),
    reset(screen) {
      stack.length = 0;
      if (screen) stack.push(screen);
    },

    update(nav, dt) {
      const top = stack[stack.length - 1];
      if (!top) return null;
      const res = top.update(nav, dt, ctxOf());
      if (!res) return null;
      switch (res.t) {
        case 'push': stack.push(res.screen); return null;
        case 'replace': stack[stack.length - 1] = res.screen; return null;
        case 'pop': if (stack.length > 1) stack.pop(); return null;
        case 'popAll': stack.length = Math.min(1, stack.length); return null;
        default: return res;
      }
    },

    draw(ctx, width, height, nowSec) {
      const top = stack[stack.length - 1];
      if (!top) return;
      const data = getData();
      ctx.clearRect(0, 0, width, height);
      drawSpace(ctx, width, height, nowSec);
      const size = designSize(data.save.settings.videoLayout);
      const k = Math.min(width / size.w, height / size.h);
      ctx.save();
      ctx.translate((width - size.w * k) / 2, (height - size.h * k) / 2);
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.rect(0, 0, size.w, size.h);
      ctx.clip();
      top.draw(ctx, size, nowSec, { data });
      ctx.restore();
    },
  };
}
