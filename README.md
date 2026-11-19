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
- **Offense**: Basic Ops spawn towers (Scout, Tank, Drone, Torpedo; hold A / Cross to switch output), Special Ops / Hammer towers (Hammer, Switch, Thief, Carrier). Units teleport to your base (cap 1000) and are released with the right stick as long single-file trains that follow the enemy's maze.
- **Economy**: meteoroids drop Thorium rocks; grab one with your ship (it rides in front of the nose) and drop it inside a Harvester's magnet. The Harvester drains it: bigger rocks take longer but pay more. Upgrading a Harvester widens its magnet.
- **Campaign**: 4 comets (Kreios, Hathor, Aether, Helios) x 7 areas plus a Resurgence area each, 4 difficulties, 1–3 player co-op. Enemies are **scripted** by mission timelines.
- **Battle**: 1–4 players, teams, Max Hits 1–100, per-player strength, timed mode (8x spawn at zero), Thorium rate 50–200 %, 16 maps, adaptive AI opponents.
- Save data, local leaderboards with flags, 12 trophies, 16:9 and 4:3 layouts.

## Controls (original Comet Crash layout; Xbox and PlayStation pads, keyboard fallback)

| Action | Xbox | PlayStation | Player 1 keys |
|---|---|---|---|
| Move ship | Left stick / D-pad | Left stick / D-pad | W A S D |
| Build menu | RB | R1 | Shift / Tab |
| Pick build item (build menu open) | D-pad | D-pad | Arrow keys |
| Build / modify, confirm (hold on spawn tower: cycle output) | A | Cross | E |
| Upgrade (build menu: close) | B | Circle | Q |
| Recycle | X | Square | F |
| Repair | Y | Triangle | R |
| Attack: pick unit (hold 0.8 s to lock) | Right stick | Right stick | Arrow keys |
| Show / hide attack menu | RS click | R3 | Space / V |
| Target enemy | LB | L1 | ] / [ |
| Grab rock (hold) / drop (release) | RT | R2 | G |
| Missile from every Missile Silo (hold 3 s) | LT | L2 | C |
| Pause | Menu | Start | Esc / P |

Player 2 uses I J K L (see the in-game Controls screen).

### Join lobby (local multiplayer)

Before every campaign mission (Launch Mission) and every battle (Start), a lobby opens. Each player presses **A / Cross** on their own controller (or **E** on WASD, **U** on IJKL) to take the next seat: the first to join is P1. In the lobby, **◀ ▶** (keyboard: A D / J L) change your colour, with a spinning preview of your ship; there are 8 colours and no two players can share one. Press **A** again to ready up and **B / Circle** to un-ready or leave. When everyone is ready, a 3-second countdown starts, and pressing B cancels it.

- Campaign: 1–3 players in co-op. Battle: exactly the number of human players set on the Battle screen.
- In game, each player reads only the device they joined with, so two controllers never interfere.
- If a controller disconnects, the game pauses and shows which player is missing. Reconnect it, or press A on any free controller to take that seat. You can also resume without that player.
- PS3 pads on Windows need DS4Windows or DsHidMini. Browsers only see a pad after you press one of its buttons.

### Online play (same Wi-Fi / local network)

Online play needs the dev server, which runs a small relay at `/net` and listens on the local network (the single-file build has no relay).

1. On the host laptop, run `npm run dev` from `game/`. Vite prints a `Network:` address such as `http://192.168.1.23:5173/`. If Windows Firewall asks, allow Node.js on **private** networks.
2. Open the Campaign or Battle lobby as usual and press **Y / Triangle** (keyboard **R**) to host. The lobby shows a 4-digit room code and the address friends should open.
3. Each friend opens that address in their own browser, chooses **Join Online** on the title screen, and enters the code: type the digits, or use the D-pad to change a digit (▲▼) and move between digits (◀▶). Then press **A / Cross** or Enter.
4. Friends join seats with their own controllers or keyboards, just like the local lobby. A machine can have more than one player. When everyone is ready, the host's countdown starts the match on every machine.

- Every machine runs the same simulation in lockstep, so a slow connection makes the game wait (the banner reads "Waiting for P2…") rather than drift apart. A periodic check shows "Out of sync" if the machines ever disagree. Use the same browser engine on every machine (for example Chrome or Edge everywhere).
- Anyone can pause for everyone. Only the host can restart or move on to the next area.
- If a friend leaves, the match carries on without them. If the host quits, every machine returns to the title screen.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). The simulation (`src/sim`) is pure, deterministic, fixed 60 Hz and knows nothing about rendering. Rendering (`src/render`), audio (`src/audio`) and HUD (`src/ui`) only read the world and consume `SimEvent`s; `src/input` produces `Intent`s; `src/app` wires everything together.

```
src/
  types/ config/        shared contract and constants
  sim/core              loop, rng, grid, flow fields, spatial hash, pipeline, victory
  sim/build economy     construction rules, rocks, thorium, ship
  sim/army combat units spawn towers, snake trains, weapons, unit behaviours
  sim/modes             campaign (scripted timeline) and battle (+ adaptive AI)
  data/                 unit/weapon/research defs, 32 campaign areas, 16 battle maps
  input/ audio/ meta/   gamepad+keyboard, synthesized sound, save/leaderboard/trophies
  render/ ui/ app/      three.js engine+terrain+models+fx, canvas HUD+menus, shell
docs/                   architecture, style guide, mechanics notes
```

All balance numbers are tuned by us (official values are not public). Reference notes: [docs/mechanics.md](docs/mechanics.md), [docs/style-guide.md](docs/style-guide.md).
