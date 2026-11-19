import type { Structure, StructureKind, WeaponKind } from '@/types';
import { DEFS, UNIT_DEFS, isUnlocked } from '@/data';
import { structuresOf } from '@/sim/core/entities';
import type { BrainCtx } from './ctx';
import { airSite, mainRoute, towerSite, weaponSite, type Site } from './sites';

const isWeapon = (s: Structure): boolean => s.kind === 'turret' || s.kind === 'laser' || s.kind === 'pulsar' || s.kind === 'bomber';

function buildCost(kind: StructureKind): number {
  return DEFS.support(kind).buildCost;
}

function unlocked(c: BrainCtx, kind: StructureKind): boolean {
  return isUnlocked(c.p.tech, DEFS.support(kind).requires);
}

function emitBuild(c: BrainCtx, kind: StructureKind, site: Site): boolean {
  if (c.budget.thorium < buildCost(kind)) return false;
  c.out.push({ t: 'build', player: c.me, kind, tx: site.tx, ty: site.ty });
  c.pending.add(site.ty * c.w.grid.w + site.tx);
  c.budget.thorium -= buildCost(kind);
  return true;
}

/** Counter-picks the next weapon from what the enemy is sending (anti-air vs drones, pulsars vs torpedoes...). */
function pickWeapon(c: BrainCtx, weapons: readonly Structure[]): WeaponKind {
  const t = c.threat;
  const aa = weapons.filter((s) => DEFS.weapon(s.kind as WeaponKind).targets !== 'ground').length;
  if (t.airShare >= 0.4 && unlocked(c, 'bomber') && c.budget.thorium >= buildCost('bomber')) return 'bomber';
  const needAir = t.airShare >= 0.25 || (weapons.length >= 4 && aa < Math.ceil(weapons.length / 4));
  if (needAir && unlocked(c, 'laser')) return 'laser';
  if ((t.byKind.torpedo ?? 0) >= 3 && unlocked(c, 'pulsar')) return 'pulsar';
  const n = c.mem.weaponsBuilt;
  if (n % 3 === 2 && unlocked(c, 'laser') && c.budget.thorium >= buildCost('laser') * 2) return 'laser';
  if (n % 4 === 3 && unlocked(c, 'pulsar') && c.budget.thorium >= buildCost('pulsar') * 2) return 'pulsar';
  return 'turret';
}

function buildWeapon(c: BrainCtx, weapons: readonly Structure[], force?: WeaponKind): boolean {
  const kind = force ?? pickWeapon(c, weapons);
  const route = mainRoute(c.w, c.p);
  const radius = c.tun.towerRadius;
  const anti = DEFS.weapon(kind).targets !== 'ground' && c.threat.airShare >= 0.25;
  const site = (anti ? airSite(c) : null) ?? weaponSite(c, route, radius);
  if (!site) return false;
  const ok = emitBuild(c, kind, site);
  if (ok) c.mem.weaponsBuilt++;
  return ok;
}

/** Harvesters sit beside the base, off the enemy lane, like spawn towers. */
function buildHarvester(c: BrainCtx): boolean {
  const site = towerSite(c, mainRoute(c.w, c.p));
  return site ? emitBuild(c, 'harvester', site) : false;
}

function upgradeHarvester(c: BrainCtx, list: readonly Structure[]): boolean {
  const def = DEFS.support('harvester');
  const costs = def.upgradeCost ?? [];
  const t = [...list].filter((s) => s.level < (def.maxLevel ?? 0)).sort((a, b) => a.level - b.level || a.id - b.id)[0];
  if (!t) return false;
  const cost = costs[t.level];
  if (cost === undefined || c.budget.thorium < cost * 1.5) return false;
  c.out.push({ t: 'upgrade', player: c.me, tx: t.tx, ty: t.ty });
  c.budget.thorium -= cost;
  return true;
}

function buildTower(c: BrainCtx, kind: 'basicOps' | 'specialOps'): boolean {
  const site = towerSite(c, mainRoute(c.w, c.p));
  return site ? emitBuild(c, kind, site) : false;
}

function upgradeTower(c: BrainCtx, towers: readonly Structure[]): boolean {
  const def = DEFS.spawnTower('basicOps');
  const cap = Math.min(c.tun.maxTowerLevel, def.maxLevel);
  const t = [...towers].filter((s) => s.level < cap).sort((a, b) => a.level - b.level || a.id - b.id)[0];
  if (!t) return false;
  const cost = def.upgradeCost[t.level];
  const unitsAtNext = def.outputsByLevel[t.level + 1];
  const unit = unitsAtNext[unitsAtNext.length - 1];
  if (c.budget.thorium < cost || !isUnlocked(c.p.tech, UNIT_DEFS[unit].requires)) return false;
  c.out.push({ t: 'upgrade', player: c.me, tx: t.tx, ty: t.ty });
  c.budget.thorium -= cost;
  return true;
}

function upgradeWeapon(c: BrainCtx, weapons: readonly Structure[]): boolean {
  const t = [...weapons]
    .filter((s) => s.level < DEFS.weapon(s.kind as WeaponKind).maxLevel)
    .sort((a, b) => a.level - b.level || a.id - b.id)[0];
  if (!t) return false;
  const cost = DEFS.weapon(t.kind as WeaponKind).upgradeCost[t.level];
  if (c.budget.thorium < cost * 1.3) return false;
  c.out.push({ t: 'upgrade', player: c.me, tx: t.tx, ty: t.ty });
  c.budget.thorium -= cost;
  return true;
}

/** Repair estimate uses the build cost only, so require double that as a safety margin against overspending. */
function repairOne(c: BrainCtx, mine: readonly Structure[]): boolean {
  for (const s of mine) {
    if (s.hp >= s.maxHp * 0.5) continue;
    const est = DEFS.repairCost(buildCost(s.kind), s.hp, s.maxHp);
    if (c.budget.thorium < est * 2) continue;
    c.out.push({ t: 'repair', player: c.me, tx: s.tx, ty: s.ty });
    c.budget.thorium -= est * 2;
    return true;
  }
  return false;
}

/**
 * One purchase per decision, in priority order: a harvester (the only thorium income), the first spawn tower, counters to
 * what is arriving, defence/offence balance, upgrades, then repairs. A critical item that is not yet
 * affordable makes the AI save instead of spending on lesser things.
 */
export function planBuild(c: BrainCtx): void {
  const mine = structuresOf(c.w, c.me);
  const weapons = mine.filter(isWeapon);
  const towers = mine.filter((s) => s.kind === 'basicOps');
  const specials = mine.filter((s) => s.kind === 'specialOps');
  const harvesters = mine.filter((s) => s.kind === 'harvester');
  const wantWeapons = Math.ceil(towers.length * c.tun.weaponsPerTower) + 1;
  const underAttack = c.threat.incoming >= 3 && c.threat.nearest < 24;
  const b = c.budget;

  if (harvesters.length === 0) {
    if (b.thorium < buildCost('harvester')) return;
    if (buildHarvester(c)) return;
  }
  if (towers.length === 0) {
    if (b.thorium < buildCost('basicOps')) return;
    if (buildTower(c, 'basicOps')) return;
  }
  if (underAttack && weapons.length < wantWeapons + 3) {
    if (b.thorium >= buildCost('turret') && buildWeapon(c, weapons)) return;
  }
  if (weapons.length < wantWeapons) {
    if (b.thorium < buildCost('turret')) return;
    if (buildWeapon(c, weapons)) return;
  }
  if (towers.length < c.tun.maxBasicOps && b.thorium >= buildCost('basicOps')) {
    if (buildTower(c, 'basicOps')) return;
  }
  if (upgradeTower(c, towers)) return;
  if (towers.length >= 3 && harvesters.length < 2 && b.thorium >= buildCost('harvester') * 1.5 && buildHarvester(c)) return;
  if (upgradeHarvester(c, harvesters)) return;
  const wantSpecials = c.tun.maxBasicOps >= 9 ? 2 : 1;
  if (unlocked(c, 'specialOps') && towers.length >= 4 && specials.length < wantSpecials) {
    if (b.thorium >= buildCost('specialOps') * 1.5 && buildTower(c, 'specialOps')) return;
  }
  if (upgradeWeapon(c, weapons)) return;
  if (b.thorium > 300 && buildWeapon(c, weapons)) return;
  repairOne(c, mine);
}
