import type { Emit, PlayerId, Rock, World } from '@/types';
import { smashRock } from '@/sim/economy/rocks';

/** Any hit smashes a drifting rock; the economy module releases the thorium and credits the player. */
export function hitRock(w: World, rock: Rock, credit: PlayerId, emit: Emit): void {
  if (rock.state !== 'drifting') return;
  smashRock(w, rock.id, credit, emit);
}
