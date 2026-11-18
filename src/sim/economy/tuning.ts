// Economy balance numbers (TUNED). Kept local because src/data belongs to another owner.
export const ECON = {
  /** Seconds between meteoroids at thoriumLevel 1 and thoriumRate 1; divided by level and rate. */
  meteorBaseSeconds: 16,
  maxRocks: 14,
  /** Thorium inside a rock per size step. */
  thoriumPerSize: 15,
  /** Multiplier on smash payout by map thorium level 1..3. */
  levelFactor: { 1: 0.8, 2: 1, 3: 1.25 } as const,
  meteorSpeed: [0.7, 1.6] as const,
  /** Chance per second that an on-map drifting rock comes to rest. */
  landPerSecond: 0.12,
  /** Distance inside the edge where rocks may land. */
  landMargin: 3,
  grabRange: 1.5,
  /** Ship acceleration divisor grows with the carried rock's size. */
  carrySlowPerSize: 0.12,
  shipMargin: 0.5,
  harvesterRange: 4,
  harvesterInterval: 2,
  harvesterRetry: 0.5,
  harvesterPull: 4,
} as const;
