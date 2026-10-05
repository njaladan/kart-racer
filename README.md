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
- **Touch:** Hold GO to accelerate and use the steering, brake/reverse, drift, and item buttons. Drag on the canvas for proportional steering. Large thumb targets show held inputs, support simultaneous fingers, and stay clear of iPhone safe areas. Driving controls suppress text selection, long-press menus, and browser zoom gestures.

## Handling and performance

Horizontal movement uses world-space velocity, smooth steering, lateral tire grip, rolling resistance, slope forces, braking, and reverse. The track supplies the road surface and physical barriers; it does not steer the kart. Ordinary top speed is roughly 107 km/h on level road, and reverse reaches roughly 45 km/h. From rest, level-road acceleration reaches about 63 km/h forwards and 36 km/h in reverse after one second.

Player steering turns in promptly and recenters or countersteers faster, while preserving gradual transitions. Kart position and heading share fixed-step interpolation, and the follow camera tracks that rendered pose. AI response tuning and surface grip remain unchanged.

Ramp jumps intentionally favor arcade control: a bounded takeoff, stronger gravity, at most 1.1 metres above the road, and at most 0.85 seconds of airtime. Boosts increase horizontal speed without increasing takeoff velocity. Surface changes and kart collisions cannot trigger a jump.

Drift mini-turbos briefly widen the camera view and pull it back, with a stronger effect for orange turbos. Charging and release thresholds are unchanged.

Eight authored pickup rows each offer three lanes. Item odds are balanced in a close pack; racers more than 1.5 seconds behind the leader gradually receive better odds of mushrooms, red shells, and stars, reaching the maximum recovery weighting at 6.5 seconds. These odds apply equally to players and rivals. Shells are single use; triple mushrooms queue up to 2.85 seconds of boost, and boost pads never shorten an active boost.

Simulation runs at 120 Hz with interpolated rendering. Track projection and minimap geometry are cached; trees, flowers, guardrails and road markings are batched; static kart and cloud parts are merged. Rendering reduces pixel density after sustained slow frames. Item GPU resources are released when they expire; sparks share a reusable pool of 96 instances and are cleared on restart.

## Validation

```sh
npm test
```

The Node tests cover every course’s length, section pacing, five-driver race completion, shared collision boundaries, real single-mushroom shortcuts, asset integrity and scenery assembly, alongside acceleration, reverse, grip, airborne momentum, bounded boosted jumps, collision-related takeoff prevention, wall impulses, single-use drift turbos, continuous track progress, finish ranking, AI race completion, frame-rate independence, shell bounces, homing steering, and swept projectile collision.

The living-world build passes **63 Node tests**, including five isolated AI drivers finishing three laps on each course, widened route ground / barrier coherence, shell reflection at the new edges, and integrity / UV preservation of the downloaded assets. Headless Chromium checks cover course rendering and shader compilation. These software-rendered checks do not establish a hardware frame-rate target; real-device performance and human racing-line tuning still need playtesting.

The game is split across focused scene, kart, input, renderer, audio, HUD, racer-state, and course-contract modules. See [the code quality review](CODE_QUALITY.md) for the findings addressed and the remaining race-session coordination boundary.

For interactive integration checks, open `/tests/browser.html` on the same local server. It exposes held inputs, autodriving, a targeted boosted-ramp scenario, item use, pause/resume, hit recovery, and visible state/render counters. These controls are enabled only for the embedded game with the explicit `?test` query; they are absent from ordinary play.

The visuals combine original procedural artwork with adapted CC0 assets. They borrow the bright arcade racing feel of the Wii era; they do not reproduce Nintendo characters, tracks, or assets.

## Graphics

The shared [art-direction brief](proposals/art-direction.md) keeps the bright arcade style while giving the four courses different atmospheres and environmental life. A layered animated sky supplies clouds, sun or moon, stars and horizon haze. Sector transitions smoothly change fog and ambient fill; bounded snow, sand, sea spray or forest motes complement the scenery. Gentle chase-camera banking, air anticipation, turbo widening and restrained edge streaks reinforce speed without blurring the racing line.

The upgrade bundles **ten downloaded ambientCG material sets** with 1024px photographic color maps plus separate 512px OpenGL normal and roughness maps: grass, worn asphalt, actual plank wood, cobbled paving, sand, forest floor, rock, brick, roof tiles and gravel. Materials retain the existing arcade palette with modest color adjustments. **Three textured Poly Haven props** add real benches, ornate street lamps and planters at focal places. Original Kenney trees / rocks / palms and the Poly Haven reflection environment remain part of the landscape. The additional bundle is about 11.5 MiB; no asset-provider requests occur during play.

| Course | New scenery and motion | Additional driveable lines |
| --- | --- | --- |
| Windmill Wilds | Striped fair stalls, waving spectators, sheep pasture, flower beds, fern and mushroom understory, layered limestone, viewing terrace, dock craft, bobbing boats, working waterwheel and gears, butterflies, birds and orchard petals | Meadow grass, forest-floor bypass and ridge gravel overlook |
| Neon Harbor | Detailed storefronts, fire escapes, rooftop hardware, waterfront benches / lamps / planters, market goods, distant skyline, moving ferries, crane hooks, pedestrians, steam, signals and water highlights | Cobbled market delivery lane and loading apron |
| Sunstone Ruins | Sculpted dunes, oasis reeds and ripples, wind-blown palm crowns and cloth, carved temple cornices, arcades, torches, courtyard machinery, dust and circling birds | Sandy oasis shore and paved processional line |
| Frostpeak Festival | Log-course chalets, balconies, snowy shutters, irregular alpine peaks and cornices, working gondolas / cable towers, summit lodge, skating pond, cheering crowds and rippling banners | Powder slalom edge and summit gravel overtaking line |

These nine additional side routes open and rejoin continuously. Their rendered ground, surface grip / drag, kart barriers, shell barriers and ordered race progress share the same metadata. They supplement the original boost-dependent final shortcuts; the existing centerline layouts and clean-lap pacing are preserved.

Static scenery and imported props are batched; trees, city crowds and water highlights use instances. Rural cheering limbs merge into a few animated batches, and particles stay bounded. The 2048px shadow map follows in texel-sized steps; adaptive pixel density now measures actual display-frame duration. A small performance increase is expected from denser geometry and PBR maps; device-specific frame rates are not asserted.

See [asset credits](assets/CREDITS.md), [new downloaded-asset licenses and sources](assets/living/LICENSES.md), and `assets/living/manifest.json` for exact URLs and hashes. `python3 tools/prepare-living-assets.py` reproduces the new bundle with Pillow and numpy. The older [course bundle](assets/courses/LICENSES.md) retains its own credits. Missing optional shared assets have procedural fallbacks; a required local bundle failure offers a retry.

Open `/tests/browser.html?benchmark=1` to skip the countdown and hold pixel density fixed. The repaired course picker selects all four worlds. Test-only section seeking accepts `offset` for side-route inspection and `snapCamera` for deterministic chase views; ordinary play has no test controls.

## Windmill Wilds

Shared section data defines road surfaces, widths, ramp crests, pickup rows, boost panels, kart barriers and shell barriers. A delivery cart starts operating after 30 seconds, warns with a flashing beacon, and leaves an outside passing lane; AI and rendering use the same race clock and cart position.

The marked orchard grass cut opens the inside boundary. Mushrooms and stars preserve grip and speed across grass; an unboosted cut pays an off-road penalty. Outside turbo panels offer an alternative. Both routes pass the same ordered lap checkpoints, and large projection jumps are rejected. The mill portal provides 10 metres of overhead clearance for the chase camera.

The six sectors and course reference study are documented in `proposals/windmill-wilds.md`. The browser test harness also accepts section seeks and bounded simulation steps through its existing test-only message API.

## New courses

| Course | Personality | Measured length | Clean AI laps | Proposal |
| --- | --- | --- | --- | --- |
| Neon Harbor | Midnight waterfront, market, warehouse and cargo terminal | 1,500 m | 56–57 s | [Detailed proposal](proposals/neon-harbor.md) |
| Sunstone Ruins | Warm canyon, oasis, carved temple and stone aqueduct | 1,499 m | 56–57 s | [Detailed proposal](proposals/sunstone-ruins.md) |
| Frostpeak Festival | Snowy village, fir forest, ridge and festival square | 1,541 m | 58–60 s | [Detailed proposal](proposals/frostpeak-festival.md) |

Independent reviews refined hazard clearance, supported bridges, ice recovery, shortcut placement and camera sightlines before implementation. Proposal measurement notes distinguish the original tuning goals from measured results; final shortcut gains are modest and remain candidates for human-playtest tuning.

Each course owns its descriptor, scenery module, proposal and focused tests. The [parallel development contract](src/courses/CONTRACT.md) documents this boundary. `src/track/track-builder.js` constructs isolated route queries; `src/track/track.js` exposes the selected route to physics, AI, items and rendering. `src/rendering/course-runtime.js` builds shared road, terrain and barriers, while `src/rendering/course-kit.js` supplies scenery primitives, downloaded models and static batching. Course authors can work independently without modifying the engine. Moving meshes are explicitly excluded from batching.

Select a course on the title screen; changing it loads a fresh world. After finishing, **CHOOSE ANOTHER COURSE** returns to the picker. The browser harness accepts `?course=neon-harbor`, `?course=sunstone-ruins` or `?course=frostpeak-festival` and retains the benchmark mode when switching.

## Project organization

Game source lives in `src/`, grouped into `simulation/`, `track/`, `rendering/`, `courses/`, `audio/`, `input/`, and `ui/`. `src/game.js` connects these systems. All course and art-direction proposals live in `proposals/`; assets and vendor code remain at the repository root so existing browser asset URLs continue to work.

For development quality checks, run `npm install` followed by `npm run check`. Use `npm run format` to format first-party JavaScript. See [code conventions and reviewed guidance](CODE_QUALITY.md) for naming, module boundaries, existing contracts, and preserved issues. The game remains runnable with `npm start` without installing development tools.
