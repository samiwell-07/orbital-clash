import { PALETTE_SIZE } from '../../config/playerColors';
import type { DeviceFrame, DeviceId, Seat } from '../../types';

export interface LobbyRules {
  minPlayers: number;
  maxPlayers: number;
  /** Palette indices nobody may pick (enemy / CPU colours). */
  takenColors: readonly number[];
}

export interface LobbySeat {
  device: DeviceId;
  colorIndex: number;
  ready: boolean;
  /** Room peer owning the device (0 = host / this machine offline). */
  peer: number;
}

export type LobbyEvent = 'none' | 'back' | 'start';

export const LOBBY_COUNTDOWN_SEC = 3;

/** Lobby name for a device (Controller 1..4, Keyboard (WASD) / (IJKL)). */
export function lobbyDeviceLabel(id: DeviceId): string {
  if (id === 'kb1') return 'Keyboard (WASD)';
  if (id === 'kb2') return 'Keyboard (IJKL)';
  return `Controller ${Number(id.slice(3)) + 1}`;
}

/** True when `colorIndex` is free for the seat at `seatIndex` (-1: for a newcomer) given the rules and current seats. */
export function lobbyColorFree(rules: LobbyRules, seats: readonly LobbySeat[], colorIndex: number, seatIndex = -1): boolean {
  if (rules.takenColors.includes(colorIndex)) return false;
  return !seats.some((s, i) => i !== seatIndex && s.colorIndex === colorIndex);
}

/**
 * Join/colour/ready state of the pre-match lobby. Pure: no drawing, no input polling.
 * A seat is identified by (peer, device): online, two machines can both seat their 'pad0'.
 */
export class LobbyState {
  readonly seats: LobbySeat[] = [];
  countdown: number | null = null;
  /** The shell couldn't start the match (bad setup, no WebGL): unready everyone so the lobby is usable again. */
  abortStart(): void {
    if (!this.started) return;
    this.started = false;
    this.countdown = null;
    for (const s of this.seats) s.ready = false;
  }

  get wasStarted(): boolean {
    return this.started;
  }

  private started = false;

  constructor(readonly rules: LobbyRules) {}

  seatOf(device: DeviceId, peer = 0): number {
    return this.seats.findIndex((s) => s.device === device && s.peer === peer);
  }

  /** Removes every seat of a room peer that left. Returns true when a seat was removed. */
  dropPeer(peer: number): boolean {
    let dropped = false;
    for (let i = this.seats.length - 1; i >= 0; i--) {
      if (this.seats[i].peer === peer) {
        this.seats.splice(i, 1);
        dropped = true;
      }
    }
    if (dropped && !this.started) this.countdown = null;
    return dropped;
  }

  /** True when `colorIndex` is free for the seat at `seatIndex` (-1: for a newcomer). */
  colorFree(colorIndex: number, seatIndex = -1): boolean {
    return lobbyColorFree(this.rules, this.seats, colorIndex, seatIndex);
  }

  get canStart(): boolean {
    const n = this.seats.length;
    return n >= this.rules.minPlayers && n <= this.rules.maxPlayers && n > 0 && this.seats.every((s) => s.ready);
  }

  update(frames: readonly DeviceFrame[], dt: number): LobbyEvent {
    if (this.started) return 'none';
    let changed = false;
    for (const f of frames) {
      const peer = f.peer ?? 0;
      const i = this.seatOf(f.id, peer);
      if (i < 0) {
        if (f.confirm && f.connected && this.seats.length < this.rules.maxPlayers) {
          const c = this.firstFreeColor();
          if (c !== null) {
            this.seats.push({ device: f.id, colorIndex: c, ready: false, peer });
            changed = true;
          }
        } else if (f.back && peer === 0 && !this.seats.some((s) => s.peer === 0)) {
          // Only this machine leaves the lobby, and only once none of its own devices is seated.
          return 'back';
        }
        continue;
      }
      const seat = this.seats[i];
      if (!f.connected) {
        this.seats.splice(i, 1);
        changed = true;
      } else if (seat.ready) {
        if (f.back) {
          seat.ready = false;
          changed = true;
        }
      } else if (f.back) {
        this.seats.splice(i, 1);
        changed = true;
      } else if (f.confirm) {
        seat.ready = true;
      } else if (f.left !== f.right) {
        const c = this.cycleColor(i, f.right ? 1 : -1);
        if (c !== seat.colorIndex) {
          seat.colorIndex = c;
          changed = true;
        }
      }
    }
    if (changed || !this.canStart) this.countdown = null;
    if (!this.canStart) return 'none';
    if (this.countdown === null) {
      this.countdown = LOBBY_COUNTDOWN_SEC;
      return 'none';
    }
    this.countdown = Math.max(0, this.countdown - dt);
    if (this.countdown <= 1e-6) {
      this.countdown = 0;
      this.started = true;
      return 'start';
    }
    return 'none';
  }

  toSeats(): Seat[] {
    return this.seats.map((s) => (s.peer ? { device: s.device, colorIndex: s.colorIndex, peer: s.peer } : { device: s.device, colorIndex: s.colorIndex }));
  }

  private firstFreeColor(): number | null {
    for (let c = 0; c < PALETTE_SIZE; c++) if (this.colorFree(c)) return c;
    return null;
  }

  private cycleColor(seatIndex: number, dir: 1 | -1): number {
    const cur = this.seats[seatIndex].colorIndex;
    for (let k = 1; k < PALETTE_SIZE; k++) {
      const c = (((cur + dir * k) % PALETTE_SIZE) + PALETTE_SIZE) % PALETTE_SIZE;
      if (this.colorFree(c, seatIndex)) return c;
    }
    return cur;
  }
}
