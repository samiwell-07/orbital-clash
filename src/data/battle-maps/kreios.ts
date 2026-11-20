import { arena } from './arena';

export const kreiosCrater = () => arena({
  id: 'battle-kreios-crater', name: 'Kreios Crater', palette: 'kreios', side: 28, start: 'corners', thorium: 2, rocks: 12,
  walls: [
    [[12, 8], [10, 8], [10, 10], [8, 10], [8, 12]],
    [[2, 10], [5, 10], [5, 12]], [[12, 2], [12, 5], [10, 5]],
  ], pits: [[13, 13]],
});

export const kreiosRidge = () => arena({
  id: 'battle-kreios-ridge', name: 'Kreios Ridge', palette: 'kreios', side: 30, start: 'corners', thorium: 1, rocks: 9,
  walls: [
    [[2, 8], [6, 8], [6, 10], [9, 10], [9, 12], [12, 12]],
    [[9, 2], [9, 5], [12, 5], [12, 8], [14, 8]],
  ], pits: [[14, 13]],
});

export const kreiosFissure = () => arena({
  id: 'battle-kreios-fissure', name: 'Kreios Fissure', palette: 'kreios', side: 29, start: [4, 5], thorium: 2, rocks: 10,
  walls: [
    [[10, 0], [10, 7], [13, 7], [13, 12], [16, 12]],
    [[2, 12], [7, 12], [7, 17], [10, 17], [10, 20]],
    [[21, 3], [21, 6], [24, 6]],
  ], pits: [[14, 9], [14, 10], [15, 10]],
});

export const kreiosBasin = () => arena({
  id: 'battle-kreios-basin', name: 'Kreios Basin', palette: 'kreios', side: 30, start: 'free', thorium: 1, rocks: 12,
  walls: [
    [[1, 10], [8, 10], [8, 8], [10, 8], [10, 3]],
    [[4, 13], [11, 13], [11, 11], [14, 11]],
  ], pits: [[14, 14], [6, 6]],
});
