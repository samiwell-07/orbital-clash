import { arena } from './arena';

export const heliosForge = () => arena({
  id: 'battle-helios-forge', name: 'Helios Forge', palette: 'helios', side: 30, start: 'corners', thorium: 2, rocks: 14,
  walls: [
    [[0, 11], [7, 11], [7, 9], [10, 9], [10, 4]],
    [[9, 14], [9, 12], [12, 12], [12, 10], [13, 10]],
  ], pits: [[14, 13], [14, 14], [13, 14]],
});

export const heliosFurnace = () => arena({
  id: 'battle-helios-furnace', name: 'Helios Furnace', palette: 'helios', side: 30, start: 'free', thorium: 3, rocks: 15,
  walls: [
    [[2, 8], [11, 8], [11, 4], [14, 4]], [[0, 12], [6, 12], [6, 14]],
    [[10, 14], [10, 11], [13, 11]],
  ], pits: [[8, 6], [9, 6], [9, 5], [12, 13]],
});

export const heliosCaldera = () => arena({
  id: 'battle-helios-caldera', name: 'Helios Caldera', palette: 'helios', side: 30, start: 'corners', thorium: 2, rocks: 15,
  walls: [
    [[13, 7], [11, 7], [11, 9], [9, 9], [9, 11], [7, 11], [7, 14]],
    [[9, 2], [9, 5], [12, 5]], [[2, 8], [4, 8], [4, 12]],
  ], pits: [[14, 14], [13, 14], [13, 13], [14, 12], [14, 13], [12, 14]],
});

export const heliosVents = () => arena({
  id: 'battle-helios-vents', name: 'Helios Vents', palette: 'helios', side: 30, start: 'free', thorium: 3, rocks: 14,
  walls: [
    [[7, 1], [7, 7], [9, 7], [9, 10], [12, 10], [12, 12]],
    [[2, 12], [5, 12], [5, 14]], [[12, 3], [14, 3]],
  ], pits: [[8, 5], [8, 6], [10, 9], [14, 14]],
});
