import type { Intent, PlayerId } from '../types';

export const DEFAULT_INPUT_DELAY = 4;

export interface LockstepOptions {
  /** Own peer id. */
  me: number;
  /** Peers that own players (they must send one input packet per step). */
  participants: readonly number[];
  /** Input delay in steps: a packet made while executing step s is for step s + delay. */
  delay?: number;
  /** Which peer controls each player; intents for players a peer does not own are dropped. */
  owners: ReadonlyMap<PlayerId, number>;
}

const EMPTY: readonly Intent[] = [];

/**
 * Deterministic lockstep input buffers (no I/O). Every machine runs simulation step s only once it holds
 * every live participant's packet for s, then applies the packets merged in ascending peer order.
 */
export class Lockstep {
  readonly me: number;
  readonly delay: number;
  readonly participants: readonly number[];
  private readonly owners: ReadonlyMap<PlayerId, number>;
  private readonly buffers = new Map<number, Map<number, readonly Intent[]>>();
  private readonly left = new Set<number>();
  private nextStep = 0;
  private nextLocal: number;

  constructor(opts: LockstepOptions) {
    this.me = opts.me;
    this.delay = Math.max(0, Math.floor(opts.delay ?? DEFAULT_INPUT_DELAY));
    this.participants = [...new Set(opts.participants)].sort((a, b) => a - b);
    this.owners = opts.owners;
    for (const p of this.participants) this.buffers.set(p, new Map());
    this.nextLocal = this.delay;
  }

  /** Index of the next step to execute (= steps executed so far). */
  get step(): number {
    return this.nextStep;
  }

  get isParticipant(): boolean {
    return this.buffers.has(this.me) && !this.left.has(this.me);
  }

  /** True while the local packet for step + delay has not been produced yet. */
  needsLocal(): boolean {
    return this.isParticipant && this.nextLocal <= this.nextStep + this.delay;
  }

  /** Records this machine's packet for the next local step and returns that step (send it as {t:'input'}). */
  pushLocal(intents: readonly Intent[]): number {
    const step = this.nextLocal++;
    this.buffers.get(this.me)?.set(step, this.filter(this.me, intents));
    return step;
  }

  /** Stores a remote packet; duplicates, stale steps, non-participants and intents for foreign players are dropped. */
  receive(peer: number, step: number, intents: readonly Intent[]): void {
    const buf = this.buffers.get(peer);
    if (!buf || peer === this.me || this.left.has(peer)) return;
    if (!Number.isInteger(step) || step < this.delay || step < this.nextStep || buf.has(step)) return;
    if (!Array.isArray(intents)) return;
    buf.set(step, this.filter(peer, intents));
  }

  /** The peer is gone; it already delivered everything it sent, so its missing steps are empty from now on. */
  peerLeft(peer: number): void {
    if (this.buffers.has(peer)) this.left.add(peer);
  }

  hasLeft(peer: number): boolean {
    return this.left.has(peer);
  }

  /** Live participants whose packet for the next step is still missing. */
  waitingOn(): number[] {
    return this.participants.filter((p) => !this.ready(p, this.nextStep));
  }

  canStep(): boolean {
    return this.participants.every((p) => this.ready(p, this.nextStep));
  }

  /**
   * Consecutive steps from the next one for which every other live participant's packet is already here
   * (capped). Larger than delay + 1 means this machine is lagging behind the others. 0 when nobody else plays.
   */
  readyDepth(cap = 64): number {
    const others = this.participants.filter((p) => p !== this.me && !this.left.has(p));
    if (others.length === 0) return 0;
    let n = 0;
    while (n < cap && others.every((p) => this.ready(p, this.nextStep + n))) n++;
    return n;
  }

  /** Merged intents for the next step (ascending peer order, at most one pause), then advances. */
  take(): Intent[] {
    const step = this.nextStep++;
    const out: Intent[] = [];
    let paused = false;
    for (const p of this.participants) {
      const buf = this.buffers.get(p)!;
      const intents = buf.get(step) ?? EMPTY;
      buf.delete(step);
      for (const it of intents) {
        if (it.t === 'pause') {
          if (paused) continue;
          paused = true;
        }
        out.push(it);
      }
    }
    return out;
  }

  private ready(peer: number, step: number): boolean {
    return step < this.delay || this.left.has(peer) || this.buffers.get(peer)!.has(step);
  }

  private filter(peer: number, intents: readonly Intent[]): readonly Intent[] {
    return intents
      .filter((it) => !!it && typeof it === 'object' && (it.t === 'pause' || this.owners.get(it.player) === peer))
      .map((it): Intent => (it.t === 'pause' ? (typeof it.on === 'boolean' ? { t: 'pause', on: it.on } : { t: 'pause' }) : it));
  }
}
