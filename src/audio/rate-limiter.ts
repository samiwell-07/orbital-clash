// Pure sliding-window limiter: caps starts per key and scales volume by crowding.

export interface RateLimiter {
  /** Returns a gain scale in (0,1], or 0 when the key is saturated inside the window. */
  acquire(key: string, now: number, max: number, win: number): number;
  reset(): void;
}

export function createRateLimiter(): RateLimiter {
  const history = new Map<string, number[]>();
  return {
    acquire(key, now, max, win) {
      const prev = history.get(key) ?? [];
      const live = prev.filter((t) => t > now - win && t <= now);
      if (live.length >= max) {
        history.set(key, live);
        return 0;
      }
      const scale = 1 / (1 + 0.35 * live.length);
      live.push(now);
      history.set(key, live);
      return scale;
    },
    reset() {
      history.clear();
    },
  };
}
