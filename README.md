# Orbital Clash

A 2D neon **reverse tower defense** for 1 or 2 players, built with TypeScript, Vite and the HTML5 Canvas (no runtime dependencies, no asset files: all graphics and sounds are procedural).

Orbital Clash is an original game inspired by the PS3 classic *Comet Crash*. Two bases face each other across an asteroid field. Each side builds towers to defend **and** buys attack units that march on the enemy base. Meteor showers drop glowing Thorium rocks: grab them with your collector drone or pull them in with a Magnet Refinery to turn them into cash. Bring the enemy base to 0 HP to win.

- **1 Player**: fight an AI opponent across endless levels of increasing difficulty (progress is saved in `localStorage`).
- **2 Players**: local versus on one keyboard.

## Folder structure

```
C:\dev\orbital clash\
├─ game\                  ← this Git repository
│  ├─ index.html          ← page with the <canvas id="game">
│  ├─ package.json        ← scripts: dev, build, preview, typecheck, test
│  ├─ tsconfig.json       ← strict TypeScript
│  ├─ vite.config.ts      ← Vite + Vitest config
│  ├─ .github\workflows\  ← CI (typecheck, tests, build)
│  ├─ src\
│  │  ├─ main.ts          ← entry: canvas sizing, wiring, starts the loop
│  │  ├─ types\           ← shared type contract (World, entities, events, view)
│  │  ├─ core\            ← config, Game state machine, GameLoop, Input, Audio, World, Random
│  │  ├─ data\            ← tower, unit and level definitions
│  │  ├─ entities\        ← plain-data entity factories
│  │  ├─ systems\         ← Grid, Pathfinding, Build, Movement, Combat, Economy, Meteor, Wave, Particle
│  │  ├─ controllers\     ← PlayerController (keyboard/mouse) and AIController
│  │  └─ ui\              ← Renderer, menus, build panel
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

`workspace\` lives **beside** the repository so notes and experiments never get committed. The `.gitignore` also ignores `workspace/` as a safeguard, plus `node_modules/`, the `dist/` build output, logs and editor/OS files.

| Command | What it does |
| --- | --- |
| `npm install` | Install the dev tools (Vite, TypeScript, Vitest) |
| `npm run dev` | Start the game at http://localhost:5173 |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Check types with `tsc --noEmit` |
| `npm test` | Run the Vitest tests |

## Controls

| Action | Player 1 (blue, left) | Player 2 (red, right, 2P only) |
| --- | --- | --- |
| Move cursor / drone | `W` `A` `S` `D` (hold to repeat) | Arrow keys (hold to repeat) |
| Action: drop rock › pick up rock › upgrade own tower › build | `Space` / left click (1P) | `Enter` / `Numpad Enter` |
| Select tower: Laser, Cannon, Cryo, Refinery | `1` `2` `3` `4` | `Numpad 1-4` or `U` `I` `O` `P` |
| Send unit: Scout, Tank, Aegis | `5` `6` `7` | `Numpad 5-7` or `J` `K` `L` |
| Upgrade tower | `R` | `Numpad +` or `[` |
| Sell tower (70% refund) | `F` | `Numpad -` or `]` |
| Cycle selected tower | `Q` / `E` | – |
| Drop rock | right click (1P) | – |
| Build panel | click a slot (1P) | – |

| Global | Key |
| --- | --- |
| Pause / resume | `Esc` (also `P` in 1-player mode) |
| Mute | `M` |
| Menus | `↑` `↓` / `W` `S`, `Enter` / `Space` / click; `←` `→` changes the level |

In 1-player mode the mouse also drives P1: the cursor follows the pointer over the map.

## Towers

Distances are in tiles, times in seconds. Cost at L2/L3 is the upgrade price. Selling refunds 70% of everything spent on the tower.

| Tower | Level | Cost | Damage | Range | Fire interval | Special |
| --- | --- | --- | --- | --- | --- | --- |
| Pulse Laser | 1 / 2 / 3 | 60 / 70 / 110 | 7 / 12 / 19 | 3 / 3.5 / 4 | 0.25 / 0.2 / 0.15 | Instant beam, single target, weak vs shields |
| Plasma Cannon | 1 / 2 / 3 | 100 / 110 / 160 | 30 / 50 / 80 | 3.5 / 4 / 4.5 | 1.4 / 1.2 / 1.0 | Homing missile, splash 1 / 1.25 / 1.5 |
| Cryo Pulse | 1 / 2 / 3 | 80 / 90 / 130 | 2 / 4 / 6 | 2.5 / 3 / 3.5 | 0.8 / 0.7 / 0.6 | Area pulse, slow ×0.6 / ×0.5 / ×0.4 for 1.5 / 2 / 2.5 s |
| Magnet Refinery | 1 / 2 / 3 | 120 / 140 / 200 | – | – | – | Magnet radius 2.5 / 4 / 6, pull 1.5 / 2.5 / 4 tiles/s, refine 2 / 1.5 / 1 s, value ×1 / ×1.2 / ×1.5 |

## Units

| Unit | Cost | HP | Shield | Speed (tiles/s) | Base damage | Bounty | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Dart Scout | 15 | 30 | 0 | 2.6 | 3 | 4 | Fast and cheap, fragile |
| Bulwark Tank | 45 | 220 | 0 | 1.0 | 10 | 12 | Slow, heavily armored |
| Aegis Walker | 35 | 70 | 90 | 1.6 | 6 | 9 | Shield regenerates 12/s after 2 s; lasers do 50% to shields |

Economy: both sides start with 300 (the AI's start money scales with the level), every wave launch pays 25 × income multiplier, and a Thorium rock is worth 25 before the refinery multiplier.

## Architecture

- **Fixed-step loop** (`core/GameLoop.ts`): `requestAnimationFrame` drives an accumulator that runs the simulation at exactly 60 Hz (`SIM_DT`), clamps long frames to 0.25 s, runs at most 5 steps per frame, and renders once per frame. The simulation is therefore frame-rate independent and deterministic for a given seed.
- **Input edges** (`core/Input.ts`): key presses and clicks are buffered until the next simulation step, consumed by the first step of a frame only, and cleared by `endFrame()`, so a press is never lost or handled twice.
- **Plain-data World + systems**: the whole game state is one plain `World` object (`types/index.ts`). Systems are pure functions over it, run in a fixed order each step: controllers → meteors → waves → movement → combat → economy → effects. Controllers (human or AI) only call the same public system functions (`tryBuild`, `queueUnit`, `tryPickUpRock`…), so the AI plays by the same rules as the players.
- **A\* path-block validation**: units path with 4-directional A* (binary heap on typed arrays) to the enemy base. Before a tower is placed, `wouldBlockPaths` runs one BFS flood fill per team from the target base with the candidate cell blocked, and checks that every spawn cell and every live unit is still reached; a build that would seal any route is refused. Units re-path whenever `grid.version` changes.
- **Event queue**: systems never touch audio or UI. They push typed `GameEvent`s onto `world.events`; `core/Game.ts` drains the queue each step to play sounds and show banners.
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
