# Orbital Clash

A 2D neon **reverse tower defense** for 1 or 2 players, built with TypeScript, Vite and the HTML5 Canvas (no runtime dependencies, no asset files: all graphics and sounds are procedural).

Orbital Clash is an original game inspired by the PS3 classic *Comet Crash*. Two bases face each other across a metal plateau floating in deep space. Each side builds bulky tower bunkers into mazes **and** buys swarms of attack units that it launches at the enemy base as long serpent trains. Meteor showers drop glowing Thorium crystals: harvest them with drones from a Harvest Station (or carry them with your ship) to earn Thorium and research energy. Bring the enemy base to 0 HP to win.

- **1 Player**: fight a red AI opponent across endless levels of increasing difficulty (progress is saved in `localStorage`).
- **2 Players**: local versus on one keyboard (blue vs purple).
- **Ships as a single file**: `npm run build:html` produces one self-contained `release/orbital-clash.html` you can open offline or send to a friend.

## v2 features

- **One-screen plateau**: a 28×18 tile map with a 180 px sidebar HUD on the left, cliffs all around and mirrored natural crater obstacles.
- **Mazes, never walls**: towers fill their tile, so adjacent towers form thick walls. A build is refused if it would cut any spawn cell or any live ground unit off from its target base.
- **Wave buffer + LAUNCH**: buy unit packs into your buffer (up to 160 units), then launch the whole buffer at once as one tight single-file train that snakes through the enemy maze. There is no wave timer: you choose when to attack.
- **Air units**: Bombers fly straight over the maze; only towers that hit air can shoot them.
- **Harvesting economy**: Harvest Stations operate 1–3 drones that mine Thorium and haul it home; their magnet also pulls nearby rocks in. Refining pays Thorium and research energy.
- **Research**: spend the cyan research bar on tower level 3, faster swarms or double harvester cargo.
- **Built for crowds**: a locked 60 Hz simulation with hundreds of units, flow fields, a spatial grid and pre-rendered sprites.

## Folder structure

```
C:\dev\orbital clash\
├─ game\                  ← this Git repository
│  ├─ index.html          ← page with the <canvas id="game"> (favicon inlined)
│  ├─ package.json        ← scripts: dev, build, build:html, preview, typecheck, test
│  ├─ tsconfig.json       ← strict TypeScript
│  ├─ vite.config.ts      ← Vite (single-file build) + Vitest config
│  ├─ scripts\            ← copy-release.mjs (dist → release)
│  ├─ release\            ← orbital-clash.html: the committed, ready-to-play single file
│  ├─ .github\workflows\  ← CI (typecheck, tests, build)
│  ├─ src\
│  │  ├─ main.ts          ← entry: canvas sizing, wiring, starts the loop
│  │  ├─ types\           ← shared type contract (World, entities, events, view)
│  │  ├─ core\            ← config, Game state machine, GameLoop, Input, Audio, World, Random
│  │  ├─ data\            ← towers, units + research, levels, controls (key bindings)
│  │  ├─ entities\        ← plain-data entity factories
│  │  ├─ systems\         ← Grid, Pathfinding, FlowField, Spatial, Build, Movement, Combat,
│  │  │                     Economy, Meteor, Wave, Particle
│  │  ├─ controllers\     ← PlayerController (keyboard/mouse) and AIController
│  │  └─ ui\              ← Renderer, Sidebar, menus, procedural art
│  └─ tests\              ← Vitest tests
└─ workspace\             ← personal scratch space, NOT part of the repo
```

## Setup

Requires Node.js 20+ and Git.

```powershell
cd "C:\dev\orbital clash"
mkdir game
mkdir workspace
cd game
git init
npm install
npm run dev
```

`workspace\` lives **beside** the repository so notes and experiments never get committed. The `.gitignore` also ignores `workspace/` as a safeguard, plus `node_modules/`, the `dist/` build output, logs and editor/OS files. `release/` is **not** ignored: it holds the playable deliverable.

| Command | What it does |
| --- | --- |
| `npm install` | Install the dev tools (Vite, TypeScript, Vitest, vite-plugin-singlefile) |
| `npm run dev` | Start the game at http://localhost:5173 |
| `npm run build` | Type-check and build ONE self-contained `dist/index.html` |
| `npm run build:html` | Build, then copy it to `release/orbital-clash.html` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Check types with `tsc --noEmit` |
| `npm test` | Run the Vitest tests |

### Single-file build

`vite.config.ts` uses `viteSingleFile()` from `vite-plugin-singlefile`: all JavaScript and CSS are inlined into `dist/index.html`, the favicon is a data URI, and sourcemaps are off. The page makes no external requests, so `release/orbital-clash.html` can be opened straight from disk (double-click) or hosted anywhere as one file.

## Controls

All hotkeys come from `src/data/controls.ts` (the single source of truth, also used for the sidebar labels).

| Action | Player 1 (blue, left) | Player 2 (purple, right, 2P only) |
| --- | --- | --- |
| Move cursor / ship | `W` `A` `S` `D` (hold to repeat) | Arrow keys (hold to repeat) |
| Act: drop rock › pick up rock › upgrade own tower › build selected | `Space` | `Enter` |
| Select Red Laser | `1` | `Numpad 1` or `Y` |
| Select Fireball Mortar | `2` | `Numpad 2` or `U` |
| Select Frost Emitter | `3` | `Numpad 3` or `I` |
| Select Plasma Lance | `4` | `Numpad 4` or `O` |
| Select Harvest Station | `5` | `Numpad 5` or `P` |
| Upgrade tower under cursor | `X` | `Numpad 0` or `N` |
| Sell tower under cursor (75%) | `C` | `Numpad .` or `M` |
| Buy Swarmer pack (10) | `Q` | `Numpad 7` or `H` |
| Buy Juggernaut pack (4) | `E` | `Numpad 8` or `J` |
| Buy Aegis pack (6) | `R` | `Numpad 9` or `K` |
| Buy Bomber pack (3) | `F` | `Numpad +` or `L` |
| LAUNCH the whole buffer | `G` | `Numpad Enter` or `;` |
| Research Tower Lv3 | `6` | `Numpad /` or `,` |
| Research Swarm Speed | `7` | `Numpad *` or `.` |
| Research Dual Cargo | `8` | `Numpad -` or `/` |

| Global | Key |
| --- | --- |
| Pause / resume | `Esc` |
| Mute | `` ` `` or `F2` |
| Menus | `↑` `↓` / `W` `S`, `Enter` / `Space` / click; `←` `→` changes the level |

**Mouse (P1 in 1-player mode):** the cursor follows the pointer over the map; left click = act; right click = sell your tower under the pointer, otherwise drop the carried rock; left click on a sidebar row performs that action.

## Towers

Distances are in tiles, times in seconds. Cost at L2/L3 is the upgrade price. Level 3 requires the **Tower Lv3** research. Selling refunds 75% of everything spent on the tower.

| Tower | Hits | Cost L1 / L2 / L3 | Damage | Range | Fire interval | Special |
| --- | --- | --- | --- | --- | --- | --- |
| Red Laser | ground + air | 30 / 40 / 80 | 5 / 8 / 13 | 2.6 / 3 / 3.5 | 0.22 / 0.17 / 0.12 | Rapid single-target beam |
| Fireball Mortar | ground | 55 / 65 / 120 | 22 / 36 / 60 | 3 / 3.5 / 4 | 1.2 / 1.0 / 0.8 | Fireball, splash 0.9 / 1.1 / 1.4 |
| Frost Emitter | ground | 45 / 55 / 95 | 2 / 3 / 5 | 2 / 2.5 / 3 | 0.9 / 0.8 / 0.7 | Frost wave radius 2 / 2.5 / 3, slow ×0.55 / ×0.45 / ×0.35 for 1.5 / 2 / 2.5 s |
| Plasma Lance | ground + air | 75 / 90 / 150 | 3 / 5 / 8 | 3 / 3.4 / 3.8 | 0.08 / 0.07 / 0.06 | Plasma stream, splash 0.45 / 0.55 / 0.7 |
| Harvest Station | – | 110 / 130 / 190 | – | – | – | 1 / 2 / 3 drones; magnet 2 / 3 / 4.5 at 1.5 / 2.5 / 4 tiles/s; refine 1.4 / 1.1 / 0.8 s; value ×1 / ×1.2 / ×1.5 |

## Units

Units are bought in packs into the wave buffer and launched together.

| Unit | Pack | Pack cost | HP | Shield | Speed (tiles/s) | Base damage | Bounty | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Swarmer | 10 | 30 | 14 | 0 | 2.4 | 1 | 1 | Tiny, fast, cheap |
| Juggernaut | 4 | 60 | 130 | 0 | 1.1 | 4 | 5 | Slow armored crawler |
| Aegis | 6 | 55 | 40 | 50 | 1.7 | 2 | 3 | Shield regenerates 10/s after 2 s; lasers and plasma do 50% to shields |
| Bomber | 3 | 75 | 90 | 0 | 1.0 | 6 | 7 | **Air**: flies straight to the enemy base over the maze |

## Research

Spent from the cyan research bar; each can be bought once.

| Research | Cost | Effect |
| --- | --- | --- |
| Tower Lv3 | 160 | Unlocks level 3 for every tower |
| Swarm Speed | 220 | Units spawned afterwards move 30% faster |
| Dual Cargo | 120 | Harvesters carry two rocks per trip |

**Economy:** both sides start with 450 Thorium (the AI's start money scales with the level). Each team gets 2 Thorium/s and 1.5 research/s passively. A Thorium rock is worth 15 before the station multiplier and also pays 0.6 × its value in research when refined. Bases have 250 HP. A meteor shower drops a cluster of 4–8 rocks roughly every 24 s, and two mirrored deposits are seeded at the start.

## Architecture

- **Fixed-step loop** (`core/GameLoop.ts`): `requestAnimationFrame` drives an accumulator that runs the simulation at exactly 60 Hz (`SIM_DT`), clamps long frames to 0.25 s, runs at most 5 steps per frame, and renders once per frame.
- **Input edges** (`core/Input.ts`): key presses and clicks are buffered until the next simulation step, consumed by the first step of a frame only, and cleared by `endFrame()`, so a press is never lost or handled twice. Mouse coordinates are converted to the 1348×768 logical canvas.
- **Plain-data World + systems**: the whole game state is one plain `World` object (`types/index.ts`). Systems are functions over it, run in a fixed order each step: controllers → meteors → waves → movement → combat → economy → effects. Controllers (human or AI) only call the same public system functions (`tryBuild`, `queueUnit`, `launchWave`, `tryResearch`…), so the AI plays by the same rules as the players.
- **Flow fields** (`systems/FlowField.ts`): one BFS distance field per team from every cell to the enemy base, recomputed only when `grid.version` changes. Each ground unit just steps to the neighbour with the smallest distance, so hundreds of units path for free and a train stays single-file.
- **A\* + flood anti-block** (`systems/Pathfinding.ts`, `systems/BuildSystem.ts`): before a tower is placed, `wouldBlockPaths` floods from each target base with the candidate cell blocked and checks that every spawn cell and every live ground unit is still reached; A* (binary heap on typed arrays) is used for point-to-point checks. A build that would seal any route is refused.
- **Spatial grid** (`systems/Spatial.ts`): live units are bucketed into tile-sized cells each step (typed-array linked lists, no allocation), so tower targeting and splash damage query only nearby buckets.
- **Trains** (`systems/WaveSystem.ts`): LAUNCH turns the buffer into pending spawns 0.07 s apart on one spawn cell, each tagged with its `trainIndex`, which produces the serpent look.
- **Event queue**: systems never touch audio or UI. They push typed `GameEvent`s onto `world.events`; `core/Game.ts` drains the queue each step to play sounds (each sound at most once per step, plus per-sound throttling in `Audio`) and show rate-limited banners.
- **State machine** (`core/Game.ts`): `menu → playing ⇄ paused → gameover`, plus `howto`. The renderer gets the `World` (or `null` on menus) and a small `ViewState`.

## How we work together

1. `main` is always playable. Nobody pushes to it directly.
2. Start each task from an up-to-date `main`:
   ```powershell
   git switch main
   git pull
   git switch -c feat/short-name
   ```
3. Commit small steps, then push and open a pull request:
   ```powershell
   git push -u origin feat/short-name
   ```
4. CI runs the type check, tests and build on every PR. It must be green.
5. The other person takes a quick look, then you merge with **Squash and merge** and delete the branch.
6. If `main` moved while you worked, run `git pull origin main --rebase` and push again with `git push --force-with-lease`.

Branch names: `feat/...` for features, `fix/...` for bugs, `chore/...` for setup or cleanup.
