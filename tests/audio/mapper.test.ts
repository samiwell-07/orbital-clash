import { describe, it, expect } from 'vitest';
import type { SimEvent } from '../../src/types';
import { MAP_W } from '../../src/config/constants';
import { mapEvents, panFromX, soundsForEvent, MAX_CALLS_PER_BATCH } from '../../src/audio/mapper';
import { SOUND_META } from '../../src/audio/sound-ids';
import { createRateLimiter } from '../../src/audio/rate-limiter';
import { createAudio } from '../../src/audio';
import { getBus, unlockContext } from '../../src/audio/context';

const died = (x: number, kind: 'scout' | 'hammer' = 'scout'): SimEvent => ({
  t: 'unitDied', id: 1, kind, owner: 0, x, y: 5, killer: 1,
});

describe('panFromX', () => {
  it('maps the map width to stereo and clamps', () => {
    expect(panFromX(MAP_W / 2)).toBeCloseTo(0);
    expect(panFromX(0)).toBeLessThan(0);
    expect(panFromX(MAP_W)).toBeGreaterThan(0);
    expect(panFromX(MAP_W * 5)).toBe(panFromX(MAP_W));
    expect(Math.abs(panFromX(-100))).toBeLessThanOrEqual(1);
  });
});

describe('event mapping', () => {
  it('chooses sounds by event type and kind', () => {
    const id = (e: SimEvent) => soundsForEvent(e)[0]?.[0];
    expect(id({ t: 'shot', from: 1, kind: 'pulsar', x: 1, y: 1, tx: 2, ty: 2 })).toBe('pulsarPulse');
    expect(id({ t: 'shot', from: 1, kind: 'turret', x: 1, y: 1, tx: 2, ty: 2 })).toBe('turretShot');
    expect(id({ t: 'unitLaunched', owner: 0, kind: 'torpedo', count: 3 })).toBe('torpedo');
    expect(id({ t: 'unitLaunched', owner: 0, kind: 'scout', count: 3 })).toBe('launch');
    expect(id(died(3, 'hammer'))).toBe('hammerSmash');
    expect(id({ t: 'structureDestroyed', id: 1, kind: 'turret', owner: 0, x: 1, y: 1 })).toBe('explosionBig');
    expect(id({ t: 'baseHit', target: 0, attacker: 1, hitsLeft: 2 })).toBe('baseAlarm');
    expect(id({ t: 'victory', team: 0 })).toBe('victory');
    expect(id({ t: 'denied', owner: 0, reason: 'x' })).toBe('uiDenied');
    expect(soundsForEvent({ t: 'message', text: 'hi', owner: -1 })).toEqual([]);
    expect(soundsForEvent({ t: 'thorium', owner: 0, amount: 0 })).toEqual([]);
  });

  it('pans left/right from x', () => {
    const [l] = mapEvents([died(2)]);
    const [r] = mapEvents([died(MAP_W - 2)]);
    expect(l.pan).toBeLessThan(0);
    expect(r.pan).toBeGreaterThan(0);
  });

  it('collapses thousands of identical events into one louder, bounded call', () => {
    const many = Array.from({ length: 5000 }, () => died(10));
    const calls = mapEvents(many);
    expect(calls).toHaveLength(1);
    expect(calls[0].count).toBe(5000);
    const single = mapEvents([died(10)])[0];
    expect(calls[0].vol).toBeGreaterThan(single.vol);
    expect(calls[0].vol).toBeLessThanOrEqual(1.6);
  });

  it('caps calls per batch and keeps the highest priority', () => {
    const events: SimEvent[] = [];
    for (let x = 0; x < MAP_W; x += 1) events.push(died(x), { t: 'rockSmashed', id: 1, x, y: 1, thorium: 5, owner: 0 });
    events.push({ t: 'defeat', team: 0 });
    const calls = mapEvents(events);
    expect(calls.length).toBeLessThanOrEqual(MAX_CALLS_PER_BATCH);
    expect(calls[0].id).toBe('defeat');
    const prios = calls.map((c) => SOUND_META[c.id].prio);
    expect([...prios].sort((a, b) => b - a)).toEqual(prios);
  });
});

describe('rate limiter', () => {
  it('allows up to max per window with falling volume, then blocks', () => {
    const rl = createRateLimiter();
    const a = rl.acquire('k', 1, 3, 0.05);
    const b = rl.acquire('k', 1.01, 3, 0.05);
    const c = rl.acquire('k', 1.02, 3, 0.05);
    expect(a).toBe(1);
    expect(b).toBeLessThan(a);
    expect(c).toBeLessThan(b);
    expect(rl.acquire('k', 1.03, 3, 0.05)).toBe(0);
  });

  it('recovers after the window and isolates keys', () => {
    const rl = createRateLimiter();
    rl.acquire('k', 1, 1, 0.05);
    expect(rl.acquire('k', 1.01, 1, 0.05)).toBe(0);
    expect(rl.acquire('other', 1.01, 1, 0.05)).toBe(1);
    expect(rl.acquire('k', 1.06, 1, 0.05)).toBe(1);
  });
});

describe('no AudioContext (node)', () => {
  it('is a graceful no-op', async () => {
    expect(getBus()).toBeNull();
    expect(await unlockContext()).toBe(false);
    const audio = createAudio();
    audio.unlock();
    audio.setVolume(1, 1, 1);
    audio.music('game');
    audio.handle([died(1)]);
    audio.ui('uiConfirm');
    audio.music('off');
  });
});
