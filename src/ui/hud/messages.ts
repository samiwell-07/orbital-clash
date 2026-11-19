import type { PlayerId, SimEvent } from '../../types';
import { researchDef } from '../../data';
import { humanize } from '../format';

export type MsgKind = 'info' | 'denied' | 'tech' | 'warning' | 'error';

export interface FeedMessage {
  id: number;
  kind: MsgKind;
  text: string;
  owner: PlayerId | -1;
  born: number;
  /** Last time the same message was (re)pushed; expiry counts from here. */
  last: number;
  ttl: number;
}

const TTL: Record<MsgKind, number> = { info: 6, denied: 2.2, tech: 6, warning: 3, error: 9 };
const FADE = 0.5;
const MAX_ACTIVE = 4;

export function techLabel(key: string): string {
  return researchDef(key)?.name ?? humanize(key);
}

/** Turns SimEvents into short-lived banner messages and tracks per-base hit flashes. */
export class MessageFeed {
  private list: FeedMessage[] = [];
  private nextId = 1;
  private lastHit: Record<number, number> = {};

  /** isHuman tells player-owned tech unlocks from alien ones (default: every owner counts as human). */
  push(events: readonly SimEvent[], now: number, isHuman: (owner: PlayerId) => boolean = () => true): void {
    for (const e of events) {
      switch (e.t) {
        case 'message':
          this.add('info', e.text, e.owner, now);
          break;
        case 'denied':
          this.add('denied', e.reason, e.owner, now);
          break;
        case 'techUnlocked':
          this.add('tech', `${isHuman(e.owner) ? 'New tech unlocked' : 'Alien tech'}: ${techLabel(e.key)}`, e.owner, now);
          break;
        case 'baseHit':
          this.lastHit[e.target] = now;
          this.add('warning', `Base under attack! ${Math.max(0, e.hitsLeft)} hits left`, e.target, now);
          break;
        case 'missionError':
          this.add('error', e.text, -1, now);
          break;
        default:
          break;
      }
    }
  }

  /** Same kind+text refreshes the existing banner instead of stacking duplicates. */
  private add(kind: MsgKind, text: string, owner: PlayerId | -1, now: number): void {
    const dup = this.list.find((m) => m.kind === kind && (m.text === text || (kind === 'warning' && m.owner === owner)));
    if (dup) {
      dup.text = text;
      dup.last = now;
      return;
    }
    this.list.push({ id: this.nextId++, kind, text, owner, born: now, last: now, ttl: TTL[kind] });
    if (this.list.length > MAX_ACTIVE + 4) this.list.shift();
  }

  /** Active messages (oldest first, at most MAX_ACTIVE newest) with a fade-out alpha. */
  active(now: number): { msg: FeedMessage; alpha: number }[] {
    this.list = this.list.filter((m) => now - m.last < m.ttl);
    return this.list.slice(-MAX_ACTIVE).map((msg) => {
      const left = msg.ttl - (now - msg.last);
      const inA = Math.min(1, (now - msg.born) / 0.12);
      return { msg, alpha: Math.min(inA, left < FADE ? Math.max(0, left / FADE) : 1) };
    });
  }

  /** 1 right after a base was hit, fading to 0 over half a second. */
  hitFlash(player: number, now: number): number {
    const t = this.lastHit[player];
    return t === undefined ? 0 : Math.max(0, 1 - (now - t) / 0.5);
  }

  clear(): void {
    this.list = [];
    this.lastHit = {};
  }
}

/** One hint at a time: hint i shows during [4 + 35 i, 14 + 35 i) mission seconds. Resurgence has none. */
export function currentHint(timeSec: number, hints: readonly string[], resurgence: boolean): string | null {
  if (resurgence) return null;
  for (let i = 0; i < hints.length; i++) {
    const start = 4 + 35 * i;
    if (timeSec >= start && timeSec < start + 10) return hints[i];
  }
  return null;
}
