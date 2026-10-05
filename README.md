# Turbo Trail

A self-contained Three.js browser kart racer: three laps, five rivals, drifting, boost pads, physical kart contact, short ramp hops, item pickups, a minimap, and synthesized engine audio. Choose among four courses: Windmill Wilds, Neon Harbor, Sunstone Ruins, and Frostpeak Festival. Each is about 1.5 km long with six distinct sectors, a moving hazard, and a boost-dependent shortcut. Clean AI laps measure roughly 56–60 seconds (about three minutes for three laps). Each sector changes the scenery, driving rhythm, elevation or surface within 6–12 seconds.

## Run

```sh
npm start
```

Open http://127.0.0.1:5173. Alternatively, use any static HTTP server. No npm install or build is needed. Three.js 0.180.0 and the fonts are bundled under `vendor/` with their licenses; the game makes no external asset requests.

## Controls

- **Accelerate:** W / Up arrow
- **Brake, then reverse:** S / Down arrow. Hold to reverse after stopping.
- **Steer:** A / D or Left / Right arrows
- **Drift:** Hold Space or Shift while turning, then release for a mini-turbo
- **Trick:** Tap Space, Shift, or the touch DRIFT button just before ramp takeoff or during the first 0.28 seconds in the air. A successful trick earns a 0.7-second landing boost. Holding drift through a ramp does not automatically perform a trick.
- **Use item:** E / Enter
- **Pause:** Escape or the pause button. Losing focus also pauses the game.
- **Recover:** R or RESET when travelling below 12 km/h
- **Touch:** Steering, brake/reverse, drift, accelerator, and item buttons. Drag on the canvas to steer.

## Handling and performance

Horizontal movement uses world-space velocity, smooth steering, lateral tire grip, rolling resistance, slope forces, braking, and reverse. The track supplies the road surface and physical barriers; it does not steer the kart. Ordinary top speed is roughly 107 km/h on level road, and reverse reaches roughly 45 km/h. From rest, level-road acceleration reaches about 63 km/h forwards and 36 km/h in reverse after one second.

Ramp jumps intentionally favor arcade control: a bounded takeoff, stronger gravity, at most 1.1 metres above the road, and at most 0.85 seconds of airtime. Boosts increase horizontal speed without increasing takeoff velocity. Surface changes and kart collisions cannot trigger a jump.

Drift mini-turbos briefly widen the camera view and pull it back, with a stronger effect for orange turbos. Charging and release thresholds are unchanged.

Eight authored pickup rows each offer three lanes. Item odds are balanced in a close pack; racers more than 1.5 seconds behind the leader gradually receive better odds of mushrooms, red shells, and stars, reaching the maximum recovery weighting at 6.5 seconds. These odds apply equally to players and rivals. Shells are single use; triple mushrooms queue up to 2.85 seconds of boost, and boost pads never shorten an active boost.

Simulation runs at 120 Hz with interpolated rendering. Track projection and minimap geometry are cached; trees, flowers, guardrails and road markings are batched; static kart and cloud parts are merged. Rendering reduces pixel density after sustained slow frames. Item GPU resources are released when they expire; sparks share a reusable pool of 96 instances and are cleared on restart.

## Validation

```sh
npm test
```

The Node tests cover every course’s length, section pacing, five-driver race completion, shared collision boundaries, real single-mushroom shortcuts, asset integrity and scenery assembly, alongside acceleration, reverse, grip, airborne momentum, bounded boosted jumps, collision-related takeoff prevention, wall impulses, single-use drift turbos, continuous track progress, finish ranking, AI race completion, frame-rate independence, shell bounces, homing steering, and swept projectile collision.

For interactive integration checks, open `/tests/browser.html` on the same local server. It exposes held inputs, autodriving, a targeted boosted-ramp scenario, item use, pause/resume, hit recovery, and visible state/render counters. These controls are enabled only for the embedded game with the explicit `?test` query; they are absent from ordinary play.

The visuals combine original procedural artwork with adapted CC0 assets. They borrow the bright arcade racing feel of the Wii era; they do not reproduce Nintendo characters, tracks, or assets.

## Graphics

Rounded kart bodies and tires, alloy spokes, side vents, engine fins and numbered racing decals sit alongside layered pine canopies, orchard blossoms, a supported timber bridge and a detailed mill spanning the road. Shared 512px procedural textures add painted variation, grass blades, asphalt aggregate, bark grain, foliage, woven fabric, tire tread, masonry and roof tiles. Subtle bump mapping provides surface depth; instanced scenery and merged static kart parts keep draw calls contained.

The grass and asphalt now use palette-matched 256px ambientCG textures; the pine,
oak, and blossom scenery uses Kenney Nature Kit geometry, with spatial instance
batches that preserve culling. Vertex colors provide fixed underside shading,
road wear, and broad grass variation without an extra rendering pass. Warm
sunlight, cooler ambient light, and a painted sky gradient establish depth.
Kart paint, helmets, visors and metal use one small Poly Haven reflection map,
prefiltered once at startup. Number decals share one atlas. The existing 2048px
shadow map follows the kart in texel-sized steps in light space to reduce shimmer.
Rear-wheel drift sparks are pooled in one draw call, and dual exhaust flames
combine a pale core and orange tip in one mesh per kart.

All downloaded assets are bundled locally: normal play makes no requests to
asset providers. See [asset credits](assets/CREDITS.md) for creators, licenses,
sources and reproduction instructions. The combined downloaded runtime assets
are about 105 KiB for the shared graphics. The new courses add about 162 KiB of local assets: nine 512px textures and four normalized Kenney Nature Kit models. Their palette-matched concrete, masonry, sand, snow, timber and metal support detailed harbor buildings, carved temples and snowy chalets. See [course asset licenses and sources](assets/courses/LICENSES.md) and the [reproducible preparation script](tools/prepare-course-assets.py). A missing optional shared asset falls back to procedural artwork; a required course load failure offers a retry.
Open `/tests/browser.html?benchmark=1` to hold pixel density fixed and skip the
countdown while comparing graphics; normal play retains adaptive resolution.

## Windmill Wilds

Shared section data defines road surfaces, widths, ramp crests, pickup rows, boost panels, kart barriers and shell barriers. A delivery cart starts operating after 30 seconds, warns with a flashing beacon, and leaves an outside passing lane; AI and rendering use the same race clock and cart position.

The marked orchard grass cut opens the inside boundary. Mushrooms and stars preserve grip and speed across grass; an unboosted cut pays an off-road penalty. Outside turbo panels offer an alternative. Both routes pass the same ordered lap checkpoints, and large projection jumps are rejected. The mill portal provides 10 metres of overhead clearance for the chase camera.

The six sectors and course reference study are documented in `COURSE_PROPOSAL.md`. The browser test harness also accepts section seeks and bounded simulation steps through its existing test-only message API.

## New courses

| Course | Personality | Measured length | Clean AI laps | Proposal |
| --- | --- | --- | --- | --- |
| Neon Harbor | Midnight waterfront, market, warehouse and cargo terminal | 1,500 m | 56–57 s | [Detailed proposal](proposals/neon-harbor.md) |
| Sunstone Ruins | Warm canyon, oasis, carved temple and stone aqueduct | 1,499 m | 56–57 s | [Detailed proposal](proposals/sunstone-ruins.md) |
| Frostpeak Festival | Snowy village, fir forest, ridge and festival square | 1,541 m | 58–60 s | [Detailed proposal](proposals/frostpeak-festival.md) |

Independent reviews refined hazard clearance, supported bridges, ice recovery, shortcut placement and camera sightlines before implementation. Proposal measurement notes distinguish the original tuning goals from measured results; final shortcut gains are modest and remain candidates for human-playtest tuning.

Each course owns its descriptor, scenery module, proposal and focused tests. The [parallel development contract](courses/CONTRACT.md) documents this boundary. `track-builder.js` constructs isolated route queries; `track.js` exposes the selected route to physics, AI, items and rendering. `course-runtime.js` builds shared road, terrain and barriers, while `course-kit.js` supplies scenery primitives, downloaded models and static batching. Course authors can work independently without modifying the engine. Moving meshes are explicitly excluded from batching.

Select a course on the title screen; changing it loads a fresh world. After finishing, **CHOOSE ANOTHER COURSE** returns to the picker. The browser harness accepts `?course=neon-harbor`, `?course=sunstone-ruins` or `?course=frostpeak-festival` and retains the benchmark mode when switching.
