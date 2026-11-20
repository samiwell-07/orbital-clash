// Pure sound catalogue: ids plus priority and rate-limit metadata. No WebAudio here.

export interface SoundMeta {
  /** Higher plays first when a batch has more calls than the cap. */
  prio: number;
  /** Max simultaneous starts of this sound inside `win` seconds. */
  max: number;
  win: number;
}

const m = (prio: number, max = 3, win = 0.05): SoundMeta => ({ prio, max, win });

export const SOUND_META = {
  turretShot: m(1, 3),
  laserBeam: m(1, 1, 0.3),
  pulsarPulse: m(2, 2),
  bomberBomb: m(3, 2),
  spawn: m(1, 2),
  launch: m(2, 2, 0.1),
  unitDeath: m(1, 4),
  hammerSmash: m(3, 2),
  switchClick: m(2, 2),
  thiefSneak: m(2, 1, 0.2),
  carrierHum: m(2, 1, 0.4),
  torpedo: m(3, 2, 0.1),
  build: m(4, 2),
  upgrade: m(4, 2),
  recycle: m(4, 2),
  repair: m(3, 2),
  structureHit: m(2, 3),
  explosion: m(3, 3),
  explosionBig: m(5, 2),
  rockGrab: m(4, 2),
  rockSmash: m(4, 2),
  thorium: m(3, 2),
  uiMove: m(6, 1, 0.03),
  uiConfirm: m(6, 1, 0.08),
  uiBack: m(6, 1, 0.08),
  uiDenied: m(6, 1, 0.15),
  baseAlarm: m(8, 1, 0.8),
  victory: m(10, 1, 3),
  defeat: m(10, 1, 3),
  timeUp: m(9, 1, 2),
} as const satisfies Record<string, SoundMeta>;

export type SoundId = keyof typeof SOUND_META;
export type UiSoundId = 'uiMove' | 'uiConfirm' | 'uiBack' | 'uiDenied';

export interface SoundCall {
  id: SoundId;
  /** Stereo pan -1..1. */
  pan: number;
  /** Linear gain multiplier, already scaled for how many events collapsed into this call. */
  vol: number;
  count: number;
}
