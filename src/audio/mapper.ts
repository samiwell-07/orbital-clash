// Pure mapping from SimEvents to sound calls (id, pan, volume). Collapses crowds into few calls.
import type { SimEvent, UnitKind } from '../types';
import { MAP_W } from '../config/constants';
import { SOUND_META } from './sound-ids';
import type { SoundId, SoundCall } from './sound-ids';

export const MAX_CALLS_PER_BATCH = 24;
const PAN_WIDTH = 0.8;

/** Map x (tiles) to stereo pan, keeping a little of both ears at the edges. */
export function panFromX(x: number): number {
  const p = (x / MAP_W) * 2 - 1;
  return Math.max(-1, Math.min(1, p)) * PAN_WIDTH;
}

const LAUNCH_SOUND: Partial<Record<UnitKind, SoundId>> = {
  torpedo: 'torpedo',
  carrier: 'carrierHum',
  thief: 'thiefSneak',
  switch: 'switchClick',
  hammer: 'hammerSmash',
};

const SHOT_SOUND = { laser: 'laserBeam', pulsar: 'pulsarPulse', bomber: 'bomberBomb' } as const;

type Hit = [id: SoundId, pan: number, vol: number];

/** Single event -> zero or more sounds. */
export function soundsForEvent(e: SimEvent): Hit[] {
  switch (e.t) {
    case 'structureBuilt': return [['build', panFromX(e.tx), 1]];
    case 'baseBuilt': return [['build', panFromX(e.tx), 1.1]];
    case 'structureUpgraded': return [['upgrade', 0, 1]];
    case 'techUnlocked': return [['upgrade', 0, 0.8]];
    case 'structureRecycled': return [['recycle', 0, 1]];
    case 'structureRepaired': return [['repair', 0, 1]];
    case 'structureHit': return [['structureHit', panFromX(e.x), 0.7]];
    case 'structureDestroyed': return [['explosionBig', panFromX(e.x), 1]];
    case 'unitSpawned': return [['spawn', 0, 0.5]];
    case 'unitLaunched': return [[LAUNCH_SOUND[e.kind] ?? 'launch', 0, 0.8]];
    case 'unitDied': return [[e.kind === 'hammer' ? 'hammerSmash' : 'unitDeath', panFromX(e.x), 0.8]];
    case 'shot': {
      const id = (SHOT_SOUND as Record<string, SoundId>)[e.kind] ?? 'turretShot';
      return [[id, panFromX(e.x), 0.8]];
    }
    case 'beam': return [['laserBeam', panFromX(e.x), 0.7]];
    case 'explosion': return [[e.big ? 'explosionBig' : 'explosion', panFromX(e.x), 0.9]];
    case 'rockGrabbed': return [['rockGrab', 0, 1]];
    case 'rockSmashed': return [['rockSmash', panFromX(e.x), 1]];
    case 'thorium': return e.amount > 0 ? [['thorium', 0, Math.min(1, 0.5 + e.amount / 200)]] : [];
    case 'baseHit': return [['baseAlarm', 0, e.hitsLeft <= 3 ? 1 : 0.8]];
    case 'baseDestroyed': return [['explosionBig', 0, 1]];
    case 'attackLocked': return [[e.locked ? 'uiConfirm' : 'uiBack', 0, 0.7]];
    case 'missionError': return [['uiDenied', 0, 0.8]];
    case 'denied': return [['uiDenied', 0, 0.8]];
    case 'timeUp': return [['timeUp', 0, 1]];
    case 'victory': return [['victory', 0, 1]];
    case 'defeat': return [['defeat', 0, 1]];
    default: return [];
  }
}

interface Acc { id: SoundId; panSum: number; vol: number; count: number }

/** Map a whole frame of events. Same sound at a similar pan becomes one call with a louder-by-log volume. */
export function mapEvents(events: readonly SimEvent[]): SoundCall[] {
  const acc = new Map<string, Acc>();
  for (const e of events) {
    for (const [id, pan, vol] of soundsForEvent(e)) {
      const key = `${id}|${Math.round(pan * 2)}`;
      const a = acc.get(key);
      if (a) {
        a.panSum += pan;
        a.count++;
        a.vol = Math.max(a.vol, vol);
      } else acc.set(key, { id, panSum: pan, vol, count: 1 });
    }
  }
  const calls = [...acc.values()].map<SoundCall>((a) => ({
    id: a.id,
    pan: a.panSum / a.count,
    vol: a.vol * Math.min(1.6, 1 + 0.3 * Math.log2(a.count)),
    count: a.count,
  }));
  calls.sort((x, y) => SOUND_META[y.id].prio - SOUND_META[x.id].prio);
  return calls.slice(0, MAX_CALLS_PER_BATCH);
}

export function handleEvents(events: readonly SimEvent[], play: (call: SoundCall) => void): void {
  if (events.length === 0) return;
  for (const call of mapEvents(events)) play(call);
}
