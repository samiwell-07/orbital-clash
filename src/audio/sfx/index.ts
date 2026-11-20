import type { Player } from '../synth';
import type { SoundId } from '../sound-ids';
import { weaponSounds } from './weapons';
import { unitSounds } from './units';
import { structureSounds } from './structures';
import { economySounds } from './economy';
import { uiSounds } from './ui';
import { alertSounds } from './alerts';

/** Complete table; the type forces every SoundId to have a synth. */
export const SFX: Record<SoundId, Player> = {
  ...weaponSounds,
  ...unitSounds,
  ...structureSounds,
  ...economySounds,
  ...uiSounds,
  ...alertSounds,
};
