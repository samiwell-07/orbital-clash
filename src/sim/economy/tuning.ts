// Economy balance numbers (TUNED). Kept local because src/data belongs to another owner.
export const ECON = {
  /** Seconds between meteoroids at thoriumLevel 1 and thoriumRate 1; divided by level and rate. */
  meteorBaseSeconds: 16,
  maxRocks: 14,
  /** Thorium inside a rock by size: bigger rocks hold disproportionately more. */
  rockThorium: { 1: 15, 2: 40, 3: 75 } as const,
  /** Multiplier on harvest payout by map thorium level 1..3. */
  levelFactor: { 1: 0.8, 2: 1, 3: 1.25 } as const,
  meteorSpeed: [0.7, 1.6] as const,
  /** Chance per second that an on-map drifting rock comes to rest. */
  landPerSecond: 0.12,
  /** Distance inside the edge where rocks may land. */
  landMargin: 3,
  grabRange: 1.5,
  /** Ship acceleration divisor grows with the carried rock's size. */
  carrySlowPerSize: 0.12,
  /** Distance from the ship centre to a towed rock's centre, by size (the rock rides in front of the nose). */
  towDistance: { 1: 0.85, 2: 1.15, 3: 1.55 } as const,
  /** Radians per second the towed rock swings round to follow the ship's heading. */
  towTurnRate: 9,
  /** Ship speed (tiles/s) above which its heading updates. */
  towHeadingMinSpeed: 0.4,
  shipMargin: 0.5,
  /** Harvester magnet radius in tiles by level 0..3. Carried rocks are ignored: drop them inside it. */
  harvesterRange: [3, 4, 5, 6.5] as const,
  /** Tiles per second a magnetised rock travels to the harvester. */
  magnetSpeed: 2.5,
  /** Seconds between harvest pulses; each pulse drains `harvestPerPulse` raw thorium from the rock. */
  harvestPulse: 1,
  harvestPerPulse: 5,
} as const;
