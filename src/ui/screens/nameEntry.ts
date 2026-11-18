import { NAME_MAX, NAME_MIN, normalizeName } from '../../meta/leaderboard';
import type { UiNav } from './types';

export const NAME_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-';

/** Arcade-style name entry for the leaderboard: up/down cycle a character, left/right move, confirm on OK submits. */
export class NameEntry {
  readonly chars: string[];
  /** 0..NAME_MAX-1 are character slots; NAME_MAX is the OK button. */
  pos = 0;

  constructor(initial = '') {
    const seed = initial.toUpperCase().slice(0, NAME_MAX);
    this.chars = Array.from({ length: NAME_MAX }, (_, i) => seed[i] ?? (i < NAME_MIN ? 'A' : ' '));
  }

  get value(): string {
    return this.chars.join('').trim();
  }

  get valid(): boolean {
    return normalizeName(this.value) !== null;
  }

  private cycle(dir: 1 | -1): void {
    const i = NAME_ALPHABET.indexOf(this.chars[this.pos]);
    const n = NAME_ALPHABET.length;
    this.chars[this.pos] = NAME_ALPHABET[(((i < 0 ? 0 : i) + dir) % n + n) % n];
  }

  /** Returns the final name when OK was confirmed on a valid name. */
  handle(nav: UiNav): string | null {
    const atOk = this.pos === NAME_MAX;
    if (nav.up && !atOk) this.cycle(1);
    if (nav.down && !atOk) this.cycle(-1);
    if (nav.left) this.pos = Math.max(0, this.pos - 1);
    if (nav.right) this.pos = Math.min(NAME_MAX, this.pos + 1);
    if (nav.confirm) {
      if (!atOk) this.pos += 1;
      else if (this.valid) return normalizeName(this.value);
    }
    return null;
  }
}
