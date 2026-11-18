# Orbital Clash

An original browser game inspired by the PS3 tower-offense classic *Comet Crash*: defend your base with weapons **and** build a massive army that snakes through the enemy maze. Strict TypeScript, three.js (WebGL2), all art procedural and all audio synthesized (no asset files).

## Run

```
npm install
npm run dev          # http://localhost:5173
npm run build:html   # single file: release/orbital-clash.html
npm run typecheck
npm test
```

## Game

- **Defense**: Turret, Laser, Pulsar, Bomber. Upgrade (corner marks, platform grows at max), recycle (value drops with damage), repair.
- **Offense**: Basic Ops spawn towers (Scout, Tank, Drone, Torpedo; hold X to switch output), Special Ops / Hammer towers (Hammer, Switch, Thief, Carrier). Units teleport to your base (cap 1000) and are released from the attack menu as long single-file trains that follow the enemy's maze.
- **Economy**: meteoroids drop Thorium rocks; grab them with your ship and drag them onto a Turret/Laser/Bomber to smash them.
- **Campaign**: 4 comets (Kreios, Hathor, Aether, Helios) x 7 areas plus a Resurgence area each, 4 difficulties, 1–3 player co-op. Enemies are **scripted** by mission timelines.
- **Battle**: 1–4 players, teams, Max Hits 1–100, per-player strength, timed mode (8x spawn at zero), Thorium rate 50–200 %, 8 maps, adaptive AI opponents.
- Save data, local leaderboards with flags, 12 trophies, 16:9 and 4:3 layouts.

## Controls (PS3-style pad, keyboard fallback)

| Action | Pad | Player 1 keys |
|---|---|---|
| Move ship | Left stick | W A S D |
| Build menu | R1 | Shift / Tab |
| Build / confirm (hold on spawn tower: cycle output) | X | E |
| Upgrade | O | Q |
| Recycle | Square | F |
| Repair | Triangle | R |
| Attack menu / pick unit (hold to lock) | R3 / right stick | Space / arrows |
| Cycle target | L1 | ] / [ |
| Grab / drop rock | L2 / R2 | G |
| Pause | Start | Esc / P |

Player 2 uses I J K L (see the in-game Controls screen).

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The simulation (`src/sim`) is pure, deterministic, fixed 60 Hz and knows nothing about rendering. Rendering (`src/render`), audio (`src/audio`) and HUD (`src/ui`) only read the world and consume `SimEvent`s; `src/input` produces `Intent`s; `src/app` wires everything together.

```
src/
  types/ config/        shared contract and constants
  sim/core              loop, rng, grid, flow fields, spatial hash, pipeline, victory
  sim/build economy     construction rules, rocks, thorium, ship
  sim/army combat units spawn towers, snake trains, weapons, unit behaviours
  sim/modes             campaign (scripted timeline) and battle (+ adaptive AI)
  data/                 unit/weapon/research defs, 32 campaign areas, 8 battle maps
  input/ audio/ meta/   gamepad+keyboard, synthesized sound, save/leaderboard/trophies
  render/ ui/ app/      three.js engine+terrain+models+fx, canvas HUD+menus, shell
docs/                   architecture, style guide, mechanics notes
```

All balance numbers are tuned by us (official values are not public). Reference notes: [docs/mechanics.md](docs/mechanics.md), [docs/style-guide.md](docs/style-guide.md).
