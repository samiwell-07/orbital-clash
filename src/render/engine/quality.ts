export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  /** Upper bound for the device pixel ratio (the engine also caps at 2). */
  pixelRatioCap: number;
  shadows: boolean;
  shadowMapSize: number;
  /** Bloom render resolution relative to the frame buffer. */
  bloomScale: number;
  bloomStrength: number;
  /** MSAA samples of the composer targets. */
  samples: number;
  /** 0..1 multiplier for chromatic aberration and film grain. */
  gradeFx: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  high: { pixelRatioCap: 2, shadows: true, shadowMapSize: 4096, bloomScale: 1, bloomStrength: 0.55, samples: 4, gradeFx: 1 },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowMapSize: 2048, bloomScale: 0.5, bloomStrength: 0.5, samples: 4, gradeFx: 0.6 },
  low: { pixelRatioCap: 1, shadows: true, shadowMapSize: 1024, bloomScale: 0.35, bloomStrength: 0.4, samples: 2, gradeFx: 0 },
};

export const MAX_PIXEL_RATIO = 2;

export function effectivePixelRatio(devicePixelRatio: number, preset: QualityPreset): number {
  return Math.max(1, Math.min(devicePixelRatio, MAX_PIXEL_RATIO, preset.pixelRatioCap));
}

export interface QualityState {
  level: QualityLevel;
  shadowsEnabled: boolean;
}

export function presetFor(state: QualityState): QualityPreset {
  const base = QUALITY_PRESETS[state.level];
  return { ...base, shadows: base.shadows && state.shadowsEnabled };
}

const NEXT_LOWER: Record<QualityLevel, QualityLevel | null> = { high: 'medium', medium: 'low', low: null };

/**
 * Watches frame times and steps quality down when they stay above the threshold:
 * high -> medium -> low -> low without shadows. It never raises quality again (avoids flip-flopping).
 */
export class QualityScaler {
  state: QualityState;
  private slowFrames = 0;
  private cooldown = 0;
  private ema = 16.7;

  constructor(level: QualityLevel = 'high', private thresholdMs = 24, private windowFrames = 45, private cooldownFrames = 90) {
    this.state = { level, shadowsEnabled: true };
  }

  set(level: QualityLevel): void {
    this.state = { level, shadowsEnabled: true };
    this.slowFrames = 0;
    this.cooldown = this.cooldownFrames;
  }

  /** Feed one frame interval; returns the new state when it was lowered, else null. */
  push(frameMs: number): QualityState | null {
    if (!(frameMs > 0) || frameMs > 250) return null;
    this.ema += (frameMs - this.ema) * 0.15;
    if (this.cooldown > 0) {
      this.cooldown--;
      return null;
    }
    this.slowFrames = this.ema > this.thresholdMs ? this.slowFrames + 1 : 0;
    if (this.slowFrames < this.windowFrames) return null;
    this.slowFrames = 0;
    this.cooldown = this.cooldownFrames;
    const lower = NEXT_LOWER[this.state.level];
    if (lower) this.state = { level: lower, shadowsEnabled: this.state.shadowsEnabled };
    else if (this.state.shadowsEnabled) this.state = { level: 'low', shadowsEnabled: false };
    else return null;
    return this.state;
  }
}
