import type { AudioApi } from '../types';
import { getBus, installUnlockListeners, setBusVolume, unlockContext } from './context';
import { handleEvents } from './mapper';
import { createMusic } from './music';
import { playSound } from './player';
import type { UiSoundId } from './sound-ids';

export type { SoundId, SoundCall, UiSoundId } from './sound-ids';
export { mapEvents, handleEvents, panFromX } from './mapper';
export { buildPattern, createSequencer } from './music-pattern';

export interface GameAudio extends AudioApi {
  /** Menu feedback sounds (no SimEvent exists for these). */
  ui(id: UiSoundId): void;
}

export function createAudio(): GameAudio {
  const music = createMusic(getBus);
  installUnlockListeners(() => music.resume());
  return {
    unlock() {
      void unlockContext().then((ok) => ok && music.resume());
    },
    handle(events) {
      if (getBus()) handleEvents(events, playSound);
    },
    music(mode) {
      music.set(mode);
    },
    setVolume(master, sfx, musicVol) {
      setBusVolume(master, sfx, musicVol);
    },
    ui(id) {
      playSound({ id, pan: 0, vol: 1, count: 1 });
    },
  };
}
