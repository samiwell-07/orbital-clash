import { afterEach, describe, expect, it } from 'vitest';
import { resetPlayerColorMap, setPlayerColorMap } from '@/config/playerColors';
import { paletteIndex, teamIndex } from '@/render/instancing/colorTables';
import { playerColor as fxPlayerColor } from '@/render/fx/palette';
import { paletteCss, playerColor } from '@/ui/theme';
import { PLAYER_COLORS } from '@/types';

const css = (n: number): string => '#' + n.toString(16).padStart(6, '0');

describe('owner colours follow the lobby colour map', () => {
  afterEach(() => resetPlayerColorMap());

  it('defaults to the identity map', () => {
    for (let id = 0; id < 5; id++) {
      expect(teamIndex(id)).toBe(id);
      expect(fxPlayerColor(id)).toBe(PLAYER_COLORS[id]);
      expect(playerColor(id)).toBe(css(PLAYER_COLORS[id]));
    }
    expect(teamIndex(-1)).toBe(0);
    expect(fxPlayerColor(-1)).toBe(0xffffff);
  });

  it('maps owners to their chosen palette colour', () => {
    setPlayerColorMap([6, 0, 4, 7, 2]);
    expect([0, 1, 2, 3, 4].map(teamIndex)).toEqual([6, 0, 4, 7, 2]);
    expect(fxPlayerColor(0)).toBe(PLAYER_COLORS[6]);
    expect(fxPlayerColor(3)).toBe(PLAYER_COLORS[7]);
    expect(playerColor(2)).toBe(css(PLAYER_COLORS[4]));
    expect(playerColor(1)).toBe(css(PLAYER_COLORS[0]));
    expect(playerColor(4)).toBe(css(PLAYER_COLORS[2]));
    expect(fxPlayerColor(4)).toBe(PLAYER_COLORS[2]);
  });

  it('keeps palette lookups (team labels, swatches) independent of the owner map', () => {
    setPlayerColorMap([5, 5, 5, 5]);
    expect(paletteCss(1)).toBe(css(PLAYER_COLORS[1]));
    expect(paletteCss(7)).toBe(css(PLAYER_COLORS[7]));
    expect(paletteIndex(2)).toBe(2);
    expect(paletteIndex(9)).toBe(0);
  });
});
