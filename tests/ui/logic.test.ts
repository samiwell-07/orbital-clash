import { describe, expect, it } from 'vitest';
import { Form, buttonRows, type Row } from '../../src/ui/menus/form';
import { MessageFeed, currentHint } from '../../src/ui/hud/messages';
import { newPanelState, popScale, slideOffset, updatePanelState } from '../../src/ui/hud/state';
import { NameEntry } from '../../src/ui/screens/nameEntry';
import { NO_NAV, type UiNav } from '../../src/ui/screens/types';
import { fakePlayer } from './fakeWorld';

const nav = (o: Partial<UiNav>): UiNav => ({ ...NO_NAV, ...o });

describe('Form', () => {
  const rows = (): Row[] => [
    { k: 'label', id: 'h', label: 'Head' },
    { k: 'slider', id: 's', label: 'S', min: 0, max: 100, step: 1, value: 50 },
    { k: 'choice', id: 'c', label: 'C', options: ['a', 'b', 'c'], index: 0 },
    { k: 'button', id: 'off', label: 'Off', enabled: false },
    { k: 'button', id: 'go', label: 'Go' },
  ];

  it('starts on the first selectable row and skips labels and disabled buttons, wrapping', () => {
    const f = new Form(rows());
    expect(f.current?.id).toBe('s');
    f.move(1);
    expect(f.current?.id).toBe('c');
    f.move(1);
    expect(f.current?.id).toBe('go');
    f.move(1);
    expect(f.current?.id).toBe('s');
    f.move(-1);
    expect(f.current?.id).toBe('go');
  });

  it('adjusts sliders within bounds and cycles choices', () => {
    const f = new Form(rows());
    expect(f.handle(nav({ right: true }), 0.1)).toEqual({ changed: 's' });
    expect(f.value('s')).toBe(51);
    for (let i = 0; i < 200; i++) f.adjust(1);
    expect(f.value('s')).toBe(100);
    expect(f.adjust(1)).toBeUndefined();
    f.move(1);
    f.adjust(-1);
    expect(f.value('c')).toBe(2);
    expect(f.handle(nav({ confirm: true }), 0.1)).toEqual({ changed: 'c' });
    expect(f.value('c')).toBe(0);
  });

  it('accelerates a held slider and reports activation and back', () => {
    const f = new Form(rows());
    for (let i = 0; i < 12; i++) f.handle(nav({ left: true }), 0.12);
    expect(f.value('s')).toBeLessThan(50 - 12);
    f.move(1);
    f.move(1);
    expect(f.handle(nav({ confirm: true }), 0)).toEqual({ activated: 'go' });
    expect(f.handle(nav({ back: true }), 0)).toEqual({ back: true });
  });

  it('keeps the selection by id when rows are rebuilt', () => {
    const f = new Form(rows());
    f.move(1);
    f.setRows([...rows(), { k: 'button', id: 'extra', label: 'E' }]);
    expect(f.current?.id).toBe('c');
    expect(new Form(buttonRows([{ id: 'a', label: 'A' }])).current?.id).toBe('a');
  });
});

describe('MessageFeed', () => {
  it('shows messages, fades them out and expires them', () => {
    const feed = new MessageFeed();
    feed.push([{ t: 'message', text: 'Hello', owner: -1 }], 10);
    expect(feed.active(10.5)).toHaveLength(1);
    expect(feed.active(10.5)[0].alpha).toBe(1);
    const late = feed.active(10 + 5.8);
    expect(late[0].alpha).toBeLessThan(1);
    expect(feed.active(10 + 6.5)).toHaveLength(0);
  });

  it('refreshes duplicates instead of stacking and caps visible messages', () => {
    const feed = new MessageFeed();
    for (let i = 0; i < 5; i++) feed.push([{ t: 'denied', owner: 0, reason: 'not enough thorium' }], 1 + i * 0.1);
    expect(feed.active(1.6)).toHaveLength(1);
    feed.push([1, 2, 3, 4, 5, 6].map((n) => ({ t: 'message' as const, text: `m${n}`, owner: -1 as const })), 2);
    expect(feed.active(2.1).length).toBeLessThanOrEqual(4);
  });

  it('turns tech unlocks, mission errors and base hits into banners and flashes', () => {
    const feed = new MessageFeed();
    feed.push([
      { t: 'techUnlocked', owner: 0, key: 'tank' },
      { t: 'missionError', text: 'bad script' },
      { t: 'baseHit', target: 1, attacker: 0, hitsLeft: 7 },
      { t: 'baseHit', target: 1, attacker: 0, hitsLeft: 6 },
    ], 5);
    const kinds = feed.active(5.5).map((a) => a.msg.kind);
    expect(kinds.sort()).toEqual(['error', 'tech', 'warning']);
    expect(feed.active(5.5).find((a) => a.msg.kind === 'warning')?.msg.text).toContain('6 hits');
    expect(feed.hitFlash(1, 5.1)).toBeGreaterThan(0.7);
    expect(feed.hitFlash(1, 6)).toBe(0);
    expect(feed.hitFlash(2, 5)).toBe(0);
  });

  it('labels tech unlocked by a non-human owner as alien tech', () => {
    const feed = new MessageFeed();
    feed.push([
      { t: 'techUnlocked', owner: 0, key: 'laser' },
      { t: 'techUnlocked', owner: 1, key: 'pulsar' },
    ], 1, (owner) => owner === 0);
    expect(feed.active(1.1).map((a) => a.msg.text)).toEqual(['New tech unlocked: Lasers', 'Alien tech: Pulsars']);
  });
});

describe('hints and panel animation', () => {
  it('schedules hints one at a time and never in Resurgence', () => {
    const hints = ['first', 'second'];
    expect(currentHint(0, hints, false)).toBeNull();
    expect(currentHint(5, hints, false)).toBe('first');
    expect(currentHint(20, hints, false)).toBeNull();
    expect(currentHint(40, hints, false)).toBe('second');
    expect(currentHint(5, hints, true)).toBeNull();
  });

  it('drains the damage ghost over ~0.6 s, flashes on hits and counts thorium up', () => {
    const p = fakePlayer(0, { hits: 10, maxHits: 10, thorium: 100 });
    const st = newPanelState(p);
    p.hits = 5;
    updatePanelState(st, p, 1 / 60, 2);
    expect(st.hpFrac).toBe(0.5);
    expect(st.ghost).toBeGreaterThan(0.9);
    expect(st.flashAt).toBe(2);
    for (let i = 0; i < 40; i++) updatePanelState(st, p, 1 / 60, 2 + i / 60);
    expect(st.ghost).toBe(0.5);
    p.thorium = 400;
    updatePanelState(st, p, 1 / 60, 3);
    expect(st.thorium).toBeGreaterThan(100);
    expect(st.thorium).toBeLessThan(400);
    expect(st.popAt).toBe(3);
    expect(popScale(st, 3.05)).toBeGreaterThan(1);
    expect(popScale(st, 4)).toBe(1);
    expect(slideOffset(0, 0, 0, 100)).toBe(-100);
    expect(slideOffset(5, 0, 0, 100)).toBeCloseTo(0, 6);
  });
});

describe('NameEntry', () => {
  it('cycles letters, moves, and only submits a valid name on OK', () => {
    const e = new NameEntry();
    expect(e.value).toBe('AAA');
    e.handle(nav({ up: true }));
    expect(e.chars[0]).toBe('B');
    e.handle(nav({ down: true }));
    e.handle(nav({ down: true }));
    expect(e.chars[0]).toBe('-');
    e.handle(nav({ right: true }));
    expect(e.pos).toBe(1);
    for (let i = 0; i < 10; i++) e.handle(nav({ right: true }));
    expect(e.pos).toBe(8);
    expect(e.handle(nav({ confirm: true }))).toBe('-AA');
  });

  it('rejects names shorter than three characters', () => {
    const e = new NameEntry('AB');
    e.chars[2] = ' ';
    e.pos = 8;
    expect(e.valid).toBe(false);
    expect(e.handle(nav({ confirm: true }))).toBeNull();
  });
});
