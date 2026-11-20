import type { World } from '../types';

const PRIME = 0x01000193;

/** Cheap deterministic 32-bit FNV-1a style digest of the world state that matters for desync detection. */
export function worldHash(w: World): number {
  let h = 0x811c9dc5;
  const mix = (v: number): void => {
    let x = Number.isFinite(v) ? Math.round(v) | 0 : 0x7fffffff;
    for (let i = 0; i < 4; i++) {
      h = Math.imul(h ^ (x & 0xff), PRIME);
      x >>>= 8;
    }
  };
  const pos = (v: number): void => mix(Math.round(v * 1000));

  mix(w.tick);
  mix(w.paused ? 1 : 0);
  mix(w.over ? 1 : 0);
  mix(w.winnerTeam);
  mix(w.nextId);
  mix(w.rng);
  for (const p of w.players) {
    pos(p.thorium);
    mix(p.hits);
    mix(p.alive ? 1 : 0);
    pos(p.ship.x);
    pos(p.ship.y);
    mix(p.ship.cursorTx);
    mix(p.ship.cursorTy);
    pos(p.ship.hp);
    mix(p.ship.maxHp);
    mix(p.ship.dead ? 1 : 0);
    pos(p.ship.respawnTimer);
    mix(p.ship.healing ? 1 : 0);
  }
  mix(w.structures.size);
  mix(w.units.length);
  mix(w.projectiles.length);
  mix(w.rocks.length);
  const sample = <T extends { id: number; x: number; y: number }>(list: readonly T[]): void => {
    const stride = Math.max(1, Math.floor(list.length / 16));
    for (let i = 0; i < list.length; i += stride) {
      mix(list[i].id);
      pos(list[i].x);
      pos(list[i].y);
    }
  };
  sample(w.units);
  sample(w.projectiles);
  sample(w.rocks);
  let n = 0;
  for (const s of w.structures.values()) {
    if (n++ % 4 !== 0) continue;
    mix(s.id);
    mix(s.tx);
    mix(s.ty);
    mix(s.level);
    pos(s.hp);
  }
  return h >>> 0;
}
