import { arena } from './arena';

export const aetherDrift = () => arena({
  id: 'battle-aether-drift', name: 'Aether Drift', palette: 'aether', side: 28, start: [4, 13], thorium: 1, rocks: 8,
  walls: [
    [[0, 7], [8, 7], [8, 10], [17, 10], [17, 6], [21, 6]],
    [[12, 0], [12, 4], [15, 4]], [[3, 18], [7, 18], [7, 22]],
  ], pits: [[12, 7], [13, 7]],
});

export const aetherSpires = () => arena({
  id: 'battle-aether-spires', name: 'Aether Spires', palette: 'aether', side: 30, start: 'free', thorium: 2, rocks: 11,
  walls: [
    [[3, 11], [7, 11], [7, 8], [10, 8], [10, 5], [12, 5], [12, 2]],
    [[9, 14], [9, 12], [12, 12], [12, 10], [14, 10]],
  ], pits: [[6, 3], [14, 14]],
});

export const aetherPrism = () => arena({
  id: 'battle-aether-prism', name: 'Aether Prism', palette: 'aether', side: 29, start: 'corners', thorium: 1, rocks: 9,
  walls: [
    [[12, 6], [12, 8], [10, 8], [10, 10], [8, 10], [8, 12], [6, 12]],
    [[13, 2], [9, 2], [9, 4]], [[2, 9], [4, 9], [4, 11]],
    [[13, 10], [13, 12], [11, 12]],
  ], pits: [[14, 14]],
});

export const aetherHalo = () => arena({
  id: 'battle-aether-halo', name: 'Aether Halo', palette: 'aether', side: 30, start: [4, 5], thorium: 2, rocks: 10,
  walls: [
    [[8, 17], [8, 8], [19, 8], [19, 6], [22, 6]],
    [[12, 16], [12, 12], [16, 12]], [[2, 11], [5, 11], [5, 20], [8, 20]],
  ], pits: [[14, 14], [14, 15]],
});
