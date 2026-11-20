import type { PlayerId, StructureKind, World } from '../../types';
import { DEFS, isUnlocked, researchDef } from '../../data';

/** Menu order: economy/missile support first, then the four weapons, the two spawn towers and the rest. */
const ORDER: readonly StructureKind[] = [
  'harvester', 'researchLab', 'missileSilo', 'missileDefense',
  'turret', 'laser', 'pulsar', 'bomber', 'basicOps', 'specialOps',
  'gateway', 'waypoint',
];

export interface BuildItem {
  kind: StructureKind;
  name: string;
  cost: number;
  /** Tech not unlocked yet: shown with a lock and the reason. */
  locked: boolean;
  lockReason: string | null;
  /** Unlocked but not enough thorium (dimmed). */
  affordable: boolean;
  shortBy: number;
}

function availableIn(kind: StructureKind, profile: World['settings']['profile']): boolean {
  const p = DEFS.support(kind).profile;
  return p === 'both' || p === profile;
}

/** Single source of truth for the build menu order; wire this into createInput's `getBuildItems`. */
export function buildKindsFor(world: World): StructureKind[] {
  return ORDER.filter((k) => availableIn(k, world.settings.profile));
}

export function buildItemsFor(world: World, player: PlayerId): BuildItem[] {
  const p = world.players[player];
  const tech = p?.tech ?? {};
  const thorium = p?.thorium ?? 0;
  return buildKindsFor(world).map((kind) => {
    const d = DEFS.support(kind);
    const locked = !isUnlocked(tech, d.requires);
    const short = Math.max(0, d.buildCost - thorium);
    return {
      kind,
      name: d.name,
      cost: d.buildCost,
      locked,
      lockReason: locked && d.requires ? `Requires ${researchDef(d.requires)?.name ?? d.requires}` : null,
      affordable: !locked && short === 0,
      shortBy: short,
    };
  });
}

/** Keeps `index` visible in a window of `max` rows; returns the first visible row. */
export function windowStart(index: number, count: number, max: number): number {
  if (count <= max) return 0;
  return Math.min(count - max, Math.max(0, index - Math.floor(max / 2)));
}
