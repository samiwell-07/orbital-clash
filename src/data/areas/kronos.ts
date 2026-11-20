import { swarmMission, type SwarmArea } from './swarm';

const areas: readonly SwarmArea[] = [
  {
    name: 'Pendulum Yard', hits: 50, start: 560, par: 520,
    map: { size: 28, layout: 'side', thorium: 2, rocks: 17,
      ridges: [[10, 2, 10, 12, 13]], trenches: [[2, 6, 6], [12, 19, 16]] },
    briefing: 'The freight yard runs on an old clock. Every ground convoy is followed by a flight over the return track.',
    hints: ['Meet the first convoy at the turn. Leave room close to home for the air escort.'],
    installation: 'missileDefense', garrison: ['turret', 'bomber'], reinforcements: [[60, 'laser'], [186, 'pulsar']],
    waves: [[40, { tank: 12, snake: 7 }], [64, { dragon: 6 }], [170, { snake: 18 }], [194, { drone: 16 }], [355, { dragon: 12, tank: 18 }]],
  },
  {
    name: 'Escapement', hits: 54, start: 540, par: 550,
    map: { size: 29, thorium: 2, rocks: 16,
      ridges: [[2, 11, 12], [8, 14, 17], [2, 20, 7]], trenches: [[13, 3, 18], [6, 24, 9]] },
    briefing: 'Each tooth of the escapement shelters a demolition crew. The fast column waits for the crews to break cover.',
    hints: ['Keep your front towers repaired during the Hammer pass; the snakes arrive before the crews are gone.'],
    installation: 'researchLab', garrison: ['turret', 'pulsar', 'laser'], reinforcements: [[55, 'laser'], [130, 'turret'], [258, 'bomber']],
    waves: [[48, { hammer: 7 }], [67, { snake: 12 }], [185, { torpedo: 11 }], [212, { scout: 26, snake: 11 }], [390, { hammer: 15, dragon: 12 }]],
  },
  {
    name: 'Counterweight Mine', hits: 58, start: 490, par: 580,
    map: { size: 30, thorium: 1, rocks: 10,
      ridges: [[11, 2, 11, 12, 6], [3, 21, 9]], trenches: [[14, 6, 18, 9], [9, 17, 12]] },
    briefing: 'The mine hoist is running on its last counterweight. The miners left a working lab on the landing shelf.',
    hints: ['Use the salvaged lab rather than buying another. Thieves arrive in pairs of waves; do not leave your few rocks unguarded.'],
    salvage: 'researchLab', installation: 'researchLab', garrison: ['laser', 'bomber', 'turret'], reinforcements: [[85, 'pulsar'], [185, 'laser'], [290, 'pulsar']],
    waves: [[50, { thief: 9 }], [78, { thief: 8, snake: 9 }], [195, { dragon: 12 }], [320, { thief: 14, tank: 18 }], [455, { dragon: 18, snake: 16 }]],
  },
  {
    name: 'Dead Letter Relay', hits: 62, start: 570, par: 610,
    map: { size: 30, layout: 'side', thorium: 2, rocks: 16,
      ridges: [[11, 4, 17, 8], [9, 13, 12, 18]], trenches: [[2, 5, 6], [13, 22, 16]] },
    briefing: 'One outbound silo still answers the relay. The receiver on the far bank is hiding behind a flak screen.',
    hints: ['Your pad has a working silo. Send a ground force after the missile defence before committing to a long-range strike.'],
    salvage: 'missileSilo', installation: 'missileDefense', garrison: ['laser', 'pulsar', 'bomber'], reinforcements: [[52, 'turret'], [161, 'laser'], [295, 'bomber']],
    waves: [[46, { scout: 20, switch: 6 }], [120, { snake: 17, tank: 8 }], [240, { dragon: 15 }], [330, { torpedo: 14, switch: 10 }], [495, { dragon: 18, snake: 24 }]],
  },
  {
    name: 'Split Meridian', hits: 67, start: 600, par: 640,
    map: { size: 30, thorium: 2, rocks: 18,
      ridges: [[2, 12, 15], [2, 18, 8]], trenches: [[12, 3, 12, 8], [4, 21, 10, 24]] },
    briefing: 'The meridian is split across two shelves. The colony flies over the gap while its ground crews take the long road.',
    hints: ['The path around the shelf buys time against ground units, not Dragons. Watch the straight line to your base.'],
    installation: 'missileDefense', garrison: ['bomber', 'laser', 'pulsar'], reinforcements: [[82, 'bomber'], [178, 'laser'], [330, 'turret']],
    waves: [[40, { snake: 14 }], [96, { dragon: 10, drone: 12 }], [190, { tank: 22 }], [260, { dragon: 16 }], [385, { torpedo: 15, snake: 22 }], [515, { dragon: 22, drone: 24 }]],
  },
  {
    name: 'The Ninth Chime', hits: 72, start: 610, par: 660,
    map: { size: 29, layout: 'side', thorium: 2, rocks: 17,
      ridges: [[9, 2, 9, 17], [12, 18, 15, 21]], trenches: [[2, 5, 7], [12, 8, 16]] },
    briefing: 'A relief tug is nine minutes out. Keep the docking beacon lit until its crew can take over.',
    hints: ['Two short opening strikes leave time to build. Keep a second line ready for the arrivals just before the tug.'],
    alt: { id: 'docking', type: 'survive', text: 'Or hold the beacon for nine minutes', value: 540 },
    installation: 'researchLab', garrison: ['laser', 'pulsar', 'bomber'], reinforcements: [[38, 'laser'], [146, 'bomber'], [250, 'pulsar'], [365, 'turret']],
    waves: [[35, { dragon: 8 }], [70, { snake: 13 }], [185, { hammer: 11, tank: 15 }], [310, { snake: 24, thief: 10 }], [442, { dragon: 21, torpedo: 12 }], [485, { dragon: 16, snake: 26 }]],
  },
  {
    name: 'Stillpoint Foundry', hits: 80, start: 650, par: 700,
    map: { size: 30, thorium: 3, rocks: 21,
      ridges: [[11, 2, 11, 11, 4], [2, 17, 9, 20]], trenches: [[14, 5, 19], [6, 24, 10]] },
    briefing: 'The foundry has stopped turning, but its magazines are full. Take down the base or break eight installations.',
    hints: ['Use the foundry pauses to strike a tower. Destroying the installations can end the fight without breaching the base.'],
    alt: { id: 'foundry', type: 'destroyStructures', text: 'Or destroy eight foundry structures', value: 8 },
    installation: 'missileDefense', garrison: ['pulsar', 'laser', 'bomber', 'turret'], reinforcements: [[62, 'laser'], [143, 'bomber'], [265, 'turret'], [395, 'pulsar']],
    waves: [[42, { snake: 15, hammer: 6 }], [99, { dragon: 12 }], [172, { snake: 22, torpedo: 8 }], [285, { dragon: 18, drone: 18 }], [414, { tank: 25, switch: 10 }], [555, { dragon: 23, snake: 28 }]],
  },
];

export const KRONOS_AREAS = areas.map((s, i) => swarmMission('kronos', i, s));
export const KRONOS_RESURGENCE = swarmMission('kronos', 0, {
  name: 'Kronos Resurgence', hits: 92, start: 560, par: 760,
  map: { size: 30, layout: 'side', thorium: 1, rocks: 10,
    ridges: [[10, 2, 10, 16, 13], [14, 5, 17, 9]], trenches: [[2, 6, 6], [12, 19, 14]] },
  briefing: 'The pendulum has swung back. Every abandoned yard is sending stock to the same departure track.',
  installation: 'missileDefense', garrison: ['pulsar', 'bomber', 'laser', 'turret'], reinforcements: [[32, 'laser'], [102, 'bomber'], [201, 'pulsar'], [350, 'laser']],
  waves: [[28, { snake: 12, scout: 10 }], [72, { dragon: 12 }], [152, { torpedo: 12, snake: 20 }], [240, { dragon: 17, thief: 12 }], [347, { hammer: 16, tank: 24 }], [475, { dragon: 22, drone: 22 }], [626, { dragon: 25, snake: 33 }]],
}, true);
