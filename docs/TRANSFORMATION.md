# Turbo Trail — adventure racer continuity

## Vision
Twelve authored journeys with readable racing surfaces, powerful silhouettes, purposeful motion and distinct playable mechanics. Sunstone is the first flagship target; its initial route milestone was rejected as visually incomplete. No course music changes. Main agent works alone. User requests focused checks and brief browser inspection, then implementation.

## Creative matrix
| Course | World / progression | Signature | Route / choice |
|---|---|---|---|
| Windmill Wilds | Harvest valley, woodland, working mill | Rural banked ridge and willow maze (existing) | Existing eight-place adventure |
| Neon Harbor | Port Lumen waterfront, market, warehouse | Cargo conveyors and ferry district (existing) | Working port loop |
| Sunstone Ruins | Oasis, canyon, mesa, buried temple, courtyard, dunes | Solar engine gates with safe shadow lane | Rebuilt expedition, sand cut, temple apron |
| Frostpeak Festival | Alpine village and ski festival | Ice and powder (existing) | Mountain road |
| Clockwork Citadel | Furnace yard, spiral tower, clock face, rooftop | Rideable vertical lift | Stacked spiral and descent |
| Pocket Pantry | Breakfast table, jar portal, pantry shelves, sink | Shrinking and growing through scale portals | Giant utensils and narrow crumb passage |
| Railstorm Express | Railway yard, cargo wagons, mountain viaduct | Moving train deck | Boarding, cargo run, disembark |
| Paper Revel | Lantern festival, folded valley, paper pagoda | Unfolding paper route | Sharp visual zigzags and layered crossing |
| Tempest Causeway | Storm coast, lighthouse shelter, exposed sea bridges | Wind and wave choreography | Long exposed bridges between shelters |
| Metronome Hall | Music-box workshop, pendulum hall, bell tower | Beat-synchronised obstacle timing | Rhythm lanes; no music added |
| Pelagic Glasshouse | Coastal conservatory, flooded dome, reef garden | Underwater buoyant driving | Descending glass tunnels, reef rise |
| Emberwing Observatory | Volcanic observatory, telescope terraces, caldera | Cannon transit | Launch across caldera with guided landing |

## Architecture / sources
Native ES modules, bundled Three.js, Node authoritative multiplayer worker, shared fixed-step physics. Extend existing course contract where requested topology needs it; old contract prohibitions are superseded by user's goal. Ordered checkpoints remain authoritative. Decorative animation stays outside physics. Prefer analytic race-clock mechanics so client/server agree. Reuse already bundled credited assets; new procedural geometry and synthesized non-musical sound are original project assets. Record any additional external sources here.

## Milestones
- Baseline e289bad: clean working tree, branch `work`; created `main` at same revision as requested. No AGENTS.md present. Dependencies installed with npm ci.

## Current / remaining
Start with elevation-aware route identity, smooth road foundation and full Sunstone rebuild. Then selection/options, audio and animation infrastructure, then eight distinct courses. Existing courses receive shared polish. Nothing claimed complete until verified.

## Verification / defects
Baseline not rerun yet. Chromium and Playwright available. Use focused simulation/regression checks and a few normal-camera screenshots. Headless rendering cannot establish hardware performance.

## Exact next steps
1. Implement elevation-aware projection, preserving local route continuity and using height on global lookup; regression at stacked crossing.
2. Rebuild Sunstone descriptor and scenery around the progression above; solar-engine gameplay, shortcuts, full-lap AI check and camera inspection.
3. Commit each coherent milestone and replace this section with exact continuation steps.

### Foundation + Sunstone work
- 9e144d4: route floor disambiguation and vision/matrix committed.
- Rebuilt Sunstone: 1,803 m; minimum horizontal radius 20.3 m; eight places; 67 m elevation range. Five isolated AI three-lap races finish in 199–203 seconds with zero wall impacts. Solar boost lanes use one analytic clock in simulation/rendering.
- Camera check caught two real issues: base ground plane occluded the buried road, and color-map multiplication muddied architecture. Lowered Sunstone's base terrain to -18 m and switched monumental stone to bump-only textures with authored colors. Old Sunstone bake intentionally disabled because its geometry is obsolete.
- Existing baseline had one formatting discrepancy in Windmill terrain; normalized it. Full test run underway; this is a formatting-only change.
- b1a7b81: Sunstone expedition committed. Focused Sunstone/terrain checks pass. Initial full run: 110/111; corrected the test's elevation measurement to sample the complete route (its old midpoint-only check missed the crest); focused rerun passes. Local projection deliberately remains horizontal to preserve ramp-hop behavior; global relocation uses elevation.

### Menu / sound / motion milestone
Course and garage tabs replace dropdowns. Original vector postcards are generated locally by tools/create-course-previews.mjs. Real STK karts animate on an isolated showroom plinth; selection reload occurs only on Race. Keyboard focus, touch cards, D-pad/stick browsing. Graphics ceiling, adaptive quality, bloom, motion and three audio volumes persist in localStorage. Original synthesized noise Foley adds filtered world air, mechanical sounds with distance falloff/pan, tire noise, impacts/landings, and engine-load variation. Three visual trick silhouettes (spin, roll, flip), reactive braking pitch and stronger driver lean; no authoritative movement changes. Existing audio/frame-loop/trick/session tests: 14 pass. Menu browser smoke underway at Performance tier; no hardware performance claims.
- 1a07386: animated selection/options, synthesized Foley and expressive tricks committed. Preferences regression passes. A brief menu screenshot attempt timed out in software Chromium; menu visual/touch verification remains pending. Updated Sunstone camera captures show the corrected continuous buried floor and clean warm palette.
- Remote sync requested: merge origin/main at 85f59f2 (Frostpeak eight-place rebuild, winter life, Windmill waterfall removal and support fixes). Resolved terrain/runtime/registry conflicts by combining course edge styles and retaining remote support offsets with clearance beneath raised bridge hops. Focused registry/Frostpeak/Sunstone checks: 8 pass. User now requests a push after every commit.

## Latest steering and status (authoritative)
User explicitly rejects the sparse Sunstone pass as a final course. Existing three rebuilt worlds are the minimum visual bar. **Sunstone b1a7b81 is an intermediate route milestone, not a finished visual flagship.** New-course rollout is paused while its visual standard is corrected. User explicitly authorizes replacing course-contract restrictions: course ideas set topology; rewrite engine rules to support them.

- f80fc36: pulled/merged remote Frostpeak eight-place rebuild and Windmill fixes; pushed all milestone history to origin/main. Always push immediately after each future commit.
- Shared adventure foundation: scalar lift/cannon traversal states with shared clocks, ordered progress, snapshot/replay, safe entrance recovery; scale-aware body contacts/camera, underwater jump response and currents; unfolding verge gate. Existing ground-loop curvature floor is removed for topology=adventure; section count can be 3–32. Replaced CONTRACT.md with idea-led authoring rules.
- Focused physics/session/topology/traversal checks: 31 pass, including snapshot replay, continuous exit and recovery. New course descriptors + initial three scenery scaffolds exist unregistered in the working tree; do not call them finished or expose them in the registry until visual standard and gameplay are ready. Remaining five scenery imports are intentionally not implemented yet.
- Sunstone visual correction underway: restored actual textured ruins/rock/vegetation assets with foreground/middle/horizon clustering; carved world-space stone; cloth stalls and rugs, relief galleries, broken statues, bird flocks/reptiles, torch flames, skylight shafts. Lower sun angle and stronger exterior/interior contrast. New 512²/12-ray AO/bounce bake + six-height colored-spill volume generated from 559,158 static triangles in 20 seconds. Nine torch pools. Bake now loaded again. Brief normal-camera review capture running; no measured hardware performance.

### Exact continuation
1. Inspect new Sunstone engine/mesa review captures if present and the actual code; fix any visible clearance/composition/lighting defects. Run focused scenery/bake/Sunstone tests.
2. Commit/push shared topology milestone separately, then commit/push Sunstone visual correction and record hashes.
3. Before new-course rollout, reach the user's much higher ambition bar. Expand authored layouts and visual scenes substantially beyond sparse primitive scaffolds. Complete one new world at a time, validate AI/recovery/multiplayer mechanics, capture briefly, commit/push.
4. Finish Paper/Tempest/Metronome/Pelagic/Emberwing scenery, register each completed course, generate local postcards/manifests and integrate menus. Total goal remains twelve courses; current registry still four. Rewrite old count/distance/bake assumptions only when appropriate.
5. Main menu screenshot attempt previously timed out in software Chromium; keyboard/touch/gamepad visual smoke still pending. No course music changes. Existing local assets retain their licenses.

### Sunstone lighting and inhabited-world milestone
- 0088f19: idea-led topology/traversal foundation committed and pushed. Contract permits new topology; engine supports shared traversal state, scale, currents and unfolding.
- Visual correction: reused locally credited STK ruined architecture, cliffs, shrubs, grasses, torch and merchant props; added procedural stone vaults, articulated solar gimbals, floor mosaics, route-space worn paving, distant dunes/settlements, reed beds, birds, reptiles, sailing cloth and bounded sand. Low warm sun, cool interior fill, real camera-following shadows, torch spill and skylight shafts. All added shaders/geometry and ambience synthesis are original project work. Existing packs retain their published licenses.
- Rebuilt static lighting from the actual scene: 561,762 static triangles exported, 512x512 AO/bounce, six-height spill atlas and nine lamps. Bake took 16.6 s in local Blender; this measures offline bake time, not player hardware performance.
- Corrected right temple wall/pillars/reliefs/solar supports to clear the expanded temple apron. Brief normal-camera software Chromium capture succeeds with no page or shader errors: docs/screenshots/sunstone-engine-polish.jpg. It shows actual roof shadows, warm/cool light, detailed stone paving and solar inlays. Capture at 640x360 also exposes the narrow-width touch overlay; full menu/touch layout review remains.
- Focused scenery, Sunstone full AI races, shortcut/solar mechanisms, lighting hashes and graphics checks: 16 pass. No extended browser runs or beauty tests. Sunstone remains open for iterative refinement; this is a substantial visual correction, not a claim that the full twelve-course goal is finished.

### Current next actions
1. Commit/push this Sunstone visual correction; record its hash in the next milestone.
2. Finish Clockwork as the first new course: replace its initial diagonal lift scaffold with an actual vertical transfer and authored docks; support literal line/vertical route links and stable frames/projection. Compose an inhabited mechanical city around the stacked spiral, gears, clock-face balcony and rooftop. Full AI laps, lift/recovery/snapshot smoke, brief driving-camera inspection, commit/push.
3. Continue the matrix one finished world at a time. Eight descriptors and three early scene scaffolds remain unregistered; current playable roster has four. Do not expose missing scenery imports as completed courses.

### Clockwork milestone
- d76c15c: Sunstone inhabited-world/lighting correction committed and pushed.
- Clockwork Citadel now registered (playable roster five; seven additions remain): 2,142 m, two stacked spiral revolutions, foundry descent, literal 74 m vertical sky lift, rooftop crown, inside maintenance line. Original perforated fortress, gear trains, arched window bays, clock facade, foundry neighborhoods, outer workshops, lamps, balloons, workers and pistons. Procedural construction uses existing CC0 textures; provenance in assets/courses/packs/clockwork-citadel/LICENSES.md. No music.
- Added literal authored routeLinks and level vertical frames; projection chooses actual lane height including bank/localized ramps. Fixed Frostpeak poseAt side-lane ramp height discovered by broader testing. Default adventure legacy hazard disabled to avoid invisible generic cart collisions.
- Five isolated AI three-lap finishes, three lift rides each. Focused physical vertical/frame/projection, replicated timing, entrance recovery, Frostpeak full laps and all widened lines: eight pass. Earlier focused scenery/registry/bake/global crossing: eleven pass. Real socket/worker checks pass in the broader focused run.
- Full check ran once: lint/format pass, 117/119 tests pass. Corrected the two failures (old curvature assertion and Frostpeak localized ramp placement/projection); both affected suites now pass. Removed creative polygon-count bake assertion; hashes, sizes, PNG format and actual geometry remain checked.
- Normal camera software Chromium review succeeds without page/shader errors: docs/screenshots/clockwork-spiral.jpg. Camera review moved gallery machinery inside and added outer workshop composition; stamped metal/paving floor remains crisp. Software rendering establishes neither target-hardware FPS nor comprehensive full-camera coverage.
- New 512x512/12-ray Clockwork bake and six-height spill, 94 localized lamp sources; final offline bake 10.7 s. Lamps are baked/local shader pools, not 94 realtime lights.

### Exact active handoff
1. Commit/push Clockwork and record its hash next milestone.
2. Paper Revel is next: new unregistered world now has folded banks, layered figure-eight, original articulated cranes, multi-tier paper pagodas, lantern arcades, festival shops, pinwheels and a folding apron. Finish shared-clock fan geometry/physics boundaries, AI/recovery/replica verification, local bake/manifest/preview, then register, briefly review and commit/push.
3. Pantry/Railstorm initial scenery and remaining Tempest/Metronome/Pelagic/Emberwing descriptors still unfinished/unregistered; do not claim those courses complete. Main menu/touch broader visual review remains.
