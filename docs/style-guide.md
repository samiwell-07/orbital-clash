# Visual Style Guide (renderer / models / fx / UI)

Source of truth for how Orbital Clash looks. Gameplay is a clone of the PS3 game *Comet Crash*; **art is 100% original and procedural** (three.js geometry, canvas textures, shaders). We copy the *composition and readability* of the reference, never its assets.

Evidence tags: **[observed]** = seen in the 3 reference screenshots (`workspace/comet crash photo/IMG_0775..0777.jpeg`: GameSpot "Bionic Swarm Q&A", Game Design Reviews "TD meets Casual", IGN "Bionic Swarm") or in 7 frames sampled from the YouTube video *Comet Crash 1P Kronos Area 41* (`nHiis7aoI9c`, downloaded at 360p with yt-dlp, frames at 5/20/35/50/65/80/92 % then deleted; browser tools were unavailable, so no interactive seeking). **[tuned]** = our decision.

Caveat: all references are low-res/compressed (video 470x360). Colours below are eyeballed and rounded; treat them as palette intent, not exact samples.

---

## 1. Camera

| Property | Reference [observed] | Orbital Clash default [tuned] |
|---|---|---|
| Projection | Almost top-down; tower cylinders show a thin dark side wall on their *south* face, tall units show a little height. Near-orthographic feel, no strong foreshortening. | Perspective, **fov 28°** (narrow = near-ortho) |
| Pitch | ~65-75° from horizontal | **62°** below horizon (so tower walls read, trains look 3D) |
| Yaw | 0 (screen-up = map north, -y) | 0 |
| Target | Whole plateau always visible, no scrolling | Map centre `(MAP_W/2, 0, MAP_H/2)` |
| Distance | n/a | **~64 tiles** from target for a 30x30 plateau at 16:9 |
| Camera position | n/a | South of and above the actual map centre; `near 1`, `far 400` |
| Cursor/ship zoom | none | none (fixed camera). Optional 0.5 s ease-in "intro dolly" from distance 80 to 64 |
| Screen shake | none noticed | trauma-based, max 0.35 tile, only on base hit / big bomber blast, decays 1.8/s |

Fit the four ground corners to the available frustum, with a 6% margin. The board remains square in world space regardless of viewport aspect ratio; the pitched camera gives it perspective.

**Tile readability:** one visible floor square equals one placement cell. Use material variation for texture, not a second grid. Fixed cliff tiles join into walls; leave adjacent walkable cells visibly clear. A tower still occupies one cell.

Letterbox: HUD sits over a dark, rounded frame; the playfield rectangle is bordered by a thin black line and a 1-tile dark rim (§3).

---

## 2. Lighting & colour pipeline (the "PS5 upgrade")

Everything below is a default; expose each as a field in `src/config` (render quality object) so presets (Low/Med/High/Ultra) can scale them.

| Item | Default |
|---|---|
| Renderer | `WebGLRenderer({ antialias:false, powerPreference:'high-performance' })`, pixel ratio `min(devicePixelRatio, 2)`, render through `EffectComposer` (MSAA 4x render target `samples:4`) |
| Colour space | sRGB output, linear working space |
| Tone mapping | **ACESFilmic**, exposure **1.05** (per-comet 0.95-1.15) |
| Key light | `DirectionalLight` colour `#fff1dc`, intensity **2.6**, direction from azimuth **-35°** (from top-left of screen), elevation **52°**; casts soft shadows |
| Shadow | PCFSoft/VSM, map **4096²** (2048² on Med), ortho frustum fitted to map + 4 tiles, `bias -0.0004`, `normalBias 0.6`, radius 3 (blur) |
| Fill / sky | `HemisphereLight` sky `#8fa8ff`, ground `#2a2038`, intensity **0.55** (colour shifts per comet, §3) |
| Rim | `DirectionalLight` `#6fd8ff`, intensity 0.8, from bottom-right, no shadows (gives glossy edge on towers) |
| Environment | procedural PMREM from a gradient + a few bright "stars" so metals reflect something; `envMapIntensity 0.9` |
| Ambient occlusion | SSAO/GTAO half-res, radius 0.6 tile, intensity 0.8 (Med+ only); fake blob AO under towers as fallback |
| **Bloom** | `UnrealBloomPass`: strength **0.85**, radius **0.55**, threshold **0.82** (applied to linear HDR; only emissive > 1.0 survives). Ultra: strength 1.0 + a second wide pass (radius 0.9, strength 0.35) |
| Emissive rule | glowing things use `emissiveIntensity` 2-6 so they exceed the bloom threshold; non-glowing surfaces never exceed 0.8 |
| Vignette | strength **0.28**, offset 0.35 (darkens the 3 tile screen edge, not the HUD) |
| Depth of field | very subtle tilt-shift: `BokehPass` focus = target distance, aperture `0.00008`, maxblur `0.004`; blur only the outer 12 % of the frame; disabled on Low |
| Chromatic aberration | 0.0008 at edges only, Ultra only |
| Film grain | 0.025, animated; Ultra only |
| Colour grade | slight teal shadows `#0a1230`, warm highlights; saturation 1.08, contrast 1.06 (LUT or ShaderPass) |
| Fog | none on playfield; background beyond the plateau is a dark starfield/nebula `#05060f` -> `#16102b` |
| Anti-aliasing | MSAA render target + SMAA/FXAA pass on Low |

Performance budget: 1000-unit armies x up to 4 players + ~600 structures -> **instancing is mandatory** (§8).

---

## 3. Terrain / per-comet palettes

Terrain is a heightfield-less flat plane per tile with decorative border geometry. Each comet defines a `palette` (MapDef.palette is a `CometId`; Bionic uses extra keys `gaia`/`kronos` added by the render-engine owner).

### Kronos (Bionic Swarm) - purple hex-panel metal [observed: IMG_0775, IMG_0776, video]
- Floor: large regular hexagonal plates (~3-4 tiles across) with thin dark seams. Base `#5a5896` (lavender-violet), plate variation +-6 % lightness, seam `#1c1a3a`, 2 px bevel highlight `#7f7cc4` on upper-left edge. Roughness 0.55, metalness 0.35, subtle anisotropic scratches.
- Cyan glowing inlays: thin straight/diagonal light strips and small round "beacon" discs; emissive `#33e6ff`, intensity 3.5, long thin quads (width 0.06-0.1 tile) running along hex seams and occasional 0.3-tile discs (see top-left of IMG_0776). Bloom makes them halo.
- Border: raised grey-white armour frame `#b8bcc8` with chamfers, black hexagonal cut-outs in the corners (video + IMG_0775 left side), cyan light strips on the inside edge. Outside the frame: dark space `#080a18`.
- Play rectangle: 1-px black line around the buildable area; cells outside are "cliffs" (dark `#14122b` metal, no build).
- Hemisphere sky `#8f93ff`, key light slightly cool `#f2f0ff`, exposure 1.0.

### Gaia (Bionic Swarm) - green/olive organic cave [observed: IMG_0777]
- Floor: mossy olive-green `#4f5a22` mottled with dirt-brown patches `#8a6b34` and lighter grass `#7f9433`; large-scale noise (2 octaves) + fine speckle, roughness 0.9, metalness 0. Subtle normal-map pebbles.
- Border: irregular jagged rock walls/cave rim, grey-green `#3d4030` with darker fissures `#1a1c12` and moss highlights `#6a7d2a`; organic (non-rectangular) outer silhouette, a handful of glowing blue-green crystals `#58e0b0` in cracks.
- Same 1-px black line around the playable rectangle, then inner dirt band.
- Light: warmer key `#ffe9c0`, hemisphere sky `#a8c070`, ground `#3a2c18`, exposure 1.1.

### Base-game comets [tuned - not in our references, inferred from names]
| Comet | Floor | Accent glow | Border | Mood |
|---|---|---|---|---|
| Kreios | rust/slate rock `#6b5a52` over dusty `#8c7b6a` | amber `#ffb347` | dark basalt `#2e2724` | tutorial, neutral and readable |
| Hathor | sand-gold dunes `#c8a35a`, darker `#8f6e34` ripples | turquoise `#37e0c8` | sandstone `#6e5530` | warm desert, long shadows |
| Aether | pale ice/cloud `#9fb6d6`, deep blue cracks `#2c4a7a` | white-blue `#b5e6ff` | frosted crystal `#dbe8f5` | cold, bright, high exposure 1.15 |
| Helios | black basalt `#2a1f1f` with lava veins `#ff5a1a` | lava orange `#ff7a2e` (emissive 4) | molten edge `#ff3d00` | dramatic, add heat-haze post effect |

All floors must keep **contrast against towers (light grey) and trains (saturated team colours)**: floor luminance stays mid/dark, saturation low except the glow accents.

Terrain extras: faint grid is NOT drawn; the 1-tile cell structure is implied by tower platforms. In build mode (cursor over empty tile) fade in a 0.15-alpha white 1-tile outline under the ship.

---

## 4. Structures (towers)

### Platform base [observed: all screenshots, manual text]
- Every weapon and spawn tower stands on an **octagonal grey platform**, 1 tile wide (0.92 tile across flats), height 0.12 tile, chamfered, steel grey `#8a9099` top / `#4a4f57` side wall, slight cyan or white rim line when powered. Metalness 0.7, roughness 0.45.
- Platforms read as a repeating grid of "coins/buttons" when packed (IMG_0776 shows blocks of 3x7 platforms with an engraved X/cog in the centre: that is an **idle/empty or Special slot marker** - on our side use a recessed cross-cog decal `#2a2e35`).
- **Upgrade level marks** [official + observed]: each upgrade adds a **dark/black mark on each of the 4 corners** of the platform (level 1 = 1 mark per corner, level 2 = 2, level 3 = 3 small black triangles). At **max level the platform grows** (scale 1.0 -> 1.12, corners become **solid black** wedges) - draw it as a distinct larger octagon with a thin bright team-coloured ring. Corner marks are separate instanced decals so they can be swapped without rebuilding the model.
- Damage state: soot decal alpha 0-0.6, small orange emissive cracks below 40 % hp, smoke wisp particle below 25 %.
- Team accent: a **0.06-tile emissive ring** and a small flag/crest on the platform in the owner colour (colours §5). Neutral/destroyed: grey, no ring.

### Weapon models (top-down silhouettes; each ~0.7 tile tall max)
| Weapon | Silhouette | Accent | Idle animation |
|---|---|---|---|
| Turret | squat round cannon housing with a single rotating barrel (twin barrels at lvl 2+, long at 3) | team ring, muzzle emissive `#ffd27a` | barrel tracks target, recoil 0.08 tile |
| Laser | slender prism/emitter on a pedestal, crystal tip | cyan/pink beam colour by level (`#4dd8ff` -> `#ff4dd2`), crystal emissive 4 | crystal slowly rotates + pulsing glow |
| Pulsar | low drum with a ring coil, shows a circular pulse | white-violet `#e8d8ff` ring, shockwave rings radius = range | coil spins, charge glow every cooldown |
| Bomber | fat launcher dish angled up with a magazine drum | orange `#ff8a2a` shell glow | dish elevation follows target |

### Spawn towers
- **Basic Ops**: platform + a vertical "spawn pad" cylinder with a teleport beam column (cyan-white, short); colour band shows the selected output unit (scout white, tank red, drone cyan, torpedo orange). Units pop out as a small flash, then "teleport" as a streak to the owner base (see fx).
- **Special Ops / Hammer tower**: larger central hammer-head block on the platform, dark with 4 coloured lights (one per special). Same upgrade-corner rule.
- Seen in references: blue-and-orange paired spawn towers on the left of IMG_0776 (blue team, orange accents) and red-white spiky towers for the red team (IMG_0775/0776): team towers are **tinted in the owner colour on their upper cap**, grey underneath.

### Support structures (Bionic layer) [tuned silhouettes]
- Harvesting station: wide dish + rock-claw, yellow thorium glow `#ffd23c`.
- Research lab: dome with orbiting ring, white-blue `#bfe9ff`.
- Spaceship recharging station: pad with 4 pylons around the base, green `#66ff9a` pulse.
- Missile silo: hexagonal hatch that opens (door anim 0.4 s), orange warning light; missile = thin white body, red tip.
- Missile defence: twin flak turret with cyan targeting laser.
- Gateway: two matching rings with a violet swirl `#a06bff`; waypoint: small floating chevron marker.

---

## 5. Team accents

| Slot | Name | Hex (== `PLAYER_COLORS`) | Observed in |
|---|---|---|---|
| 0 | Blue | `#3aa0ff` | blue/white towers, blue crystal snake (IMG_0775/0776) |
| 1 | Red | `#ff4a4a` | red-white spiky towers/army (all) - also the **AI/enemy default** |
| 2 | Purple | `#b55cff` | purple snake, purple towers (IMG_0777) |
| 3 | Orange-yellow | `#ffb02e` | yellow/gold fire snake (IMG_0775/0776) |

Use team colour for: tower ring/cap, unit emissive stripes, HUD panel glyph, trail tint, ship, selection ring. Keep a **secondary neutral** (white `#f2f4ff` or grey `#9aa0aa`) so teams stay readable when colours overlap; never rely on hue alone - also vary the unit spike pattern per team (blue = smooth shards, red = spikes, purple = curved horns, orange = fins).

---

## 6. Army trains (the signature look)

Observed: armies are **long, single-file-ish snakes of tiny spiky units** that follow the flow-field path in thick ribbons 1-1.5 tiles wide, weaving through the tower maze (IMG_0775 blue crystal snake 25+ tiles long; IMG_0776 blue-then-yellow serpent; IMG_0777 purple ribbon along the border; red units pooled as dense carpets around the red base). Waiting units in a base form dense "carpets" of red-white spikes.

Per unit (instanced, one `InstancedMesh` per kind x team):
- Mesh: tiny low-poly diamond/arrow shard ~0.14 tile long, 6-8 triangles, pointing along heading, slight vertical sinusoidal bob (0.02 tile, phase by id) to give the "scaly" shimmer seen in the references.
- Material: PBR, base team colour, metalness 0.4, roughness 0.35, per-instance colour jitter +-8 % lightness (via `instanceColor`), emissive team colour 0.6.
- **Colour coding by team** [observed]: blue snake = cyan-white crystal segments with bright `#8fe8ff` highlights; red = crimson `#c0222b` with white `#f0f0f0` spike tips; purple = magenta-violet `#9b44e6` with white-lilac glints; yellow/orange = golden `#ffc21a` body with orange `#ff7a1a` flame edges.
- **Fire/ember trail** [observed: yellow head in IMG_0776 trails glowing orange/yellow flame, bright white-hot burst at the head when firing at structures]: head of a train (first ~20 units) emits GPU sprite embers - lifetime 0.5 s, additive, start `#fff2a0` -> `#ff7a1a` -> `#401000`, size 0.1->0.3 tile, emissive 4. Rest of the train gets a faint 0.3 s tint trail only when speed > 2 tiles/s.
- Unit kinds differ in silhouette scale only: scout 0.8x (slim), tank 1.3x (wide, armoured plates, darker), drone hovers at y=0.5 with a small shadow blob offset and quadrotor fins, torpedo 1.0x with a glowing tip and exhaust. Specials: hammer 2.2x block head, switch 1.2x with zig-zag glyph, thief 1.1x hooded green-tinted, carrier 2.6x flat wing with cargo bay lights.
- Bionic: **snake** = segmented chain (each 6 units merge into one ribbon segment with a spline mesh, 0.5 tile wide, scaled glowing scales), **dragon** = airborne snake with wing quads (two tiles span), breath cone fx, casts a long shadow.
- LOD: beyond 1000 units total, drop per-instance bob and trails for units not in the first 20 of a train.

---

## 7. Projectiles, beams, explosions, crystals

All fx are additive sprites/ribbons on GPU particle systems (`THREE.Points` or instanced quads with a vertex-shader simulation; one draw call per fx type, pooled capacity 20 000 particles, ring-buffer reuse).

| FX | Look | Params |
|---|---|---|
| Turret bullet | short bright tracer, `#ffe08a` | length 0.4 tile, speed 22 t/s, 1-frame muzzle flash sprite 0.35 tile |
| Laser beam | thick core + soft halo, flicker; lines like pink/red beams crossing the maze in IMG_0775 (left-mid) | core `#ffffff` width 0.05, halo colour by owner/level (`#4dd8ff` / `#ff4d6e`), halo width 0.25, emissive 5, hit spark burst of 8 particles; duration = cooldown*0.5 |
| Pulsar pulse | expanding ring + brief ground glow | ring from r=0.2 to range in 0.25 s, white-violet `#e8d8ff`, alpha 0.8->0, distortion shader optional |
| Bomber shell | lobbed orange orb, arc height 1.5 tile, smoke trail | explosion radius = splash; fireball sprite sheet (procedural), shock ring, 6-10 ember sparks, dust puff |
| Explosion (unit death) | tiny puff 0.25 tile | pooled, 6 particles, 0.3 s |
| Explosion (structure kill) | big: fireball (0.9 s) + debris chunks (6 instanced shards with gravity) + smoke column 1.8 s + ground scorch decal that fades over 20 s | bloom peak emissive 6 |
| Torpedo detonation | blue-white flash with ring | radius 0.8 tile |
| Hits on a base | camera shake + red vignette pulse (0.25 s) + HUD hit counter flashes | |
| Fire patches | where trains torch towers: ember emitter at 30 particles/s, orange `#ff6a1a`, life 0.8 s | |
| Thorium crystals | **rocks/meteoroids**: grey-blue faceted rocks `#7a838f` (rough, metalness 0.2, 6-10 facets via icosphere displacement) 0.5-1.4 tile across, drifting + slowly rotating; **thorium core** glows yellow-green `#d8ff3c` through cracks (emissive 3). On smash: 8-20 glowing shards fly to the ship's owner counter; thorium pickup adds a "+N" floater in yellow. |
| Blue crystals | static decorative/geological crystals on Kronos/Gaia: cyan-white faceted clusters `#7fe9ff`, emissive 2.5, soft pulsing light (no real light, fake via bloom). The white-lilac shiny blobs on towers in IMG_0775/0777 are **power crystals**: add tiny white-violet crystal on high-level towers. |
| Teleport / spawn | vertical cyan beam 0.15 tile wide, 0.2 s, then particle streak to base 0.5 s |
| Ship | small wedge-shaped craft in team colour hovering at y=1.2, soft drop shadow, engine glow `#9fe0ff`, tractor beam (green-white ribbon `#9dffb0`) to the grabbed rock, dashed red range circle (manual) on tower hover |

Particle colour discipline: only three families - **amber/orange** (fire, bombs), **cyan/white** (energy, teleports, lasers), **team colours** (trails/units). Avoid green/pink explosions unless a specific beam colour.

---

## 8. Rendering technique requirements

- **Instancing**: one `InstancedMesh` per (kind x team) for units (capacity 1100/team), per (structure kind x level) for towers, platform corner marks and rocks. Update matrices from sim snapshots each frame (`DynamicDrawUsage`), skip frustum culling.
- **Draw-call target**: < 250 per frame at High, < 120 on Low.
- **Shadows**: units cast shadows only on High/Ultra (blob decal otherwise); towers and rocks always cast.
- **Textures**: all `CanvasTexture`/DataTexture generated at load: hex floor (2048², mipmapped, anisotropy 8), cave noise, rock normal, glyph atlas for HUD digits, particle sprite atlas (glow, spark, ring, smoke, flame). No external images.
- **Materials**: `MeshStandardMaterial` for structures/units, `MeshBasicMaterial` + additive for fx. Use `toneMapped:false` for HUD/sprites so they stay crisp.
- **Post stack order**: Render (MSAA) -> SSAO -> Bloom -> DOF/tilt-shift -> Colour grade + vignette -> (grain/CA Ultra) -> output (ACES applied in `OutputPass`).
- **Quality presets**: Low (no SSAO/DOF, shadows 1024, bloom 0.6), Med (shadows 2048, AO half), High (defaults above), Ultra (4096 shadows, 2nd bloom, CA, grain).
- Frame budget: 60 fps on integrated GPU at Low, 1080p; adaptive resolution scale 0.7-1.0 when frame time > 18 ms for 30 frames.

---

## 9. HUD / UI

Reference [observed: IMG_0775 / IMG_0777 left sidebar; video bottom bar in the 4:3 layout]:

**Left sidebar (16:9)**, ~15 % of screen width, dark rounded plates `#0b0c10` at 85 % alpha with a 2 px inner highlight `#2b2f3a`, corners chamfered like the border frame.
1. **Timer**, top-left: mm:ss in a **big digital seven-segment-style font** (chunky outline digits, off-white `#e9ecef` with dark `#16181d` plate; 74 px at 1080p). Counts up in campaign (par time compared), counts down in timed battle.
2. **Per-player panel** (stacked vertically, up to 4: AI/enemy first, then human players in slot order). Each panel is 3 rows:
   - Player glyph square (56 px): enemy = red hexagonal/flower sigil on `#2a0608`; human = big number **1 / 2 / 3** in the player colour (observed: a blue-grey "1", an orange or purple "3") on a dark square.
   - **Green HP bar** (`#37e24a` fill, `#0d3a14` track, dark outline) with a small **shield/heart icon** at left and the digits at right (observed 70 / 50 / 49) = remaining base hits (Max Hits).
   - **Yellow thorium counter**: yellow icon (radiation-like hex) + gold number `#ffd23c` (observed 2314 / 2302 / 1486). Not shown for the AI.
   - **Cyan unit-count bar**: `#27c6e8` fill with a **sword icon** at left and the number (observed 538, 1000, 674, 547, 732) -> fills towards the 1000 cap; at cap bar pulses.
3. Numbers use the same digital font at ~26 px, right-aligned, with a 1 px black outline.

**4:3 layout** [observed: video]: the same panels become a horizontal strip at the bottom-left of the screen (glyph, HP, thorium, units per player in 2 columns), timer bottom-right in a dark plate; COMET CRASH-style cyan wordmark top-centre (we use "ORBITAL CLASH" in cyan `#38e8ff`, thin extended sans with glow).

**Attack menu (R3)**: radial overlay centred on the player's base marker; 8 unit slots (4 basic + 4 special, plus bionic when unlocked) around a circle; each slot shows the unit icon and **pip dots** (white = 1, blue = 10, red = 100, per official manual); a **yellow bar** appears around the active slot when the attack is **locked**; in Battle the centre shows the current target glyph (L1 cycles).
**Build menu (R1)**: vertical list of 4 weapon icons + Basic Ops + Special Ops (+ bionic structures when profile = bionic), each with its thorium cost in gold; unaffordable items are dimmed 40 %.
**Hover card** (over any structure): name, level pips, recycle value, repair cost, upgrade cost, next-unit stats, dashed red range circle around the tower.
**Toasts**: top-centre message banner for tutorial hints (not in Resurgence), "AREA COMPLETE" screen shows time, penalties, rank/stars.

Typography: headings = extended geometric sans (e.g. procedurally drawn from a system `Orbitron`-like fallback stack `'Orbitron','Eurostile','Segoe UI',sans-serif`); digits = custom seven-segment SVG/canvas glyphs (no font file). Colour roles: HP green `#37e24a`, thorium gold `#ffd23c`, units cyan `#27c6e8`, danger red `#ff4a4a`, panel `#0b0c10`, text `#e9ecef`.

Motion: panels slide in 0.3 s ease-out; numeric changes tick with a 0.2 s count-up and a 0.1 s scale pop; HP bar damage ghost (red trail) drains over 0.6 s.

---

## 10. Quick reference of defaults (copy into `src/config` render block)

```
camera:   fov 28, pitch 62deg, yaw 0, distance 64, target (24,0,15), near 1, far 400
exposure: 1.05 (ACES)       bloom: {strength .85, radius .55, threshold .82}
keyLight: #fff1dc  i 2.6   az -35deg  el 52deg  shadow 4096 / 2048 / 1024
hemi:     sky #8fa8ff ground #2a2038 i .55      rim: #6fd8ff i .8
vignette: {strength .28, offset .35}            dof: {aperture 8e-5, maxblur .004}
team:     #3aa0ff  #ff4a4a  #b55cff  #ffb02e
hud:      hp #37e24a  thorium #ffd23c  units #27c6e8  panel #0b0c10
floor kronos: #5a5896 / seam #1c1a3a / inlay #33e6ff
floor gaia:   #4f5a22 / dirt #8a6b34 / rim #3d4030
```
