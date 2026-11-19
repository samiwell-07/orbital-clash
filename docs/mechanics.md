# Mechanics Specification

Complete gameplay spec for Orbital Clash (clone of PS3 *Comet Crash*, Pelfast 2009, plus the *Bionic Swarm* expansion layer). Every fact is tagged:

- **[official]** stated by the official manual (web.archive.org copy of cometcrash.com/game-manual, May 2010), the Pelfast details page, or Wikipedia.
- **[observed]** read from the reference screenshots/video frames, trophy guide or Fandom wiki search snippets (the wiki itself returned 403; only search snippets were usable, so wiki facts are partial).
- **[tuned/guess]** our own decision. All numbers in the balance tables are tuned and live in `src/data` (never hard-coded in systems).

Types referenced: `src/types/ids.ts`, `defs.ts`, `mission.ts`, `input.ts`; constants in `src/config/constants.ts` (map 48x30, `STORAGE_CAP` 1000, hits 1..100, ship physics).

---

## 1. Game overview

- Genre: tower defense **plus tower offense** with light RTS: you defend against enemy rushes with weapons and *fight back* with your own army that you build, store at your base and release in a rush. [official]
- Story: scientists detect comets heading for home; you land on each, fight the alien forces and capture it. Defeating aliens grants access to their technology. [official]
- Resource: **Thorium**, found in rocks (meteoroids) orbiting/drifting over the comet. The ship grabs a rock and tows it to a **Harvester**, whose magnet pulls it in and drains its Thorium. Thorium pays for structures and upgrades. [official; harvester-only collection is a design change]
- Win: destroy the enemy base (reduce its hit counter to 0) by getting units to it. Lose: your base's hit counter reaches 0. [official/observed: HUD hit bars]
- Players: Campaign 1-3 (offline co-op), Battle 1-4 with configurable teams. No online play (official FAQ). [official]
- Perspective: top-down; the player controls a **ship cursor** that hovers over the map to build, upgrade, repair, recycle, grab rocks, and open menus. [official]

---

## 2. Core loop & simulation rules

1. **Build base** (Battle: choose any free tile not covered by a rock or another base; Campaign: base pre-placed). [official]
2. Build a Harvester, fly the ship, grab rocks and drop them inside the Harvester's magnet to earn Thorium. [design change]
3. Build weapons to stop enemy trains; build Basic/Special Ops spawn towers to produce your own units. Each tower produces a new unit every few seconds and teleports it to your base where it waits for the attack command. [official]
4. Open the attack menu, tilt toward a unit type; units of that type leave the base along the shortest path to the target base. [official]
5. Enemy/own paths are a **flow field over free tiles**: units go around structures; you can reshape the path by placing/removing buildings ("instantly manipulated"). You must always leave at least one access route to a base. [official/observed]
6. Units reaching a base reduce its hit counter; units meeting enemy towers attack them ("every enemy weapon and spawn tower can be destroyed by your arsenal"). [official]

Simulation timing [tuned/engine]: fixed 60 Hz tick, deterministic seeded RNG. Pipeline order is defined in `ARCHITECTURE.md`.

### Path rules
- Ground units: 8-connected flow field to the target base, structures and rocks block tiles; if every route is blocked units attack the blocking structures [tuned/guess; the original "boxes in" units, trophy "kill 20 units boxed in and trapped" confirms trapping is allowed [observed]].
- Air units (Drone, Carrier, Dragon, Bomber-class): fly in a straight line from base to target, ignore structures. [tuned/guess; official: some weapons hit air only/both, so air exists]
- **Gateways** (unlocked Kreios 3 [observed]): paired tiles; ground units entering one exit at its partner [tuned/guess].
- **Waypoints** (unlocked Helios 23 [observed]): the player marks a tile that units visit before heading to the base [tuned/guess].
- Building on top of friendly units destroys them (patch 1.01) instead of floating them. [official]

---

## 3. Controls

PS3 pad actions from the manual, mapped to our inputs. `Intent` types in `src/types/input.ts`.

| Action | PS3 [official] | Gamepad (Xbox layout) [tuned] | Keyboard [tuned] | Intent |
|---|---|---|---|---|
| Move ship | left stick | left stick | WASD / arrows | `move` |
| Open build menu | R1 | RB | E | menu `build` |
| Navigate menu | d-pad | d-pad | arrows | nav |
| Build / confirm | X | A | Space / Enter | `build` / `buildBase` |
| Cycle spawn-tower output | hold X over tower | hold A | hold Space | `cycleOutput` |
| Upgrade | O | B | F | `upgrade` |
| Recycle | Square | X | X | `recycle` |
| Repair | Triangle | Y | R | `repair` |
| Open attack menu | R3 | R-stick click | Tab (toggle) | menu `attack` |
| Choose unit to release | tilt right stick toward unit | right stick | 1-8 / mouse wheel | `attackSelect` |
| Unlock attack (stop auto-release) | tilt right stick in any direction | any right-stick motion | same key again | `attackLock` false |
| Cycle enemy target (Battle) | L1 | LB | Q | `cycleTarget` |
| Grab / drop rock | not stated in manual | hold RT / release | hold G | `grab` / `drop` |
| Pause | Start | Start | Esc | `pause` |

Behaviour:
- Hovering over a structure shows cost to upgrade, recycle value, repair cost, and its range as a **dashed red circle** (also shown when first built). [official]
- A weapon's range circle appears on build. [official]
- Co-op: each human has their own ship/colour, personal Thorium counter and **own base** (fixed spot beside the lead base, in their colour; only joined players get one). Units each player produces are stored in and launched from their own base. Alien releases take turns between the living human bases (one release event each, ascending player id). The team **loses as soon as any human base falls**; time penalties count hits on every human base [design change].

---

## 4. Economy: Thorium, rocks, ship

- Thorium is only obtained from **rocks/meteoroids**, and only through a **Harvester**. Rocks drift across the playfield and land. **No weapon shoots or destroys rocks.** [design change; the original let Turret/Laser/Bomber smash them]
- The ship **grabs a rock and tows it in front of its nose** (the rock swings round to follow the ship's heading) and drops it inside a Harvester's magnet. [design change]
- Harvester magnet (`ECON.harvesterRange`, by level 0-3): 3 / 4 / 5 / 6.5 tiles. Upgrade cost 60 / 100 / 150. The magnet locks the nearest free rock (drifting or landed, **never one a ship is towing**), pulls it onto the pad at 2.5 tiles/s and drains 5 raw Thorium per second (x `thoriumRate` x map factor) until it is empty. One rock per Harvester at a time; a Harvester destroyed mid-harvest drops its rock. Any player's Harvester takes any free rock in its range. [tuned]
- Rock Thorium (`ECON.rockThorium`) grows faster than size: small 15 (3 s), medium 40 (8 s), large 75 (15 s). [tuned]
- Starting rocks per map = `MapDef.rockCount`; new rocks enter from a map-edge hint at an interval driven by `thoriumLevel`. [tuned]

### Tuned rock model
| Rock | Radius (tiles) | HP | Thorium yield | Notes |
|---|---|---|---|---|
| Small | 0.4 | 30 | 8 | 60 % of spawns |
| Medium | 0.7 | 80 | 20 | 30 % |
| Large | 1.1 | 200 | 50 | 10 % |

- Drift speed 0.25-0.6 tiles/s, random heading, bounce off cliffs; rock spawns every `12 / thoriumLevelMult` seconds per map (`thoriumLevel` 1/2/3 -> mult 0.5/1.0/2.0 matching Battle "50 %..200 %" options). [tuned]
- When a Harvester empties a rock, it bursts (`rockSmashed`) and its shards fly to the Harvester owner's base. [tuned]
- Rocks do not block pathing: they drift over structures and units as overlays, but cannot be dragged onto a base. [tuned/guess]
- Ship drag: while holding a rock the ship accelerates more slowly (bigger rocks slow it more). Max carry 1 rock. Ship physics from config: accel 40 t/s², max 11 t/s, drag 6. [tuned]
- Start Thorium: per mission `startThorium` x difficulty multiplier (§11). Battle: set by map symbol 1-3 and the Thorium-rate option (50-200 %). [official: options; numbers tuned]
- Battle bonus: the player who destroys an enemy base gets a Thorium bonus (patch 1.01). [official] Tuned: +250.

---

## 5. Defensive weapons

Four weapons [official]: **Turret, Laser, Pulsar, Bomber**. Official: some hit ground only, some air only, some both. Unlock order observed: Turret (start) -> Laser (Kreios 2) -> Pulsar (Hathor 8) -> Bomber (Hathor 10). [observed, Fandom snippet]

Layer behaviour (no weapon targets rocks):
| Weapon | Hits ground | Hits air | Basis |
|---|---|---|---|
| Turret | yes | no | masks [tuned/guess] |
| Laser | yes | yes (hybrid) | masks [tuned/guess] |
| Pulsar | yes | no | "ground attacking only", only hits things within **one square radius**, even fully upgraded; best on the front line, strong against torpedoes in a "speed trap"; cost 50 Thorium [observed, Fandom snippet] |
| Bomber | yes | yes (splash) | splash [tuned/guess] |

Common rules [official]: bought with Thorium from the build menu on an empty tile; upgrade with O; recycle refunds part of invested Thorium (less when damaged); repair costs more the greater the damage; weapons can be destroyed by enemy fire; **each upgrade adds a black mark on each platform corner; at max level the base grows and corners turn solid black**. Max level = `maxLevel` 3 (three marks) [tuned to match: marks 1-3 then "grown"].

### Tuned weapon table (`WeaponDef`; arrays indexed by level 0-3)
| Weapon | targets | buildCost | upgradeCost (to L1,L2,L3) | hp | range (tiles) | damage / shot | cooldown (s) | splash (tiles) | requires |
|---|---|---|---|---|---|---|---|---|---|
| Turret | ground | 20 | 15, 25, 40 | 120 | 4, 4.5, 5, 5.5 | 4, 6, 9, 13 | 0.50, 0.45, 0.40, 0.35 | 0 | null |
| Laser | both | 35 | 25, 40, 60 | 100 | 6, 7, 8, 9 | 10, 16, 24, 36 | 0.90, 0.85, 0.80, 0.70 | 0 | `laser` |
| Pulsar | ground | 50 | 30, 50, 80 | 150 | 1.5, 1.5, 1.5, 1.5 | 14, 22, 34, 50 | 0.80, 0.70, 0.60, 0.50 | 1.5 (hits all in radius) | `pulsar` |
| Bomber | both | 60 | 40, 60, 90 | 110 | 5, 5.5, 6, 6.5 | 18, 28, 42, 60 | 1.60, 1.50, 1.40, 1.20 | 1.2 | `bomber` |

Sanity numbers [tuned]: a level-0 Turret (8 dps) takes ~1.5 s to kill a Scout (hp 12) and a Scout crosses its 8-tile diameter in ~2.5 s -> a lone turret stops about one scout stream; ~6 turrets are needed to hold a 60-unit tank column. Pulsar dps is ~17-100 per target but applies to every unit in the 1.5 radius, making it the crowd-killer at chokepoints. Bomber has the best splash dps but slow shells (travel time 0.4 s) so fast units (torpedo) slip through.

Targeting priority [tuned]: closest to *its own base* first (units about to hit the base), then closest to the weapon. Rocks are never targeted.

Special rule: **splash** damage never hurts friendly units (no friendly fire). [tuned]

---

## 6. Spawn towers & offence

Two tower types [official]: **Basic Ops** (quick units) and **Special Ops** (advanced, slower).

### Basic Ops tower
- Build via build menu, X. Selected unit output is switched by **holding X** while hovering. To obtain different units, **buy upgrades** (the manual says use resources to purchase upgrades; hover shows next unit's cost and attributes; O to upgrade). Each upgrade adds a corner mark; at max the platform grows and corners go solid black. [official]
- Four units: **Scout, Tank, Drone, Torpedo**, each "varying in strength, speed and abilities". [official]
- Tuned mapping (`SpawnTowerDef.outputsByLevel`): L0 `[scout]`, L1 `[scout, tank]`, L2 `[scout, tank, drone]`, L3 `[scout, tank, drone, torpedo]`; an upgrade is only offered if its unit's tech key is unlocked. `unlockCost` of each unit = cost to reach that level.
- Spawn speed multiplier per level (platform "growth" bonus at L3): `[1.0, 1.15, 1.3, 1.6]` [tuned].
- Units wait at the base (a **teleport** from the tower) until released; cap **1000 units per player** (official: army up to 1000 units, base holds up to 1000). At the cap, towers pause production (no refund). [official/tuned]

### Special Ops tower (Hammer tower)
- Built from the build menu as "Special Ops"; the first special tower is the Hammer spawn tower; hold X on it to choose among *available* specials (Hammer, Switch, Thief, Carrier). [official]
- Slower than Basic Ops; specials are used offensively or defensively. [official]
- Tuned: single level (`maxLevel` 0), outputs all four specials gated by campaign tech.

### Units
Basic Ops [official names; role text for Scout/Tank/Drone/Torpedo is tuned/guess, official only says they vary in speed, health, abilities and exist as ground and air]:
| Unit | Layer | Role |
|---|---|---|
| Scout | ground | fast cheap swarm filler, soaks fire, early game staple |
| Tank | ground | slow, high HP, deals heavy structure damage, anchor of a rush |
| Drone | air | flies straight over the maze, bypasses ground-only weapons (Turret/Pulsar) |
| Torpedo | ground | very fast kamikaze, explodes on first structure/base, strong vs buildings, fragile (countered by Pulsar speed traps [observed]) |

Special Ops [names official; roles: Thief and Carrier official, Hammer/Switch tuned]:
| Unit | Layer | Role |
|---|---|---|
| Hammer | ground | heavy siege breaker, big structure damage, high hp, slow; also the unit whose tower unlocks Special Ops (unlocked Kreios 5 [observed]) [tuned details] |
| Switch | ground | utility: on touching an enemy structure it **disables it for 8 s** (switches it off) [tuned/guess; unlocked Aether 16 [observed]] |
| Thief | ground | **steals enemy units and converts them to your team**; a gang of enemy Thieves is dangerous; use as defence to shrink enemy armies [official, Pelfast details] (unlocked Hathor 9 [observed]) |
| Carrier | air | **carries up to 20 basic ground units through the air**, dropping them at the enemy base; a fully loaded Carrier at the base causes major damage; must be stopped before reaching your territory [official] (unlocked Aether 20 [observed]) |

Thief tuned rule: each contact converts one enemy *basic* unit (instant, with a flash), max 6 conversions before the Thief dies; cannot convert specials or bionic units. Carrier tuned rule: loads up to 20 *own* basic ground units already waiting at the base (cost: they leave the pool), flies at 1.8 t/s along the straight line, on arrival or death unloads/drops survivors, who then act normally (their `baseHits` are applied on unload at the enemy base).

### Attack menu & lock [official]
- **R3 / Tab** opens the attack menu showing army composition as coloured dots: **1 white dot = 1 unit, 1 blue dot = 10 units, 1 red dot = 100 units**.
- Tilt the right stick toward a unit type to release it; units of that type start leaving the base (rate tuned: 40 units/s, so 1000 units take 25 s).
- A **yellow bar** shows the attack is **locked**: you no longer need to hold the stick, units keep advancing automatically. Tilting the stick in any direction **unlocks**. Total army size is the sword number in the HUD.
- Battle: attack menu centre shows the current target player; **L1** switches target. [official]

### Taking out structures
Every enemy weapon and spawn tower can be destroyed by units. Units attack the first enemy structure that blocks their path or that is within 1.0 tile of their route; attack interval 1.0 s per unit (`structureDamage` per hit). [official concept; numbers tuned]

---

## 7. Building, upgrading, recycling, repairing

All [official] unless noted, applied to weapons *and* spawn towers.

| Action | Input | Rules |
|---|---|---|
| Build | menu, X on empty tile | pay `buildCost`; tile must be empty (no rock, no base, no structure); path to every base must stay open (tuned: placement refused if it fully seals a base) |
| Upgrade | O | pay `upgradeCost[level]`; new black mark per corner; max level grows platform and corners solid black |
| Recycle | Square | refund = invested Thorium x `RECYCLE_FULL (0.7)` x `recycleRatio(hp, maxHp)`; damaged structures refund less [tuned numbers] |
| Repair | Triangle | cost = `REPAIR_FULL (0.5)` x invested Thorium x damage fraction (`repairCost(baseCost, hp, maxHp)`) |
| Destroy | enemy fire | structure at 0 hp disappears; no refund |

- `recycleRatio(hp, maxHp) = 0.7 x (hp/maxHp)` (so a half-dead tower refunds 35 % of its invested total).
- `repairCost = 0.5 x baseCost x (1 - hp/maxHp)` where `baseCost` is the invested total.
- Invested total = build cost + all upgrade costs paid. [tuned]
- Weapons/spawn towers have a small cooldown after being built/upgraded: 0.5 s (anti-exploit). [tuned]

### Tuned spawn-tower and support-structure costs
| Structure | buildCost | upgradeCost | hp | requires | profile |
|---|---|---|---|---|---|
| Basic Ops | 30 | 40, 60, 80 | 90 | null | base |
| Special Ops (Hammer tower) | 120 | - | 160 | `hammer` | base |
| Gateway (pair) | 10 | - | 60 | `gateway` | both |
| Waypoint | 5 | - | 30 | `waypoint` | both |
| Harvesting station | 80 | 60, 100, 150 | 90 | - | both |
| Research lab | 150 | - | 120 | `bionic` | bionic |
| Missile silo | 120 | - | 100 | `bionic` | bionic |
| Missile defence system | 100 | - | 140 | `bionic` | bionic |

---

## 8. Unit tuned balance table (`UnitDef`)

`speed` = tiles/second. `spawnSeconds` = seconds one Basic/Special tower needs for one unit at level 0 (divide by `spawnMult`). `structureDamage` per hit (1 hit/s). `baseHits` = damage to a base on arrival, in units of "hits" (fractional allowed: a unit arriving dies; HUD shows `ceil`). `unlockCost` = Thorium to reach that output level. `radius` = crowd spacing.

| Unit | tier | layer | hp | speed | structureDamage | baseHits | spawnSeconds | unlockCost | requires | radius |
|---|---|---|---|---|---|---|---|---|---|
| scout | basic | ground | 12 | 3.2 | 3 | 0.25 | 1.6 | 0 | null | 0.12 |
| tank | basic | ground | 60 | 1.6 | 10 | 0.5 | 3.2 | 40 | `tank` | 0.2 |
| drone | basic | air | 20 | 2.8 | 4 | 0.25 | 2.4 | 60 | `drone` | 0.14 |
| torpedo | basic | ground | 8 | 4.5 | 45 (one-shot, consumed) | 1 | 4.0 | 80 | `torpedo` | 0.12 |
| hammer | special | ground | 220 | 1.0 | 70 | 2 | 8.0 | 0 | `hammer` | 0.3 |
| switch | special | ground | 30 | 2.4 | 0 (disables structure 8 s) | 0 | 6.0 | 0 | `switch` | 0.14 |
| thief | special | ground | 25 | 2.6 | 0 (converts up to 6 units) | 0 | 7.0 | 0 | `thief` | 0.14 |
| carrier | special | air | 160 | 1.8 | 0 (drops cargo, max 20) | 0 (cargo applies own) | 12.0 | 0 | `carrier` | 0.35 |
| snake (bionic) | bionic | ground | 500 | 2.2 | 12 | 3 | 14.0 | 120 | `bionic` | 0.4 |
| dragon (bionic) | bionic | air | 350 | 3.0 | 30 (area 1.2) | 5 | 18.0 | 150 | `bionic` | 0.45 |

Cross-checks [tuned]:
- Cost-efficiency: a Scout costs essentially tower time only; unit Thorium cost is paid via *upgrades* (official model: you buy upgrades, not individual units), so economy pressure is on towers and weapons, not on units.
- Army pace: 20 Basic Ops towers on Scout -> ~12.5 units/s; the 1000 cap fills in ~80 s of full production. A single tank tower: 0.31 tanks/s.
- Weapon matchup: Turret L0 8 dps vs Tank 60 hp = 7.5 s; Tank crosses range in 5.6 s -> tanks need 2+ towers; Pulsar L1 (22 dmg / 0.7 s, splash) ~31 dps against every unit adjacent.
- Ranged threats: enemy units never shoot back at units; they attack structures only (units are melee). [tuned]

### Special rules summary
- Torpedo: explodes (splash 0.8 tile, 45 dmg) on first structure within 0.6 tile or at the base. [tuned]
- Unit death at 0 hp; no healing. [tuned]
- Scouting speed advantage: scouts outrun Tank columns, creating separate arrival waves. [tuned]

---

## 9. Bionic Swarm layer (expansion profile `bionic`)

Sources: [official] Bionic Swarm adds 16 levels across two new comets (**Gaia**, **Kronos**, 8 areas each, areas 29-44), 10 battle maps in two new environments, new gameplay features, enhanced research upgrades, nuclear silos, behemoth swarm creatures and kamikaze drones. [observed] Trophy guide: Big Snake / Big Dragon trophies need 2-3 players; enemy research tower researches missile silos, silos build missiles, a Pulsar adjacent to a silo destroys it and chain-explodes neighbouring silos; area 41 (Kronos) shortcut opens by destroying key enemy structures. [observed] the user's notes (`pdf fondation general du jeu.pdf`, handwritten French):

- **Spaceship recharging station** ("spawn, base" / player respawn): where the ship respawns/recharges; there is one per base, also acts as player spawn point. [notes] Tuned: if the ship is destroyed/disabled it respawns here after 5 s; carrying a rock drains energy that refills here.
- **Harvesting station** ("produces money, player with rock"): the only way to turn rocks into Thorium. Its magnet (3 / 4 / 5 / 6.5 tiles by level) pulls in the nearest free rock and drains it; bigger rocks take longer and pay more (see §4). Available in both rulesets; cost 80.
- **Research lab** ("unlocks new troop or upgrade"): costs Thorium to research an item in-game, taking `ResearchDef.cost` Thorium; research time 20 s; unlocks units/upgrades in Battle and for the AI. In campaign tech is also granted by areas. Implemented: the lab exists only in the Bionic Swarm ruleset; Bionic battles grant every base-game tech at start and the lab sells the Bionic research (`bionic: true` in `src/data/research.ts`): Snake Swarm `snakeSwarm` 140, Missile Defense `missileDefense` 150, Dragon Swarm `dragonSwarm` 180, Missile Silo `missileSilo` 200 [tuned]. These keys are not part of `ALL_TECH_KEYS` (the base/campaign set).
- **Dragon** and **Snake**: super-units. Tuned: *Snake* = ground chain that merges 20 queued ground units into one long armoured ribbon (hp 500, damage on arrival 3 hits); *Dragon* = air equivalent (hp 350, fire breath, 5 hits). Visual snakes in screenshots [observed] are the unit trains themselves.
- **Missile silo**: builds a long-range missile (build time 25 s, then ready); launch by selecting "missile" in the attack menu; missile travels 4 t/s straight at the target base or structure cluster, deals 3 base hits and a 3-tile splash on structures (100 dmg). Silos are vulnerable and chain-explode (damage 80 in radius 1.5 when destroyed while armed). Counter: **Missile defence system** (cost 100, range 7, hits missiles only, 1 shot/1.5 s, kills a missile in 2 shots) [tuned].
- **Attack/defence classes** (HUD classification from the notes): **Ground**, **Air**, **Hybrid**, **Bomber**. Mapping used by the code: weapons/units are tagged by class: Ground = hits/is ground only (Turret, Pulsar; scout, tank, hammer...), Air = hits/is air only (Drone, Carrier, Dragon), Hybrid = hits both (Laser), Bomber = area-effect class (Bomber weapon, torpedo, missile). The HUD shows four small class icons next to each weapon/unit card. [tuned mapping of the note]
- Kronos area 41 in the reference video: red AI vs blue/yellow human army, 5-6 minute match, bases with 50/70 hits. [observed]

---

## 10. Game modes

### Campaign [official unless stated]
- Goal: take control of four comets (Kreios, Hathor, Aether, Helios) with **7 areas each** (area numbers 1-28), then **Resurgence** areas; Bionic Swarm adds Gaia (29-36) and Kronos (37-44) (8 areas each, 44 total). [official + trophy guide]
- Resurgence (patch 1.03): 4 maps, one per comet, each unlocked after completing that comet's 7 areas; not required to progress; **harder than other levels; no hints**. [official]
- Tech unlock: completing an area unlocks new offensive/defensive towers. Observed order (Fandom campaign snippet): Kreios 1 Tank, Kreios 2 Laser, Kreios 3 Gateways, Kreios 5 Hammers, Hathor 8 Pulsar, Hathor 9 Thief, Hathor 10 Bomber, Aether 15 Drone, Aether 16 Switches, Aether 19 Torpedoes, Aether 20 Carrier, Helios 23 Waypoint. (The snippet also lists a "Resurgence" entry at areas 7/14/21/28 - the numbering of resurgence vs regular areas is ambiguous in the sources; we model 28 regular areas + 4 separate Resurgence maps.) [observed]
- Players: 1-3 co-op. Difficulty: **Beginner, Casual, Normal (Ranked), Expert** (Expert added in patch 1.03). Only Normal is ranked. [official]
- Dynamic AI: attack waves adapt to your defence; enemies are released strategically, not on timers. [official]
- Scoring: time-based; hits taken apply **time penalties as they occur** (patch 1.01); rank shown on the Area Complete screen; online leaderboards with flags. [official]
- Trophies: 12 in the base game [official]; one trophy "kill 20 units boxed in with weapons" at Kreios 1 [observed].
- Save: campaign progress persisted (patch 1.01). Our save key `orbital-clash.save.v1`.

### Difficulty multipliers (from `DIFFICULTY_MULT`) [tuned]
| Difficulty | Enemy strength mult | Start Thorium mult | Time penalty per hit taken (s) |
|---|---|---|---|
| Beginner | 0.6 | 1.5 | 0 |
| Casual | 0.8 | 1.2 | 0 |
| Normal (ranked) | 1.0 | 1.0 | 5 |
| Expert | 1.4 | 0.8 | 10 |

"Enemy strength" scales scripted release counts, AI build speed and enemy base Max Hits.

### Battle [official]
- Choose 1-4 players (2-4 humans), then a **map**; the symbols under the map show Thorium abundance. Teams: default = free-for-all; set equal team names for 2v2, 3v1, 2v1 etc.
- **Max Hits** per base: 1-100 (sets match length); default 10 (our `DEFAULT_HITS`).
- **Strength** per team: scales Max Hits and starting Thorium (example from manual: 50 % of 100 hits / 1000 Thorium = 50 hits / 500 Thorium).
- **Timed Battle** (patch 1.03): when the timer reaches 0 all units spawn at **8x** normal rate (`OVERTIME_SPAWN_MULT`).
- **Thorium rate**: 50 %-200 % of default map levels (patch 1.03). Steps tuned: 50/75/100/150/200 %.
- Target selection: R3 attack menu, L1 changes target. Build base on any free tile first. Destroying an enemy base gives a Thorium bonus (patch 1.01).
- Free for all: eliminate everyone; team: last team standing; AI opponents fill empty slots [tuned].
- Maps: 4 base-comet maps (one per comet, patch 1.03 added one per comet) plus Bionic Swarm's 10 maps in two environments. We ship 4 + 4 (§12).

### Other [official]
- 1080p, 4:3 SD layout (patch 1.02), Dolby/DTS audio, video record (patch 1.01) - not replicated; BGM from library not replicated.
- Languages: English, French, Italian, Portuguese, Spanish, Swedish, Russian, Dutch, German (we ship EN first, FR/ES optional [tuned]).

### Patch notes (summary of official 1.01-1.03)
| Patch | Content |
|---|---|
| 1.01 | video record + YouTube upload, flag icons on leaderboard, campaign save data, time penalties applied immediately, rank on Area Complete, building over own units destroys them, Battle base-kill Thorium bonus |
| 1.02 | new/remastered sound effects, 4:3 SD layout, graphics + performance improvements, 9 languages |
| 1.03 | Expert difficulty, 4 new Battle maps (one per comet), 4 Resurgence maps (no hints, harder), Timed Battle (8x spawn at 0), Thorium rate 50-200 % |

---

## 11. Win/lose, hits and economy defaults

- Each base starts with `maxHits` hits (campaign: `Mission.enemyHits[difficulty]`; human base = `DEFAULT_HITS` 10 unless the mission overrides). Arriving units subtract `baseHits`; a base is destroyed at <= 0; the destroyer gets the Battle bonus.
- A base also destroys its owner's spawn towers? **No**: only the base is the objective; remaining structures stay (observed AI structures persist in screenshots) [tuned].
- Campaign loss: base destroyed -> restart area. Win: enemy base destroyed (or scripted objective) -> Area Complete with time, penalty, rank.
- Rank stars [tuned]: time (incl. penalties) <= par: 3 stars, <= 1.5x par: 2 stars, else 1.
- Unit cap 1000 per player (`STORAGE_CAP`). [official]

---

## 12. Proposed content lists

### 12.1 Campaign: 28 areas (base profile)
`enemyHits` is for Normal (Beginner x0.6, Casual x0.8, Expert x1.4 via difficulty multipliers). `AI` = aggression 1-10 (release size and frequency). `Start` = start Thorium. Par in mm:ss. "Teaches" = tech key introduced (matches observed unlock order where known [observed]); teaching text for the others is [tuned].

| # | Comet | Name | Teaches / focus | enemyHits | AI | Start | Par |
|---|---|---|---|---|---|---|---|
| 1 | Kreios | First Impact | build, upgrade, first attack; unlocks `tank` | 5 | 1 | 300 | 4:00 |
| 2 | Kreios | Rock Fall | meteoroids, harvest rocks for Thorium; unlocks `laser` | 8 | 1 | 300 | 5:00 |
| 3 | Kreios | Crossroads | path manipulation (maze), `gateway` | 10 | 2 | 300 | 6:00 |
| 4 | Kreios | Hold the Line | upgrades, recycle & repair, black corner marks | 12 | 2 | 320 | 6:30 |
| 5 | Kreios | Hammer Time | Special Ops tower, `hammer` | 15 | 3 | 340 | 7:00 |
| 6 | Kreios | Pressure Point | attack lock, release timing | 15 | 3 | 340 | 7:00 |
| 7 | Kreios | Crater Core | finale: mixed push, defend while attacking | 20 | 4 | 360 | 8:00 |
| 8 | Hathor | Dune Gate | `pulsar`, front-line crowd control | 20 | 4 | 380 | 8:00 |
| 9 | Hathor | Sand Thieves | `thief`, countering unit theft | 22 | 4 | 380 | 8:30 |
| 10 | Hathor | Blast Radius | `bomber`, splash vs columns | 25 | 5 | 400 | 9:00 |
| 11 | Hathor | Mirage | economy: scarce rocks, harvest planning | 25 | 5 | 400 | 9:00 |
| 12 | Hathor | Twin Spires | two entry lanes, split defence | 28 | 5 | 420 | 9:30 |
| 13 | Hathor | Counterstrike | punish the AI's release by counter-rush | 30 | 6 | 420 | 10:00 |
| 14 | Hathor | Pharaoh's Core | finale: layered base | 35 | 6 | 440 | 10:30 |
| 15 | Aether | Cloud Break | `drone`, first air waves | 30 | 6 | 440 | 10:00 |
| 16 | Aether | Switchyard | `switch`, disabling enemy towers | 32 | 6 | 460 | 10:30 |
| 17 | Aether | Updraft | hybrid anti-air layout (Laser/Bomber) | 35 | 7 | 460 | 11:00 |
| 18 | Aether | Frostbite | efficient recycling, budget rebuilds | 35 | 7 | 480 | 11:00 |
| 19 | Aether | Torpedo Run | `torpedo`, speed traps with Pulsar | 40 | 7 | 480 | 11:30 |
| 20 | Aether | Skybridge | `carrier`, 20-unit airlift | 40 | 7 | 500 | 12:00 |
| 21 | Aether | Zenith Core | finale: air + ground combined | 45 | 8 | 500 | 12:30 |
| 22 | Helios | Cinder Gate | everything unlocked, heavy enemy economy | 40 | 8 | 520 | 12:00 |
| 23 | Helios | Waypoint | `waypoint`, routing armies | 45 | 8 | 520 | 12:30 |
| 24 | Helios | Magma Maze | long enemy mazes, breach strategy | 45 | 8 | 540 | 13:00 |
| 25 | Helios | Solar Flare | constant pressure, tight timing | 50 | 9 | 540 | 13:00 |
| 26 | Helios | Eclipse | scarce Thorium, high-value upgrades only | 50 | 9 | 500 | 13:30 |
| 27 | Helios | Heat Sink | multi-lane defence + carrier rushes | 55 | 9 | 560 | 14:00 |
| 28 | Helios | Sun Core | finale: full toolkit, tough AI | 60 | 9 | 600 | 14:30 |

Ramp rules [tuned]: `startThorium` baseline 300 + 10-20 per area; AI aggression 1->9; enemy hits 5->60; hints available in areas 1-28 (Beginner/Casual always, Normal 1-6 only, Expert none); Kreios areas 1-3 use the 30x20 plateau, later areas up to 40x26, finales up to 48x30. Enemy scripts: timeline `release` events plus reactive AI.

### 12.2 Resurgence (no hints, more challenging) [official premise; maps tuned]
| # | Unlocks after | Name | Focus | enemyHits | AI | Start | Par |
|---|---|---|---|---|---|---|---|
| R1 | Kreios 1-7 | Kreios Resurgence | tank swarms + early thieves, tight Thorium | 70 | 10 | 450 | 12:00 |
| R2 | Hathor 8-14 | Hathor Resurgence | pulsar-proof torpedo spam, hidden second base route | 80 | 10 | 450 | 14:00 |
| R3 | Aether 15-21 | Aether Resurgence | air superiority, carriers every 90 s | 90 | 10 | 450 | 16:00 |
| R4 | Helios 22-28 | Helios Resurgence | all units, switches and thieves, relentless | 100 | 10 | 450 | 20:00 |

### 12.3 Bionic Swarm campaign (profile `bionic`, optional content)
Gaia areas 29-36 and Kronos areas 37-44 (8 each), unlock `bionic` (research lab, harvester, silo, missile defence, snake, dragon), AI uses missiles from area 34 [observed]. Names/lists to be authored by the campaign owner using the same ramp rules (hits 50->120 capped at 100 on Max Hits, AI 8->10, par 12-24 min). Area 41 (Kronos 5) = shortcut opened by destroying key structures [observed].

### 12.4 Battle maps (4 base + 4 bionic)
`thoriumLevel` 1 = low, 2 = medium, 3 = high (1-3 Thorium symbols under the map). Sizes in tiles, all within the 48x30 grid.

| # | Profile | Name | Size / description | Players | thoriumLevel | Palette |
|---|---|---|---|---|---|---|
| 1 | base | Kreios Crater | 36x24, central rock ring with 4 corner starts | 2-4 | 2 | kreios |
| 2 | base | Hathor Dunes | 40x26, wide open sand with scattered rock pillars, 4 starts | 2-4 | 3 | hathor |
| 3 | base | Aether Drift | 44x24, long horizontal corridor, two flanking lanes, 2-player focus | 2 | 1 | aether |
| 4 | base | Helios Forge | 48x30, huge arena, magma chokepoints at the centre | 2-4 | 2 | helios |
| 5 | bionic | Gaia Hollow | 40x26, organic cave with a winding mid corridor, many small rocks | 2-4 | 3 | gaia |
| 6 | bionic | Gaia Roots | 36x28, vertical map, four root-like lanes, tight fights | 2-4 | 2 | gaia |
| 7 | bionic | Kronos Grid | 44x28, hex panels, symmetrical lanes with cyan inlay circuits | 2-4 | 2 | kronos |
| 8 | bionic | Kronos Vault | 48x30, fully enclosed with a central silo cross, 3-4 players | 3-4 | 1 | kronos |

Palette for bionic maps uses `gaia`/`kronos` keys (not in `CometId`; add as optional `palette` extension per the render-engine owner).

---

## 13. Open questions / assumptions to confirm during implementation

1. Exact weapon target masks (Turret ground, Laser both, Pulsar ground, Bomber both) are tuned; official only says "some ground, some air, some both". Adjust if wiki access improves.
2. `baseHits` fractional scale (0.25 per scout) is a tuning decision to make 1000-unit armies feasible against Max Hits up to 100; sim-core owner may instead model "hits per unit arrival" with a cooldown.
3. Switch ability and Hammer role are not described in accessible sources; tuned versions above.
4. The Resurgence numbering conflict (areas 7/14/21/28 vs separate maps) is resolved as 28 regular + 4 separate.
5. The reference video was inspected as seven sampled frames (360p); gameplay timing there (matches of 6 minutes, bases 50-70 hits, armies up to ~700 units) informed pacing but not exact numbers.
