import { DEVICE_IDS, type DeviceFrame, type DeviceId } from '../types/input';
import { AXIS, KEY_SETS, NAV_KEYS, PAD, TUNING } from './bindings';
import { HoldRepeater, readGamepad, type GetGamepads, type PadSnapshot } from './gamepad';
import { keyboardSnapshot, type KeyDown } from './keyboard';

const LABELS: Record<DeviceId, string> = {
  pad0: 'Controller 1',
  pad1: 'Controller 2',
  pad2: 'Controller 3',
  pad3: 'Controller 4',
  kb1: 'Keyboard (WASD)',
  kb2: 'Keyboard (IJKL)',
};

export function deviceLabel(id: DeviceId): string {
  return LABELS[id];
}

export function isPadDevice(id: DeviceId): boolean {
  return id.startsWith('pad');
}

/** Gamepad index for pad0..pad3, keyboard key-set index (0 = WASD, 1 = IJKL) for kb1/kb2. */
export function deviceIndex(id: DeviceId): number {
  return isPadDevice(id) ? Number(id.slice(3)) : Number(id.slice(2)) - 1;
}

/** Raw snapshot of one device; null when the pad is not connected. Keyboards always return a snapshot. */
export function snapshotFor(device: DeviceId, pads: ReturnType<GetGamepads>, keyboard: KeyDown): PadSnapshot | null {
  const i = deviceIndex(device);
  return isPadDevice(device) ? readGamepad(pads, i) : keyboardSnapshot(keyboard, KEY_SETS[i]);
}

function idleFrame(id: DeviceId, connected: boolean): DeviceFrame {
  return { id, connected, confirm: false, back: false, left: false, right: false, start: false, alt: false };
}

export function idleFrames(): DeviceFrame[] {
  return DEVICE_IDS.map((id) => idleFrame(id, !isPadDevice(id)));
}

interface DeviceState {
  confirm: boolean;
  back: boolean;
  start: boolean;
  alt: boolean;
  left: HoldRepeater;
  right: HoldRepeater;
}

/** Buttons held when a device is first seen (tracker start or pad connect) count as already down: a fresh press is required. */
function freshState(): DeviceState {
  return {
    confirm: true,
    back: true,
    start: true,
    alt: true,
    left: new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true),
    right: new HoldRepeater(TUNING.navDelaySec, TUNING.navRepeatSec, true),
  };
}

/** Per-device lobby input (edges + auto-repeat), independent of player bindings. */
export class DeviceTracker {
  private readonly states = new Map<DeviceId, DeviceState>(DEVICE_IDS.map((id) => [id, freshState()]));

  update(pads: ReturnType<GetGamepads>, keyboard: KeyDown, dt: number): DeviceFrame[] {
    return DEVICE_IDS.map((id) => {
      const snap = snapshotFor(id, pads, keyboard);
      if (!snap) {
        this.states.set(id, freshState());
        return idleFrame(id, false);
      }
      const st = this.states.get(id) as DeviceState;
      const b = snap.buttons;
      const t = TUNING.navStick;
      const kb1 = id === 'kb1';
      const confirm = b[PAD.X] || (kb1 && NAV_KEYS.confirm.some((c) => keyboard.isDown(c)));
      const back = b[PAD.O] || (kb1 && NAV_KEYS.back.some((c) => keyboard.isDown(c)));
      const start = b[PAD.START];
      const alt = b[PAD.TRIANGLE];
      const frame: DeviceFrame = {
        id,
        connected: true,
        confirm: confirm && !st.confirm,
        back: back && !st.back,
        start: start && !st.start,
        alt: alt && !st.alt,
        left: st.left.update(b[PAD.LEFT] || snap.axes[AXIS.LX] < -t, dt) > 0,
        right: st.right.update(b[PAD.RIGHT] || snap.axes[AXIS.LX] > t, dt) > 0,
      };
      st.confirm = confirm;
      st.back = back;
      st.start = start;
      st.alt = alt;
      return frame;
    });
  }
}
