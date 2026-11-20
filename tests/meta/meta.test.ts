import { describe, it, expect } from 'vitest';
import {
  computeRank, computeScore, submitScore, getBoard, boardKey, flagFromLocale, qualifies, LEADERBOARD_SIZE,
  evaluateTrophies, newTrophyProgress, TROPHIES, drainTrophyNotifications,
  loadSave, saveSave, newSave, recordAreaComplete, isAreaUnlocked, isResurgenceUnlocked, isCometUnlocked,
  memoryStorage, SAVE_VERSION, sanitizeSettings,
} from '../../src/meta';
import type { Leaderboards, SaveData, TrophyEvent, TrophyProgress } from '../../src/meta';
import type { CometId } from '../../src/types';
import { SAVE_KEY } from '../../src/config/constants';

describe('rank', () => {
  it('ranks by (time + penalties) / par', () => {
    expect(computeRank(60, 0, 100, 'normal')).toBe('S');
    expect(computeRank(100, 0, 100, 'normal')).toBe('A');
    expect(computeRank(90, 20, 100, 'normal')).toBe('B');
    expect(computeRank(150, 0, 100, 'normal')).toBe('C');
    expect(computeRank(250, 0, 100, 'normal')).toBe('D');
    expect(computeRank(70, 10, 100, 'expert')).toBe('A');
  });
  it('caps unranked difficulties', () => {
    expect(computeRank(10, 0, 100, 'beginner')).toBe('C');
    expect(computeRank(10, 0, 100, 'casual')).toBe('B');
    expect(computeRank(250, 0, 100, 'beginner')).toBe('D');
  });
  it('scores faster runs and harder difficulty higher, penalties subtract', () => {
    expect(computeScore(50, 0, 100, 'normal')).toBeGreaterThan(computeScore(100, 0, 100, 'normal'));
    expect(computeScore(100, 0, 100, 'expert')).toBeGreaterThan(computeScore(100, 0, 100, 'normal'));
    expect(computeScore(100, 0, 100, 'normal')).toBe(10000);
    expect(computeScore(95, 5, 100, 'normal')).toBe(10000 - 50);
  });
});

describe('leaderboard', () => {
  const key = boardKey('kreios', 0, 'normal');
  it('orders by score desc then time asc and keeps top 10', () => {
    const b: Leaderboards = {};
    for (let i = 0; i < 12; i++) submitScore(b, key, `Pilot${i}`, 1000 + i * 10, 50, 'US');
    expect(getBoard(b, key)).toHaveLength(LEADERBOARD_SIZE);
    const scores = getBoard(b, key).map((e) => e.score);
    expect([...scores].sort((a, c) => c - a)).toEqual(scores);
    expect(scores[LEADERBOARD_SIZE - 1]).toBe(1020);
    submitScore(b, key, 'Tie', scores[0], 10, 'US');
    expect(getBoard(b, key)[0].name).toBe('Tie');
  });
  it('rejects bad names and low scores on a full board', () => {
    const b: Leaderboards = {};
    expect(submitScore(b, key, 'ab', 5, 10)).toEqual({ ok: false, reason: 'badName' });
    expect(submitScore(b, key, 'waytoolongname', 5, 10)).toEqual({ ok: false, reason: 'badName' });
    for (let i = 0; i < 10; i++) submitScore(b, key, `Pilot${i}`, 100 + i, 30, 'GB');
    expect(qualifies(b, key, 50)).toBe(false);
    expect(submitScore(b, key, 'Late', 50, 30, 'GB')).toEqual({ ok: false, reason: 'tooLow' });
  });
  it('only registers a repeat entry (and its flag) when the score is better', () => {
    const b: Leaderboards = {};
    submitScore(b, key, 'Ace', 500, 40, 'US');
    expect(submitScore(b, key, 'ace', 400, 30, 'FR')).toEqual({ ok: false, reason: 'notBetter' });
    expect(submitScore(b, key, 'ACE', 500, 30, 'FR')).toEqual({ ok: false, reason: 'notBetter' });
    expect(getBoard(b, key)[0].flag).toBe('US');
    expect(submitScore(b, key, 'Ace', 600, 35, 'FR')).toEqual({ ok: true, position: 0 });
    expect(getBoard(b, key)).toHaveLength(1);
    expect(getBoard(b, key)[0].flag).toBe('FR');
  });
  it('derives the flag from the locale region else XX', () => {
    expect(flagFromLocale('en-GB')).toBe('GB');
    expect(flagFromLocale('pt_br')).toBe('BR');
    expect(flagFromLocale('en')).toBe('XX');
    expect(flagFromLocale('')).toBe('XX');
  });
});

describe('trophies', () => {
  const run = (events: TrophyEvent[], start: TrophyProgress = newTrophyProgress()) => {
    let p = start;
    const got: string[] = [];
    events.forEach((e, i) => {
      const r = evaluateTrophies(p, e, i);
      p = r.progress;
      got.push(...r.unlocked);
    });
    return { p, got };
  };
  type Kind = 'scout' | 'tank' | 'drone' | 'torpedo' | 'hammer' | 'switch' | 'thief' | 'carrier';
  const launch = (kind: Kind, count = 1): TrophyEvent => ({ t: 'unitLaunched', owner: 0, kind, count });

  it('defines exactly 12 unique trophies', () => {
    expect(TROPHIES).toHaveLength(12);
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(12);
  });
  it('unlocks launch milestones and the full roster', () => {
    expect(run([launch('scout', 99)]).got).toEqual([]);
    expect(run([launch('scout', 99), launch('tank', 1)]).got).toEqual(['hundredStrong']);
    const kinds: Kind[] = ['scout', 'tank', 'drone', 'torpedo', 'hammer', 'switch', 'thief'];
    expect(run(kinds.map((k) => launch(k))).got).not.toContain('fullRoster');
    expect(run([...kinds, 'carrier' as Kind].map((k) => launch(k))).got).toContain('fullRoster');
    expect(run([launch('scout', 1000)]).got).toContain('thousandFleet');
  });
  it('requires all four weapons built by a local player', () => {
    const b = (kind: 'turret' | 'laser' | 'pulsar' | 'bomber', owner: 0 | 1 = 0): TrophyEvent =>
      ({ t: 'structureBuilt', id: 1, kind, owner, tx: 0, ty: 0 });
    expect(run([b('turret'), b('laser'), b('pulsar'), b('bomber', 1)]).got).toEqual([]);
    expect(run([b('turret'), b('laser'), b('pulsar'), b('bomber')]).got).toEqual(['fullArsenal']);
  });
  it('flawless base kill needs zero hits taken by the local base', () => {
    const kill: TrophyEvent = { t: 'baseDestroyed', target: 1, attacker: 0 };
    const hit: TrophyEvent = { t: 'baseHit', target: 0, attacker: 1, hitsLeft: 5 };
    expect(run([hit, kill]).got).toEqual([]);
    expect(run([kill]).got).toEqual(['untouched']);
    expect(run([hit, { t: 'runStart', localPlayers: [0] }, kill]).got).toEqual(['untouched']);
  });
  it('area, comet, expert, coop, battle and four-player trophies', () => {
    expect(run([{ t: 'areaComplete', difficulty: 'normal', cometCleared: false, coopPlayers: 1 }]).got).toEqual(['firstContact']);
    const all = run([{ t: 'areaComplete', difficulty: 'expert', cometCleared: true, coopPlayers: 2 }]).got;
    expect(all).toEqual(expect.arrayContaining(['firstContact', 'cometClear', 'veteran', 'wingmates']));
    expect(run([{ t: 'battleEnd', won: true, players: 4 }]).got).toEqual(expect.arrayContaining(['victor', 'fourCorners']));
    expect(run([{ t: 'battleEnd', won: false, players: 2 }]).got).toEqual([]);
  });
  it('rock-smash streak breaks when smashes are too far apart', () => {
    const smash: TrophyEvent = { t: 'rockSmashed', id: 1, x: 0, y: 0, thorium: 1, owner: 0 };
    expect(run(Array.from({ length: 8 }, () => smash)).got).toEqual(['rockBreaker']);
    let p = newTrophyProgress();
    for (let i = 0; i < 20; i++) p = evaluateTrophies(p, smash, i * 30).progress;
    expect(p.unlocked).toEqual([]);
  });
  it('is pure, does not re-unlock, and drains notifications', () => {
    const p0 = newTrophyProgress();
    const win: TrophyEvent = { t: 'battleEnd', won: true, players: 2 };
    const r = evaluateTrophies(p0, win);
    expect(p0.unlocked).toEqual([]);
    expect(evaluateTrophies(r.progress, win).unlocked).toEqual([]);
    const d = drainTrophyNotifications(r.progress);
    expect(d.notifications.map((t) => t.id)).toEqual(['victor']);
    expect(d.progress.pending).toEqual([]);
  });
});

describe('save and campaign unlocks', () => {
  const complete = (s: SaveData, cometId: CometId, index: number, resurgence = false) =>
    recordAreaComplete(s, { cometId, index, difficulty: 'normal', timeSec: 80, penaltySec: 5, score: 9000, parTimeSec: 100, resurgence });

  it('unlocks areas in order and the next comet / resurgence after seven areas', () => {
    let s = newSave();
    expect(isAreaUnlocked(s, 'kreios', 0)).toBe(true);
    expect(isAreaUnlocked(s, 'kreios', 1)).toBe(false);
    expect(isCometUnlocked(s, 'hathor')).toBe(false);
    for (let i = 0; i < 6; i++) {
      const r = complete(s, 'kreios', i);
      s = r.save;
      expect(r.cometCleared).toBe(false);
      expect(isAreaUnlocked(s, 'kreios', i + 1)).toBe(true);
    }
    expect(isResurgenceUnlocked(s, 'kreios')).toBe(false);
    const last = complete(s, 'kreios', 6);
    s = last.save;
    expect(last.cometCleared).toBe(true);
    expect(last.resurgenceJustUnlocked).toBe(true);
    expect(last.nextCometJustUnlocked).toBe('hathor');
    expect(last.trophiesUnlocked).toContain('cometClear');
    expect(isResurgenceUnlocked(s, 'kreios')).toBe(true);
    expect(isCometUnlocked(s, 'hathor')).toBe(true);
    expect(isAreaUnlocked(s, 'kreios', 0, true)).toBe(true);
    expect(isAreaUnlocked(s, 'kreios', 1, true)).toBe(false);
    expect(isAreaUnlocked(s, 'hathor', 0, true)).toBe(false);
  });
  it('keeps best time, rank and score across replays', () => {
    const first = complete(newSave(), 'kreios', 0).save;
    const worse = recordAreaComplete(first, { cometId: 'kreios', index: 0, difficulty: 'expert', timeSec: 200, penaltySec: 0, score: 100, parTimeSec: 100, coopPlayers: 2 });
    expect(worse.newBestTime).toBe(false);
    const a = worse.save.comets.kreios.areas[0]!;
    expect([a.bestTimeSec, a.bestScore, a.bestRank, a.completions, a.lastDifficulty, a.coopPlayers]).toEqual([85, 9000, 'A', 2, 'expert', 2]);
  });
  it('loads a v1 save at its original key and adds an independently playable expansion', () => {
    const st = memoryStorage();
    const base = complete(newSave(), 'kreios', 0).save;
    submitScore(base.leaderboards, boardKey('kreios', 0, 'normal'), 'Pilot', 9000, 85);
    const { kreios, hathor, aether, helios } = base.comets;
    st.setItem(SAVE_KEY, JSON.stringify({ ...base, version: 1, comets: { kreios, hathor, aether, helios } }));
    let s = loadSave(st);
    expect(s).toEqual(base);
    expect(isAreaUnlocked(s, 'gaia', 0)).toBe(true);
    expect(isAreaUnlocked(s, 'gaia', 0, true)).toBe(false);
    expect(isCometUnlocked(s, 'kronos')).toBe(false);
    for (let i = 0; i < 7; i++) {
      expect(isAreaUnlocked(s, 'gaia', i)).toBe(true);
      const rec = complete(s, 'gaia', i);
      expect(rec.nextCometJustUnlocked).toBe(i === 6 ? 'kronos' : null);
      s = rec.save;
    }
    expect(isAreaUnlocked(s, 'gaia', 0, true)).toBe(true);
    expect(isAreaUnlocked(s, 'kronos', 0)).toBe(true);
    expect(isCometUnlocked(s, 'hathor')).toBe(false);
    s = complete(s, 'gaia', 0, true).save;
    saveSave(s, st);
    expect(loadSave(st)).toEqual(s);
  });
  it('round-trips through storage and survives corrupt data', () => {
    const st = memoryStorage();
    const s = complete(newSave(), 'kreios', 0).save;
    expect(saveSave(s, st)).toBe(true);
    expect(loadSave(st)).toEqual(s);
    const bads = ['{not json', 'null', '42', '[]', '{"version":1,"comets":{"kreios":{"areas":"x"}},"settings":{"masterVolume":"loud"},"leaderboards":5}'];
    for (const bad of bads) {
      st.setItem(SAVE_KEY, bad);
      const loaded = loadSave(st);
      expect(loaded.version).toBe(SAVE_VERSION);
      expect(loaded.comets.kreios.areas).toHaveLength(7);
      expect(loaded.settings.masterVolume).toBeGreaterThanOrEqual(0);
    }
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); }, removeItem: () => undefined };
    expect(loadSave(throwing).lastPlayed).toBeNull();
    expect(saveSave(s, throwing)).toBe(false);
  });
  it('preserves four-player campaign completions through saving and loading', () => {
    const st = memoryStorage();
    const { save } = recordAreaComplete(newSave(), {
      cometId: 'gaia', index: 0, difficulty: 'expert', timeSec: 80, penaltySec: 0, score: 9000, coopPlayers: 4,
    });
    expect(saveSave(save, st)).toBe(true);
    const loaded = loadSave(st);
    expect(loaded.comets.gaia.areas[0]?.coopPlayers).toBe(4);
    expect(loaded.lastPlayed).toMatchObject({ difficulty: 'expert', coopPlayers: 4 });
  });
  it('clamps out-of-range settings', () => {
    const st = sanitizeSettings({ masterVolume: 9, videoLayout: '4:3', defaultDifficulty: 'nope', lastBattle: { players: 99, maxHits: -3 } });
    expect([st.masterVolume, st.videoLayout, st.defaultDifficulty, st.lastBattle.players, st.lastBattle.maxHits]).toEqual([1, '4:3', 'normal', 4, 1]);
  });
});
