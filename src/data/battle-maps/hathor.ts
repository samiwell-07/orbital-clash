import { arena } from './arena';

export const hathorDunes = () => arena({
  id: 'battle-hathor-dunes', name: 'Hathor Dunes', palette: 'hathor', side: 28, start: 'corners', thorium: 3, rocks: 14,
  walls: [
    [[0, 9], [6, 9], [6, 11], [10, 11]],
    [[9, 2], [9, 6], [12, 6], [12, 8]],
  ], pits: [[11, 3], [3, 12]],
});

export const hathorOasis = () => arena({
  id: 'battle-hathor-oasis', name: 'Hathor Oasis', palette: 'hathor', side: 29, start: 'free', thorium: 3, rocks: 16,
  walls: [
    [[12, 8], [10, 8], [10, 9], [8, 9], [8, 12], [6, 12]],
    [[3, 10], [3, 5], [6, 5]], [[11, 3], [14, 3]],
  ], pits: [[14, 14], [13, 14], [13, 13], [14, 12], [14, 13]],
});

export const hathorMesa = () => arena({
  id: 'battle-hathor-mesa', name: 'Hathor Mesa', palette: 'hathor', side: 30, start: 'corners', thorium: 3, rocks: 13,
  walls: [
    [[8, 2], [8, 8], [3, 8], [3, 9], [9, 9], [9, 2], [8, 2]],
    [[5, 13], [11, 13], [11, 10], [14, 10]],
  ], pits: [[12, 5], [12, 6]],
});

export const hathorCanyon = () => arena({
  id: 'battle-hathor-canyon', name: 'Hathor Canyon', palette: 'hathor', side: 30, start: [4, 14], thorium: 2, rocks: 11,
  walls: [
    [[0, 9], [10, 9], [10, 6], [16, 6]],
    [[14, 10], [20, 10], [20, 14], [22, 14]],
    [[6, 18], [6, 24], [10, 24]], [[23, 4], [28, 4]],
  ], pits: [[14, 3], [15, 3]],
});
