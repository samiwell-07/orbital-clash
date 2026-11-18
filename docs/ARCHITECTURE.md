# Architecture (contract for all modules)

Simulation is pure TypeScript (no DOM, no three.js), fixed 60 Hz, deterministic (seeded RNG in `world.rng`). Rendering, audio, HUD only READ the world and consume `SimEvent`s. Input produces `Intent`s. Everything is coded against `src/types` — do not change these types without telling the integrator; if you need an addition, add an OPTIONAL field or a new file.

Positions are tile units (1 tile = 1.0), x right, y down. Render maps (x, y) to three.js (x, 0, y).

## Pipeline order (sim/pipeline.ts, owned by integration)
timeline → applyIntents → build/upgrade/recycle/repair → rocks+meteors → economy → production → launch → movement → combat → projectiles → cleanup+victory.

Each domain module exports a `System` (`(w, dt, emit) => void`) plus pure helpers. Intent handlers are exported as `handleXIntent(w, intent, emit): boolean` (true if consumed).

## Module ownership (never edit another owner's folder)
| Folder | Owner todo |
|---|---|
| src/types, src/config, docs/ARCHITECTURE.md | contract (integrator only) |
| src/sim/core (loop, rng, grid, flow, spatial, world factory, pipeline, victory) | sim-core |
| src/data (units, weapons, research, defs api) | data-defs |
| src/sim/build, src/sim/economy | build-economy |
| src/sim/army | army-snake |
| src/sim/combat, src/sim/units | combat-units |
| src/input | input-cursor |
| src/render/engine, src/render/terrain | render-engine |
| src/render/models, src/render/instancing | render-models |
| src/render/fx | render-fx |
| src/audio | audio |
| src/ui | ui-hud |
| src/sim/modes/campaign, src/data/areas | campaign |
| src/sim/modes/battle, src/data/battle-maps | battle-mode |
| src/meta | meta |

## Rules
- Files <= ~200 lines, one responsibility, named exports only, no default exports, no circular imports.
- Strict TS: `npm run typecheck` must pass for your files. Add Vitest tests in `tests/<area>/*.test.ts` for logic (sim, data, meta). No DOM tests.
- No copied copyrighted assets: all art procedural (three.js geometry/canvas textures), all audio synthesized (WebAudio).
- All balance numbers are "tuned"; put them in `src/data`, never hard-code in systems.
- Comments only where non-obvious.
